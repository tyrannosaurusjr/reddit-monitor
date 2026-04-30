import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSubredditPosts } from "@/lib/reddit";
import { getKeywordsForProject } from "@/lib/keywords";
import { upsertScannedPost } from "@/lib/monitored-posts";
import { authenticateRequest, verifyProjectOwnership } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest();
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => ({}));
    const projectId = body.projectId;

    const projects = projectId
      ? await prisma.project.findMany({
          where: { id: projectId, enabled: true, userId: auth.userId },
          include: { subreddits: { where: { enabled: true } } },
        })
      : await prisma.project.findMany({
          where: { enabled: true, userId: auth.userId },
          include: { subreddits: { where: { enabled: true } } },
        });

    if (projectId && !(await verifyProjectOwnership(projectId, auth.userId))) {
      return NextResponse.json({ error: "Invalid project" }, { status: 403 });
    }

    if (projects.length === 0) {
      return NextResponse.json(
        { error: "No enabled projects found. The project may be disabled or not exist.", scanned: 0, found: 0 },
        { status: 400 }
      );
    }

    let totalScanned = 0;
    let totalFound = 0;
    let totalUpdated = 0;
    let crosspostsFound = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const project of projects) {
      if (project.subreddits.length === 0) {
        warnings.push(`"${project.name}" has no enabled subreddits — go to Monitor and enable at least one.`);
        continue;
      }

      const keywords = await getKeywordsForProject(project.id);
      if (keywords.global.length === 0 && keywords.contextual.length === 0) {
        warnings.push(`"${project.name}" has no keywords configured — go to Settings and add keywords so posts can be matched.`);
        continue;
      }

      for (const sub of project.subreddits) {
        try {
          const posts = await fetchSubredditPosts(sub.name, "new", 25);
          totalScanned++;

          for (const post of posts) {
            const result = await upsertScannedPost({
              projectId: project.id,
              subredditTargetId: sub.id,
              subredditName: sub.name,
              post,
              keywords,
            });

            if (result.action === "created") totalFound++;
            if (result.action === "updated") totalUpdated++;
            if (result.isCrosspost) crosspostsFound++;
          }
        } catch (err) {
          const msg = `r/${sub.name}: ${err instanceof Error ? err.message : String(err)}`;
          console.error(`Error scanning ${msg} for ${project.name}`);
          errors.push(msg);
        }
      }
    }

    return NextResponse.json({
      message: `Scanned ${totalScanned} subreddits across ${projects.length} projects`,
      scanned: totalScanned,
      found: totalFound,
      updated: totalUpdated,
      crossposts: crosspostsFound,
      ...(warnings.length > 0 && { warnings }),
      ...(errors.length > 0 && { errors }),
    });
  } catch (error) {
    console.error("Scan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scan failed" },
      { status: 500 }
    );
  }
}
