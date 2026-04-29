import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const projects = await prisma.project.findMany({
    include: {
      subreddits: { select: { name: true, enabled: true } },
      keywords: { where: { enabled: true }, select: { keyword: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const redditCheck = await fetch("https://www.reddit.com/r/japantravel/new.json?limit=1", {
    headers: { "User-Agent": "RedditReach/1.0.0" },
  }).then((r) => ({ status: r.status, ok: r.ok })).catch((e) => ({ status: 0, ok: false, error: String(e) }));

  const report = {
    timestamp: new Date().toISOString(),
    redditApiReachable: redditCheck,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      enabled: p.enabled,
      subredditsTotal: p.subreddits.length,
      subredditsEnabled: p.subreddits.filter((s) => s.enabled).length,
      subredditsDisabled: p.subreddits.filter((s) => !s.enabled).map((s) => s.name),
      keywordsEnabled: p.keywords.length,
      scanReady: p.enabled && p.subreddits.some((s) => s.enabled) && p.keywords.length > 0,
    })),
    activeProjectId: projectId,
  };

  return new NextResponse(JSON.stringify(report, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}
