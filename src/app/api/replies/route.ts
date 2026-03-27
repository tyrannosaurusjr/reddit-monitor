import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "draft";

  const where: Record<string, unknown> = {};
  if (status !== "all") where.status = status;

  const replies = await prisma.draftReply.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { post: true },
  });
  return NextResponse.json(replies);
}

export async function POST(req: NextRequest) {
  const { postId, content, scheduledFor } = await req.json();

  if (!postId || !content) {
    return NextResponse.json({ error: "postId and content are required" }, { status: 400 });
  }

  const reply = await prisma.draftReply.create({
    data: {
      postId,
      content,
      status: scheduledFor ? "scheduled" : "draft",
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    },
  });

  // Update post status
  await prisma.monitoredPost.update({
    where: { id: postId },
    data: { status: "queued" },
  });

  return NextResponse.json(reply, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { id, content, status, scheduledFor } = await req.json();

  const data: Record<string, unknown> = {};
  if (content !== undefined) data.content = content;
  if (status !== undefined) data.status = status;
  if (scheduledFor !== undefined) data.scheduledFor = scheduledFor ? new Date(scheduledFor) : null;

  const reply = await prisma.draftReply.update({
    where: { id },
    data,
  });
  return NextResponse.json(reply);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await prisma.draftReply.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
