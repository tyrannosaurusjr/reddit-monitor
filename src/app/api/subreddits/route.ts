import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const subreddits = await prisma.subredditTarget.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { posts: true } } },
  });
  return NextResponse.json(subreddits);
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  const cleanName = name.replace(/^r\//, "").trim().toLowerCase();

  if (!cleanName) {
    return NextResponse.json({ error: "Subreddit name is required" }, { status: 400 });
  }

  const existing = await prisma.subredditTarget.findUnique({ where: { name: cleanName } });
  if (existing) {
    return NextResponse.json({ error: "Subreddit already exists" }, { status: 409 });
  }

  const subreddit = await prisma.subredditTarget.create({
    data: { name: cleanName },
  });
  return NextResponse.json(subreddit, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { id, enabled } = await req.json();
  const subreddit = await prisma.subredditTarget.update({
    where: { id },
    data: { enabled },
  });
  return NextResponse.json(subreddit);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await prisma.subredditTarget.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
