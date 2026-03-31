// Local scanner — runs from your Mac, bypasses Vercel
// Usage: npx tsx scripts/local-scan.ts

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});
const prisma = new PrismaClient({ adapter });

const REDDIT_PUBLIC_URL = "https://www.reddit.com";

async function fetchRedditPosts(subreddit: string, sort: string, limit: number) {
  const url = `${REDDIT_PUBLIC_URL}/r/${subreddit}/${sort}.json?limit=${limit}`;
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

  if (keywords.contextualSubs.has(subreddit.toLowerCase())) {
    for (const kw of keywords.contextual) {
      if (matchesWholeWord(text, kw) && !matched.includes(kw)) {
        const co = checkCoOccurrence(text, kw);
        if (co === "reject") continue;
        matched.push(kw);
        score += co === "boost" ? 25 : 15;
      }
    }
  }

  for (const kw of matched) {
    if (matchesWholeWord(titleLower, kw)) score += 15;
  }

  return { score, matched };
}

async function main() {
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

    const contextualSubs = new Set(project.subreddits.map(s => s.name.toLowerCase()));
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

    for (const sub of project.subreddits) {
      try {
        const posts = await fetchRedditPosts(sub.name, "new", 25);

        for (const post of posts) {
          const existing = await prisma.monitoredPost.findUnique({
            where: { redditId_projectId: { redditId: post.name, projectId: project.id } },
          });
          if (existing) continue;

          const { score, matched } = calculateRelevance(
            post.title, post.selftext || "", keywords, sub.name
          );
          if (score === 0) continue;

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
        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        console.error(`  Error scanning r/${sub.name}:`, (err as Error).message);
      }
    }

    totalFound += projectFound;
    console.log(`  ${project.name}: scanned ${project.subreddits.length} subs, found ${projectFound} new posts`);
  }

  console.log(`\n[${new Date().toISOString()}] Done — ${totalFound} total new posts`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
