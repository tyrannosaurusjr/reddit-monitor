import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSubredditPosts } from "@/lib/reddit";
import { getKeywords, calculateRelevance } from "@/lib/keywords";

// This endpoint is called by the cron scheduler to poll subreddits
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "redditreach-cron";

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subreddits = await prisma.subredditTarget.findMany({
    where: { enabled: true },
  });

  const keywords = await getKeywords();
  let totalFound = 0;

  for (const sub of subreddits) {
    try {
      const posts = await fetchSubredditPosts(sub.name, "new", 25);

      for (const post of posts) {
        const existing = await prisma.monitoredPost.findUnique({
          where: { redditId: post.name },
        });
        if (existing) continue;

        const { score, matched } = calculateRelevance(post.title, post.selftext, keywords);
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
            subredditTargetId: sub.id,
          },
        });
        totalFound++;
      }
    } catch (err) {
      console.error(`Cron poll error for r/${sub.name}:`, err);
    }
  }

  return NextResponse.json({ scanned: subreddits.length, found: totalFound });
}
