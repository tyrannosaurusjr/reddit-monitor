import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, verifyProjectOwnership } from "@/lib/api-auth";
import { checkSubredditLimit } from "@/lib/auth";
import { rescoreProjectPosts } from "@/lib/monitored-posts";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId || !(await verifyProjectOwnership(projectId, auth.userId))) {
    return NextResponse.json({ error: "Invalid project" }, { status: 403 });
  }

  const subreddits = await prisma.subredditTarget.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { posts: true } } },
  });
  return NextResponse.json(subreddits);
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { name, projectId } = await req.json();
  const cleanName = name.replace(/^r\//, "").trim().toLowerCase();

  if (!cleanName || !projectId) {
    return NextResponse.json({ error: "name and projectId are required" }, { status: 400 });
  }

  if (!(await verifyProjectOwnership(projectId, auth.userId))) {
    return NextResponse.json({ error: "Invalid project" }, { status: 403 });
  }

  const canAdd = await checkSubredditLimit(auth.userId, projectId);
  if (!canAdd) {
    return NextResponse.json({ error: "Subreddit limit reached. Upgrade to Pro." }, { status: 403 });
  }

  const existing = await prisma.subredditTarget.findUnique({
    where: { name_projectId: { name: cleanName, projectId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Subreddit already exists in this project" }, { status: 409 });
  }

  const subreddit = await prisma.subredditTarget.create({
    data: { name: cleanName, projectId },
  });
  return NextResponse.json(subreddit, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { id, enabled, contextual } = await req.json();
  const sub = await prisma.subredditTarget.findUnique({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  if (!sub || sub.project.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: { enabled?: boolean; contextual?: boolean } = {};
  if (enabled !== undefined) data.enabled = enabled;
  if (contextual !== undefined) data.contextual = contextual;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes requested" }, { status: 400 });
  }

  const updated = await prisma.subredditTarget.update({ where: { id }, data });

  if (contextual !== undefined) {
    await rescoreProjectPosts(sub.projectId);
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { id } = await req.json();
  const sub = await prisma.subredditTarget.findUnique({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  if (!sub || sub.project.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.subredditTarget.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
