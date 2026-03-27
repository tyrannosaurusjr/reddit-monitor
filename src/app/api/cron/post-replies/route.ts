import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postComment } from "@/lib/reddit";

// Posts scheduled replies that are due
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "redditreach-cron";

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dueReplies = await prisma.draftReply.findMany({
    where: {
      status: "scheduled",
      scheduledFor: { lte: new Date() },
    },
    include: { post: true },
  });

  let posted = 0;
  let failed = 0;

  for (const reply of dueReplies) {
    try {
      const result = await postComment(reply.post.redditId, reply.content);

      await prisma.draftReply.update({
        where: { id: reply.id },
        data: {
          status: "posted",
          postedAt: new Date(),
          redditCommentId: result.name,
        },
      });

      await prisma.monitoredPost.update({
        where: { id: reply.postId },
        data: { status: "replied" },
      });

      posted++;

      // Rate limit: wait 2 seconds between posts
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      await prisma.draftReply.update({
        where: { id: reply.id },
        data: {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });
      failed++;
    }
  }

  return NextResponse.json({ due: dueReplies.length, posted, failed });
}
