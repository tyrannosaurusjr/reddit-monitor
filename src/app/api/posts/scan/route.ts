import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSubredditPosts } from "@/lib/reddit";
import { getKeywordsForProject, calculateRelevance } from "@/lib/keywords";
import { detectCrosspost, RedditPostWithCrosspost } from "@/lib/crosspost";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const projectId = body.projectId;

    // Get projects to scan
    const projects = projectId
      ? await prisma.project.findMany({ where: { id: projectId, enabled: true }, include: { subreddits: { where: { enabled: true } } } })
      : await prisma.project.findMany({ where: { enabled: true }, include: { subreddits: { where: { enabled: true } } } });

    if (projects.length === 0) {
      return NextResponse.json({ message: "No projects configured", scanned: 0, found: 0, crossposts: 0 });
    }

    let totalScanned = 0;
    let totalFound = 0;
    let crosspostsFound = 0;

    for (const project of projects) {
      if (project.subreddits.length === 0) continue;

      const keywords = await getKeywordsForProject(project.id);

      for (const sub of project.subreddits) {
        try {
          const posts = await fetchSubredditPosts(sub.name, "new", 25);
          totalScanned++;

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
                status: "new",
                isCrosspost: crosspostInfo.isCrosspost,
                crosspostParentId: crosspostInfo.crosspostParentId,
                crosspostGroupId: crosspostInfo.crosspostGroupId,
              },
            });
            totalFound++;
          }
        } catch (err) {
          console.error(`Error scanning r/${sub.name} for ${project.name}:`, err);
        }
      }
    }

    return NextResponse.json({
      message: `Scanned ${totalScanned} subreddits across ${projects.length} projects`,
      scanned: totalScanned,
      found: totalFound,
      crossposts: crosspostsFound,
    });
  } catch (error) {
    console.error("Scan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scan failed" },
      { status: 500 }
    );
  }
}
