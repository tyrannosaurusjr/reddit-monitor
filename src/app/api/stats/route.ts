import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
  ] = await Promise.all([
    prisma.monitoredPost.count(),
    prisma.monitoredPost.count({ where: { status: "new" } }),
    prisma.monitoredPost.count({ where: { status: "queued" } }),
    prisma.monitoredPost.count({ where: { status: "replied" } }),
    prisma.monitoredPost.count({ where: { status: "dismissed" } }),
    prisma.draftReply.count(),
    prisma.draftReply.count({ where: { status: "draft" } }),
    prisma.draftReply.count({ where: { status: "scheduled" } }),
    prisma.draftReply.count({ where: { status: "posted" } }),
    prisma.draftReply.count({ where: { status: "failed" } }),
    prisma.subredditTarget.count({ where: { enabled: true } }),
    prisma.monitoredPost.findMany({
      orderBy: { fetchedAt: "desc" },
      take: 5,
      select: { id: true, title: true, subreddit: true, relevanceScore: true, status: true, fetchedAt: true },
    }),
  ]);

  return NextResponse.json({
    posts: { total: totalPosts, new: newPosts, queued: queuedPosts, replied: repliedPosts, dismissed: dismissedPosts },
    replies: { total: totalReplies, draft: draftReplies, scheduled: scheduledReplies, posted: postedReplies, failed: failedReplies },
    subredditCount,
    recentPosts,
  });
}
