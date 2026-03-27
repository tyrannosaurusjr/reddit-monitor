import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSubredditPosts } from "@/lib/reddit";
import { getKeywords, calculateRelevance } from "@/lib/keywords";

export async function POST() {
  try {
    const subreddits = await prisma.subredditTarget.findMany({
      where: { enabled: true },
    });

    if (subreddits.length === 0) {
      return NextResponse.json({ message: "No subreddits configured", scanned: 0, found: 0 });
    }

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
              status: "new",
            },
          });
          totalFound++;
        }
      } catch (err) {
        console.error(`Error scanning r/${sub.name}:`, err);
      }
    }

    return NextResponse.json({
      message: `Scanned ${subreddits.length} subreddits`,
      scanned: subreddits.length,
      found: totalFound,
    });
  } catch (error) {
    console.error("Scan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scan failed" },
      { status: 500 }
    );
  }
}
