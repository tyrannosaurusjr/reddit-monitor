// Local scanner — runs from your Mac, bypasses Vercel
// Usage: npx tsx scripts/local-scan.ts

import "dotenv/config";
import dns from "dns/promises";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});
const prisma = new PrismaClient({ adapter });

const REDDIT_PUBLIC_URL = "https://www.reddit.com";

// time: "hour", "day", "week", "month", "year", "all" (only applies to "top" sort)
async function fetchRedditPosts(subreddit: string, sort: string, limit: number, time?: string) {
  let url = `${REDDIT_PUBLIC_URL}/r/${subreddit}/${sort}.json?limit=${limit}`;
  if (time && sort === "top") url += `&t=${time}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "RedditReach/1.0.0" },
  });
  if (!res.ok) throw new Error(`Reddit ${res.status}: ${subreddit}`);
  const data = await res.json();
  return data.data.children.map((c: { data: Record<string, unknown> }) => c.data);
}

function matchesWholeWord(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

// Co-occurrence rules for ambiguous single-word keywords
const CO_OCCURRENCE_RULES: Record<string, { boost: string[]; reject: string[] }> = {
  metal: {
    boost: ["show", "shows", "concert", "gig", "live", "tour", "album", "song", "band", "guitar", "drummer", "riff", "mosh", "fest", "festival", "venue", "record", "vinyl", "genre", "scene", "listen", "recommend"],
    reject: ["shelf", "shelving", "detector", "roofing", "sheet metal", "welding", "fabrication", "alloy", "steel", "aluminum", "copper", "scrap metal", "metalwork", "machining"],
  },
  band: {
    boost: ["show", "concert", "gig", "live", "tour", "album", "song", "music", "guitar", "vocalist", "genre", "venue", "festival", "record"],
    reject: ["rubber band", "resistance band", "wrist band", "headband", "band aid", "bandwidth", "broadband"],
  },
  club: {
    boost: ["dj", "dance", "music", "night", "nightlife", "party", "venue", "techno", "house", "edm"],
    reject: ["golf club", "book club", "fight club", "country club", "club sandwich", "membership"],
  },
  record: {
    boost: ["vinyl", "album", "listen", "music", "shop", "spin", "turntable", "pressing", "label"],
    reject: ["world record", "record time", "track record", "medical record", "criminal record"],
  },
};

function checkCoOccurrence(text: string, keyword: string): "boost" | "reject" | "neutral" {
  const rule = CO_OCCURRENCE_RULES[keyword];
  if (!rule) return "neutral";
  for (const r of rule.reject) { if (text.includes(r)) return "reject"; }
  for (const b of rule.boost) { if (text.includes(b)) return "boost"; }
  return "neutral";
}

// Intent signals — phrases that suggest the poster is seeking help/recommendations
const INTENT_BOOST_PATTERNS = [
  /\?/,
  /\b(?:looking for|searching for|trying to find)\b/,
  /\b(?:recommend|recommendation|recommendations|suggest|suggestion|suggestions)\b/,
  /\b(?:need help|need advice|any tips|any advice)\b/,
  /\b(?:where can i|where should i|how do i|how can i|what should i)\b/,
  /\b(?:first time|beginner|new to)\b/,
  /\b(?:planning a trip|planning to visit|want to visit|visiting)\b/,
  /\b(?:anyone know|does anyone|has anyone)\b/,
  /\b(?:help me|advice needed|tips for|guide to)\b/,
];

function calculateIntentBoost(text: string): number {
  let boost = 0;
  for (const pattern of INTENT_BOOST_PATTERNS) {
    if (pattern.test(text)) {
      boost += 10;
      if (boost >= 20) break;
    }
  }
  return boost;
}

const MIN_RELEVANCE_SCORE = 20;

function calculateRelevance(
  title: string, selftext: string,
  keywords: { global: string[]; contextual: string[]; contextualSubs: Set<string> },
  subreddit: string
) {
  const text = `${title} ${selftext}`.toLowerCase();
  const titleLower = title.toLowerCase();
  const matched: string[] = [];
  let score = 0;

  for (const kw of keywords.global) {
    if (matchesWholeWord(text, kw)) {
      if (kw.split(" ").length > 1) {
        matched.push(kw);
        score += kw.split(" ").length * 10;
        continue;
      }
      const co = checkCoOccurrence(text, kw);
      if (co === "reject") continue;
      matched.push(kw);
      score += co === "boost" ? 20 : 10;
    }
  }

  // Contextual keywords: require 2+ matches (single contextual keyword is too noisy)
  if (keywords.contextualSubs.has(subreddit.toLowerCase())) {
    const contextualMatches: Array<{ keyword: string; score: number }> = [];
    for (const kw of keywords.contextual) {
      if (matchesWholeWord(text, kw) && !matched.includes(kw)) {
        const co = checkCoOccurrence(text, kw);
        if (co === "reject") continue;
        contextualMatches.push({ keyword: kw, score: co === "boost" ? 25 : 15 });
      }
    }
    if (contextualMatches.length >= 2 || contextualMatches.some(m => m.score >= 25)) {
      for (const m of contextualMatches) {
        matched.push(m.keyword);
        score += m.score;
      }
    }
  }

  for (const kw of matched) {
    if (matchesWholeWord(titleLower, kw)) score += 15;
  }

  // Intent boost — reward posts where the user is asking for help/recommendations
  if (matched.length > 0) {
    score += calculateIntentBoost(text);
  }

  return { score, matched };
}

async function isOnline(): Promise<boolean> {
  try {
    await dns.lookup("reddit.com");
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await isOnline())) {
    console.log(`[${new Date().toISOString()}] Network unavailable, skipping scan`);
    process.exit(0);
  }

  console.log(`[${new Date().toISOString()}] Starting local scan...`);

  const projects = await prisma.project.findMany({
    where: { enabled: true },
    include: { subreddits: { where: { enabled: true } } },
  });

  console.log(`Found ${projects.length} projects`);

  let totalFound = 0;

  for (const project of projects) {
    const dbKeywords = await prisma.keywordFilter.findMany({
      where: { projectId: project.id, enabled: true },
    });

    const contextualSubs = new Set(
      project.subreddits.filter((s: any) => s.contextual).map((s: any) => s.name.toLowerCase())
    );
    const keywords = {
      global: dbKeywords.filter(k => k.isGlobal).map(k => k.keyword.toLowerCase()),
      contextual: dbKeywords.filter(k => !k.isGlobal).map(k => k.keyword.toLowerCase()),
      contextualSubs,
    };

    if (keywords.global.length === 0 && keywords.contextual.length === 0) {
      console.log(`  ${project.name}: no keywords, skipping`);
      continue;
    }

    let projectFound = 0;

    // Scan period: default is "new" only, but CLI arg can override
    // Usage: npx tsx scripts/local-scan.ts --period=week
    const periodArg = process.argv.find(a => a.startsWith("--period="));
    const period = periodArg ? periodArg.split("=")[1] : null;

    // Determine which sorts to fetch
    const sorts: Array<{ sort: string; limit: number; time?: string }> = [
      { sort: "new", limit: 25 }, // always check newest
    ];
    if (period) {
      // Also search top posts from the specified period
      sorts.push({ sort: "top", limit: 25, time: period });
    }

    for (const sub of project.subreddits) {
      try {
        const allPosts: any[] = [];
        for (const s of sorts) {
          const fetched = await fetchRedditPosts(sub.name, s.sort, s.limit, s.time);
          allPosts.push(...fetched);
          await new Promise(r => setTimeout(r, 3000));
        }

        // Deduplicate by reddit ID
        const seen = new Set<string>();
        const posts = allPosts.filter((p: any) => {
          if (seen.has(p.name)) return false;
          seen.add(p.name);
          return true;
        });

        for (const post of posts as any[]) {
          const existing = await prisma.monitoredPost.findUnique({
            where: { redditId_projectId: { redditId: post.name, projectId: project.id } },
          });
          if (existing) continue;

          const { score, matched } = calculateRelevance(
            post.title, post.selftext || "", keywords, sub.name
          );
          if (score < MIN_RELEVANCE_SCORE) continue;

          await prisma.monitoredPost.create({
            data: {
              redditId: post.name,
              subreddit: post.subreddit,
              title: post.title,
              selftext: post.selftext || "",
              author: post.author,
              url: post.url,
              permalink: `https://reddit.com${post.permalink}`,
              score: post.score,
              numComments: post.num_comments,
              createdUtc: new Date(post.created_utc * 1000),
              relevanceScore: score,
              matchedKeywords: matched.join(","),
              projectId: project.id,
              subredditTargetId: sub.id,
              status: "new",
            },
          });
          projectFound++;
        }

        // Small delay to avoid Reddit rate limiting
        await new Promise(r => setTimeout(r, 3000));
      } catch (err) {
        console.error(`  Error scanning r/${sub.name}:`, (err as Error).message);
      }
    }

    totalFound += projectFound;
    console.log(`  ${project.name}: scanned ${project.subreddits.length} subs, found ${projectFound} new posts`);

    // --- Trending: grab hottest posts that are also topic-relevant ---
    let trendingFound = 0;
    const MIN_TRENDING_UPVOTES = 50;
    const MIN_TRENDING_RELEVANCE = 10; // lower bar than keyword-matched, but must have SOME relevance

    for (const sub of project.subreddits) {
      try {
        const hotPosts = await fetchRedditPosts(sub.name, "hot", 10);

        for (const post of hotPosts) {
          if (post.score < MIN_TRENDING_UPVOTES) continue;

          const existing = await prisma.monitoredPost.findUnique({
            where: { redditId_projectId: { redditId: post.name, projectId: project.id } },
          });
          if (existing) continue;

          // Trending posts must have at least some keyword relevance
          const { score: relScore, matched: relMatched } = calculateRelevance(
            post.title, post.selftext || "", keywords, sub.name
          );
          if (relScore < MIN_TRENDING_RELEVANCE) continue;

          await prisma.monitoredPost.create({
            data: {
              redditId: post.name,
              subreddit: post.subreddit,
              title: post.title,
              selftext: post.selftext || "",
              author: post.author,
              url: post.url,
              permalink: `https://reddit.com${post.permalink}`,
              score: post.score,
              numComments: post.num_comments,
              createdUtc: new Date(post.created_utc * 1000),
              relevanceScore: relScore,
              matchedKeywords: relMatched.join(","),
              projectId: project.id,
              subredditTargetId: sub.id,
              status: "trending",
            },
          });
          trendingFound++;
        }

        await new Promise(r => setTimeout(r, 3000));
      } catch (err) {
        // Silently skip trending errors
      }
    }

    if (trendingFound > 0) {
      console.log(`  ${project.name}: found ${trendingFound} trending posts`);
    }

    // Clean up old trending posts (>3 days old) to keep the list fresh
    await prisma.monitoredPost.deleteMany({
      where: {
        projectId: project.id,
        status: "trending",
        createdUtc: { lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      },
    });
  }

  console.log(`\n[${new Date().toISOString()}] Done — ${totalFound} total new posts`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
