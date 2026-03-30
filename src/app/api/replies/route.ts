import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getNextStaggeredTime } from "@/lib/stagger";
import { authenticateRequest, verifyProjectOwnership } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "draft";
  const projectId = searchParams.get("projectId");

  if (!projectId || !(await verifyProjectOwnership(projectId, auth.userId))) {
    return NextResponse.json({ error: "Invalid project" }, { status: 403 });
  }

  const where: Record<string, unknown> = { projectId };
  if (status !== "all") where.status = status;

  const replies = await prisma.draftReply.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { post: true },
  });
  return NextResponse.json(replies);
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { postId, content, scheduledFor, projectId } = await req.json();

  if (!postId || !content || !projectId) {
    return NextResponse.json({ error: "postId, content, and projectId are required" }, { status: 400 });
  }

  if (!(await verifyProjectOwnership(projectId, auth.userId))) {
    return NextResponse.json({ error: "Invalid project" }, { status: 403 });
  }

  let finalScheduledFor: Date | null = null;
  let staggerDelay: number | null = null;

  if (scheduledFor) {
    const baseTime = new Date(scheduledFor);
    finalScheduledFor = await getNextStaggeredTime(baseTime);
    staggerDelay = Math.round((finalScheduledFor.getTime() - baseTime.getTime()) / 60000);
  }

  const reply = await prisma.draftReply.create({
    data: {
      postId,
      projectId,
      content,
      status: finalScheduledFor ? "scheduled" : "draft",
      scheduledFor: finalScheduledFor,
      staggerDelay,
    },
  });

  await prisma.monitoredPost.update({
    where: { id: postId },
    data: { status: "queued" },
  });

  return NextResponse.json(reply, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { id, content, status, scheduledFor } = await req.json();

  const reply = await prisma.draftReply.findUnique({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  if (!reply || reply.project.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (content !== undefined) data.content = content;
  if (status !== undefined) data.status = status;
  if (scheduledFor !== undefined) data.scheduledFor = scheduledFor ? new Date(scheduledFor) : null;

  const updated = await prisma.draftReply.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { id } = await req.json();
  const reply = await prisma.draftReply.findUnique({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  if (!reply || reply.project.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.draftReply.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
