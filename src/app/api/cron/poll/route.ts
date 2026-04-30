import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSubredditPosts } from "@/lib/reddit";
import { getKeywordsForProject } from "@/lib/keywords";
import { sampleSubredditEngagement } from "@/lib/analytics";
import { upsertScannedPost } from "@/lib/monitored-posts";

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
  let totalUpdated = 0;
  let crosspostsFound = 0;
  let totalScanned = 0;
  const sampledSubs = new Set<string>();

  for (const project of projects) {
    const keywords = await getKeywordsForProject(project.id);
    if (keywords.global.length === 0 && keywords.contextual.length === 0) {
      continue;
    }

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
          const result = await upsertScannedPost({
            projectId: project.id,
            subredditTargetId: sub.id,
            subredditName: sub.name,
            post,
            keywords,
          });

          if (result.action === "created") totalFound++;
          if (result.action === "updated") totalUpdated++;
          if (result.isCrosspost) crosspostsFound++;
        }
      } catch (err) {
        console.error(`Cron poll error for r/${sub.name} (${project.name}):`, err);
      }
    }
  }

  return NextResponse.json({
    scanned: totalScanned,
    found: totalFound,
    updated: totalUpdated,
    crossposts: crosspostsFound,
  });
}
