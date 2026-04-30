// Local scanner — runs from your Mac, bypasses Vercel
// Usage: npx tsx scripts/local-scan.ts

import "dotenv/config";
import dns from "dns/promises";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import {
  normalizeRedditPermalink,
  type ProjectKeywords,
  type ScannablePost,
  upsertScannedPost,
  withDbRetry,
} from "./scan-helpers.js";

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

  const projects = await withDbRetry(
    () =>
      prisma.project.findMany({
        where: { enabled: true },
        include: { subreddits: { where: { enabled: true } } },
      }),
    "load enabled projects"
  );

  console.log(`Found ${projects.length} projects`);

  let totalFound = 0;
  let totalUpdated = 0;
  let totalCrossposts = 0;

  for (const project of projects) {
    try {
      const dbKeywords = await withDbRetry(
        () =>
          prisma.keywordFilter.findMany({
            where: { projectId: project.id, enabled: true },
          }),
        `load keywords for ${project.name}`
      );

      const contextualSubs = new Set(
        project.subreddits.filter((s: any) => s.contextual).map((s: any) => s.name.toLowerCase())
      );
      const keywords: ProjectKeywords = {
        global: dbKeywords.filter(k => k.isGlobal).map(k => k.keyword.toLowerCase()),
        contextual: dbKeywords.filter(k => !k.isGlobal).map(k => k.keyword.toLowerCase()),
        contextualSubs,
      };

      if (keywords.global.length === 0 && keywords.contextual.length === 0) {
        console.log(`  ${project.name}: no keywords, skipping`);
        continue;
      }

      let projectFound = 0;
      let projectUpdated = 0;
      let projectCrossposts = 0;

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

          for (const post of posts as ScannablePost[]) {
            const result = await upsertScannedPost(prisma, {
              projectId: project.id,
              subredditTargetId: sub.id,
              subredditName: sub.name,
              post,
              keywords,
            });

            if (result.action === "created") projectFound++;
            if (result.action === "updated") projectUpdated++;
            if (result.isCrosspost) projectCrossposts++;
          }

          // Small delay to avoid Reddit rate limiting
          await new Promise(r => setTimeout(r, 3000));
        } catch (err) {
          console.error(`  Error scanning r/${sub.name}:`, (err as Error).message);
        }
      }

      totalFound += projectFound;
      totalUpdated += projectUpdated;
      totalCrossposts += projectCrossposts;

      const summary = [
        `  ${project.name}: scanned ${project.subreddits.length} subs`,
        `found ${projectFound} new posts`,
        `refreshed ${projectUpdated} existing posts`,
      ];
      if (projectCrossposts > 0) {
        summary.push(`${projectCrossposts} crossposts`);
      }
      console.log(summary.join(", "));

      // --- Trending: grab hottest posts from each subreddit regardless of keywords ---
      let trendingFound = 0;
      const MIN_TRENDING_SCORE = 50; // Reddit upvotes threshold

      for (const sub of project.subreddits) {
        try {
          const hotPosts = await fetchRedditPosts(sub.name, "hot", 10);

          for (const post of hotPosts) {
            // Only high-engagement posts
            if (post.score < MIN_TRENDING_SCORE) continue;

            const existing = await withDbRetry(
              () =>
                prisma.monitoredPost.findUnique({
                  where: { redditId_projectId: { redditId: post.name, projectId: project.id } },
                }),
              `find trending post ${post.name}`
            );
            if (existing?.status === "trending") {
              await withDbRetry(
                () =>
                  prisma.monitoredPost.update({
                    where: { id: existing.id },
                    data: {
                      subreddit: post.subreddit,
                      title: post.title,
                      selftext: post.selftext || "",
                      author: post.author,
                      url: post.url,
                      permalink: normalizeRedditPermalink(post.permalink),
                      score: post.score,
                      numComments: post.num_comments,
                      createdUtc: new Date(post.created_utc * 1000),
                      fetchedAt: new Date(),
                    },
                  }),
                `refresh trending post ${post.name}`
              );
              continue;
            }

            // If it already exists as a keyword-matched post, skip (don't overwrite)
            if (existing) continue;

            await withDbRetry(
              () =>
                prisma.monitoredPost.create({
                  data: {
                    redditId: post.name,
                    subreddit: post.subreddit,
                    title: post.title,
                    selftext: post.selftext || "",
                    author: post.author,
                    url: post.url,
                    permalink: normalizeRedditPermalink(post.permalink),
                    score: post.score,
                    numComments: post.num_comments,
                    createdUtc: new Date(post.created_utc * 1000),
                    relevanceScore: 0, // not keyword-matched
                    matchedKeywords: "",
                    projectId: project.id,
                    subredditTargetId: sub.id,
                    status: "trending",
                  },
                }),
              `create trending post ${post.name}`
            );
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
      await withDbRetry(
        () =>
          prisma.monitoredPost.deleteMany({
            where: {
              projectId: project.id,
              status: "trending",
              createdUtc: { lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
            },
          }),
        `delete old trending posts for ${project.name}`
      );
    } catch (error) {
      console.error(`  ${project.name}: project-level scan failed:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log(
    `\n[${new Date().toISOString()}] Done — ${totalFound} new posts, ${totalUpdated} refreshed, ${totalCrossposts} crossposts`
  );
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
