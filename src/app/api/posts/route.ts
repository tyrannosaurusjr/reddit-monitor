import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "new";
  const subreddit = searchParams.get("subreddit");

  const where: Record<string, unknown> = {};
  if (status !== "all") where.status = status;
  if (subreddit) where.subreddit = subreddit;

  const posts = await prisma.monitoredPost.findMany({
    where,
    orderBy: { relevanceScore: "desc" },
    include: { replies: true },
    take: 100,
  });
  return NextResponse.json(posts);
}

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json();
  const post = await prisma.monitoredPost.update({
    where: { id },
    data: { status },
  });
  return NextResponse.json(post);
}
