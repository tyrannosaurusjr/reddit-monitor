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
      matched.push(kw);
      score += kw.split(" ").length * 10;
    }
  }

  // Contextual keywords match in any of the project's own subreddits
  if (keywords.contextualSubs.has(subreddit.toLowerCase())) {
    for (const kw of keywords.contextual) {
      if (matchesWholeWord(text, kw) && !matched.includes(kw)) {
        matched.push(kw);
        score += 15;
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
