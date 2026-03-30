import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Test DB connection
    const count = await prisma.user.count();
    const projects = await prisma.project.findMany({
      where: { enabled: true },
      include: { subreddits: { where: { enabled: true } } },
    });

    // Also test the exact cron query
    let cronDebug;
    try {
      const cronProjects = await prisma.project.findMany({
        where: { enabled: true },
        include: { subreddits: { where: { enabled: true } } },
      });
      cronDebug = { count: cronProjects.length, names: cronProjects.map(p => p.name), subCounts: cronProjects.map(p => p.subreddits.length) };
    } catch (e) {
      cronDebug = { error: e instanceof Error ? e.message : String(e) };
    }

    // Test Reddit public API
    let redditTest;
    try {
      const res = await fetch("https://www.reddit.com/r/japantravel/new.json?limit=1", {
        headers: { "User-Agent": "RedditReach/1.0.0" },
      });
      redditTest = { status: res.status, ok: res.ok };
    } catch (e) {
      redditTest = { error: e instanceof Error ? e.message : String(e) };
    }
    return NextResponse.json({
      status: "ok",
      db: "connected",
      users: count,
      projects: projects.map(p => ({ id: p.id, name: p.name, subs: p.subreddits.length })),
      cronDebug,
      redditTest,
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
