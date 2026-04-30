import { NextRequest, NextResponse } from "next/server";
import { getKeywordsForProject } from "@/lib/keywords";
import { upsertScannedPost } from "@/lib/monitored-posts";

// Secret to authenticate local scan scripts. Set INGEST_SECRET in .env.
// Without this, anyone could POST arbitrary posts into the DB.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.INGEST_SECRET;
  if (!secret) return false;
  return req.headers.get("x-ingest-secret") === secret;
}

interface IngestPost {
  name: string; // Reddit fullname: "t3_xxx"
  subreddit: string;
  title: string;
  selftext: string;
  author: string;
  url: string;
  permalink: string;
  score: number;
  num_comments: number;
  created_utc: number;
}

interface IngestBody {
  projectId: string;
  subredditId: string;
  subredditName: string;
  posts: IngestPost[];
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: IngestBody = await req.json();
    const { projectId, subredditId, subredditName, posts } = body;

    if (!projectId || !subredditName || !Array.isArray(posts)) {
      return NextResponse.json({ error: "Missing projectId, subredditName, or posts" }, { status: 400 });
    }

    const keywords = await getKeywordsForProject(projectId);
    let found = 0;
    let updated = 0;
    let skipped = 0;
    let crosspostsFound = 0;

    for (const post of posts) {
      const result = await upsertScannedPost({
        projectId,
        subredditTargetId: subredditId || null,
        subredditName,
        post,
        keywords,
      });

      if (result.action === "created") found++;
      else if (result.action === "updated") updated++;
      else skipped++;

      if (result.isCrosspost) crosspostsFound++;
    }

    return NextResponse.json({ found, updated, skipped, crossposts: crosspostsFound });
  } catch (error) {
    console.error("Ingest error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ingest failed" },
      { status: 500 }
    );
  }
}
