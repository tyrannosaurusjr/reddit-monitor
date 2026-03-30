import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { checkProjectLimit } from "@/lib/auth";

export async function GET() {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const projects = await prisma.project.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: { subreddits: true, keywords: true, posts: true, replies: true },
      },
    },
  });
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { name, slug, siteUrl, description, color } = await req.json();
  if (!name || !slug) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }

  const canCreate = await checkProjectLimit(auth.userId);
  if (!canCreate) {
    return NextResponse.json({ error: "Project limit reached. Upgrade to Pro for more projects." }, { status: 403 });
  }

  const project = await prisma.project.create({
    data: {
      name,
      slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, ""),
      siteUrl: siteUrl || "",
      description: description || "",
      color: color || "#f97316",
      userId: auth.userId,
    },
  });
  return NextResponse.json(project, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { id, ...data } = await req.json();

  // Verify ownership
  const project = await prisma.project.findFirst({ where: { id, userId: auth.userId } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.project.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { id } = await req.json();
  const project = await prisma.project.findFirst({ where: { id, userId: auth.userId } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
