import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postComment } from "@/lib/reddit";
import { authenticateRequest } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { replyId } = await req.json();

  const reply = await prisma.draftReply.findUnique({
    where: { id: replyId },
    include: {
      post: true,
      project: { select: { userId: true } },
    },
  });

  if (!reply || reply.project.userId !== auth.userId) {
    return NextResponse.json({ error: "Reply not found" }, { status: 404 });
  }

  try {
    const result = await postComment(reply.post.redditId, reply.content);

    await prisma.draftReply.update({
      where: { id: replyId },
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

    return NextResponse.json({ success: true, commentId: result.name });
  } catch (error) {
    await prisma.draftReply.update({
      where: { id: replyId },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to post" },
      { status: 500 }
    );
  }
}
