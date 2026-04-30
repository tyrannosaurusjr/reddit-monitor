import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, verifyProjectOwnership } from "@/lib/api-auth";
import { checkKeywordLimit } from "@/lib/auth";
import { rescoreProjectPosts } from "@/lib/monitored-posts";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId || !(await verifyProjectOwnership(projectId, auth.userId))) {
    return NextResponse.json({ error: "Invalid project" }, { status: 403 });
  }

  const keywords = await prisma.keywordFilter.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(keywords);
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { keyword, projectId, isGlobal } = await req.json();
  if (!keyword?.trim() || !projectId) {
    return NextResponse.json({ error: "keyword and projectId are required" }, { status: 400 });
  }

  if (!(await verifyProjectOwnership(projectId, auth.userId))) {
    return NextResponse.json({ error: "Invalid project" }, { status: 403 });
  }

  const canAdd = await checkKeywordLimit(auth.userId, projectId);
  if (!canAdd) {
    return NextResponse.json({ error: "Keyword limit reached. Upgrade to Pro." }, { status: 403 });
  }

  const kw = await prisma.keywordFilter.create({
    data: {
      keyword: keyword.trim().toLowerCase(),
      projectId,
      isGlobal: isGlobal ?? false,
    },
  });
  await rescoreProjectPosts(projectId);
  return NextResponse.json(kw, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { id, enabled } = await req.json();
  const kw = await prisma.keywordFilter.findUnique({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  if (!kw || kw.project.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.keywordFilter.update({ where: { id }, data: { enabled } });
  await rescoreProjectPosts(kw.projectId);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { id } = await req.json();
  const kw = await prisma.keywordFilter.findUnique({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  if (!kw || kw.project.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.keywordFilter.delete({ where: { id } });
  await rescoreProjectPosts(kw.projectId);
  return NextResponse.json({ success: true });
}
