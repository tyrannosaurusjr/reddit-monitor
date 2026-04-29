import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, verifyProjectOwnership } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId || !(await verifyProjectOwnership(projectId, auth.userId))) {
    return NextResponse.json({ error: "Invalid project" }, { status: 403 });
  }

  const postWhere = { projectId };
  const replyWhere = { projectId };
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalPosts,
    newPosts,
    queuedPosts,
    repliedPosts,
    dismissedPosts,
    totalReplies,
    draftReplies,
    scheduledReplies,
    postedReplies,
    failedReplies,
    subredditCount,
    recentPosts,
    topPosts,
    trendingPosts,
  ] = await Promise.all([
    prisma.monitoredPost.count({ where: postWhere }),
    prisma.monitoredPost.count({ where: { ...postWhere, status: "new" } }),
    prisma.monitoredPost.count({ where: { ...postWhere, status: "queued" } }),
    prisma.monitoredPost.count({ where: { ...postWhere, status: "replied" } }),
    prisma.monitoredPost.count({ where: { ...postWhere, status: "dismissed" } }),
    prisma.draftReply.count({ where: replyWhere }),
    prisma.draftReply.count({ where: { ...replyWhere, status: "draft" } }),
    prisma.draftReply.count({ where: { ...replyWhere, status: "scheduled" } }),
    prisma.draftReply.count({ where: { ...replyWhere, status: "posted" } }),
    prisma.draftReply.count({ where: { ...replyWhere, status: "failed" } }),
    prisma.subredditTarget.count({ where: { projectId, enabled: true } }),
    prisma.monitoredPost.findMany({
      where: postWhere,
      orderBy: { fetchedAt: "desc" },
      take: 5,
      select: { id: true, title: true, subreddit: true, permalink: true, relevanceScore: true, status: true, fetchedAt: true, score: true, numComments: true, matchedKeywords: true },
    }),
    prisma.monitoredPost.findMany({
      where: { ...postWhere, status: "new", createdUtc: { gte: sevenDaysAgo } },
      orderBy: { relevanceScore: "desc" },
      take: 50,
      select: { id: true, title: true, subreddit: true, permalink: true, relevanceScore: true, status: true, fetchedAt: true, createdUtc: true, score: true, numComments: true, matchedKeywords: true, author: true, selftext: true },
    }),
    // Trending: hottest posts across monitored subreddits (no keyword match required)
    prisma.monitoredPost.findMany({
      where: { ...postWhere, status: "trending", createdUtc: { gte: sevenDaysAgo } },
      orderBy: { score: "desc" },
      take: 10,
      select: { id: true, title: true, subreddit: true, permalink: true, score: true, numComments: true, author: true, selftext: true, createdUtc: true, fetchedAt: true },
    }),
  ]);

  return NextResponse.json({
    posts: { total: totalPosts, new: newPosts, queued: queuedPosts, replied: repliedPosts, dismissed: dismissedPosts },
    replies: { total: totalReplies, draft: draftReplies, scheduled: scheduledReplies, posted: postedReplies, failed: failedReplies },
    subredditCount,
    recentPosts,
    topPosts,
    trendingPosts,
  });
}
