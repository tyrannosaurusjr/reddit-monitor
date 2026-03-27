import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const keywords = await prisma.keywordFilter.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(keywords);
}

export async function POST(req: NextRequest) {
  const { keyword } = await req.json();
  if (!keyword?.trim()) {
    return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
  }

  const kw = await prisma.keywordFilter.create({
    data: { keyword: keyword.trim().toLowerCase() },
  });
  return NextResponse.json(kw, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { id, enabled } = await req.json();
  const kw = await prisma.keywordFilter.update({
    where: { id },
    data: { enabled },
  });
  return NextResponse.json(kw);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await prisma.keywordFilter.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
