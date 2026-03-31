import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      plan: true,
      isAdmin: true,
      createdAt: true,
      _count: { select: { projects: true } },
    },
  });

  return NextResponse.json(users);
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, plan, isAdmin } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (plan !== undefined) data.plan = plan;
  if (isAdmin !== undefined) data.isAdmin = isAdmin;

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, plan: true, isAdmin: true },
  });

  return NextResponse.json(user);
}
