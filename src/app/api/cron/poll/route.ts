import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSubredditPosts } from "@/lib/reddit";
import { getKeywordsForProject, calculateRelevance } from "@/lib/keywords";
import { detectCrosspost, RedditPostWithCrosspost } from "@/lib/crosspost";
import { sampleSubredditEngagement } from "@/lib/analytics";

// This endpoint is called by the cron scheduler to poll subreddits
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "redditreach-cron";

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { enabled: true },
    include: { subreddits: { where: { enabled: true } } },
  });

  let totalFound = 0;
  let crosspostsFound = 0;
  let totalScanned = 0;
  const sampledSubs = new Set<string>();

  for (const project of projects) {
    const keywords = await getKeywordsForProject(project.id);

    for (const sub of project.subreddits) {
      try {
        const posts = await fetchSubredditPosts(sub.name, "new", 25);
        totalScanned++;

        // Sample engagement data (once per subreddit across all projects)
        if (!sampledSubs.has(sub.name)) {
          try {
            await sampleSubredditEngagement(sub.name);
            sampledSubs.add(sub.name);
          } catch (err) {
            console.error(`Engagement sampling error for r/${sub.name}:`, err);
          }
        }

        for (const post of posts) {
          const existing = await prisma.monitoredPost.findUnique({
            where: { redditId_projectId: { redditId: post.name, projectId: project.id } },
          });
          if (existing) continue;

          const { score, matched } = calculateRelevance(post.title, post.selftext, keywords, sub.name);
          if (score === 0) continue;

          const crosspostInfo = await detectCrosspost(post as RedditPostWithCrosspost);
          if (crosspostInfo.isCrosspost) crosspostsFound++;

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
              isCrosspost: crosspostInfo.isCrosspost,
              crosspostParentId: crosspostInfo.crosspostParentId,
              crosspostGroupId: crosspostInfo.crosspostGroupId,
            },
          });
          totalFound++;
        }
      } catch (err) {
        console.error(`Cron poll error for r/${sub.name} (${project.name}):`, err);
      }
    }
  }

  return NextResponse.json({ scanned: totalScanned, found: totalFound, crossposts: crosspostsFound });
}
