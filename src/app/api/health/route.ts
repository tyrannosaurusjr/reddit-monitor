import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Test DB connection
    const count = await prisma.user.count();
    return NextResponse.json({
      status: "ok",
      db: "connected",
      users: count,
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        hasDbToken: !!process.env.DATABASE_AUTH_TOKEN,
        dbUrlPrefix: process.env.DATABASE_URL?.substring(0, 30),
      },
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      db: "failed",
      error: error instanceof Error ? error.message : String(error),
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        hasDbToken: !!process.env.DATABASE_AUTH_TOKEN,
        dbUrlPrefix: process.env.DATABASE_URL?.substring(0, 30),
      },
    }, { status: 500 });
  }
}
