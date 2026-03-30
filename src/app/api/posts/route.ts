import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, verifyProjectOwnership } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "new";
  const subreddit = searchParams.get("subreddit");
  const crosspostGroup = searchParams.get("crosspostGroup");
  const projectId = searchParams.get("projectId");

  if (!projectId || !(await verifyProjectOwnership(projectId, auth.userId))) {
    return NextResponse.json({ error: "Invalid project" }, { status: 403 });
  }

  const where: Record<string, unknown> = { projectId };
  if (status !== "all") where.status = status;
  if (subreddit) where.subreddit = subreddit;
  if (crosspostGroup) where.crosspostGroupId = crosspostGroup;

  const posts = await prisma.monitoredPost.findMany({
    where,
    orderBy: { relevanceScore: "desc" },
    include: { replies: true },
    take: 100,
  });
  return NextResponse.json(posts);
}

export async function PATCH(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { id, status } = await req.json();

  const post = await prisma.monitoredPost.findUnique({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  if (!post || post.project.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.monitoredPost.update({ where: { id }, data: { status } });
  return NextResponse.json(updated);
}
