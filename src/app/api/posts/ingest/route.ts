import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKeywordsForProject, calculateRelevance } from "@/lib/keywords";
import { detectCrosspost, RedditPostWithCrosspost } from "@/lib/crosspost";

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
    let skipped = 0;
    let crosspostsFound = 0;

    for (const post of posts) {
      const existing = await prisma.monitoredPost.findUnique({
        where: { redditId_projectId: { redditId: post.name, projectId } },
      });
      if (existing) { skipped++; continue; }

      const { score, matched } = calculateRelevance(post.title, post.selftext, keywords, subredditName);
      if (score === 0) { skipped++; continue; }

      const crosspostInfo = await detectCrosspost(post as unknown as RedditPostWithCrosspost);
      if (crosspostInfo.isCrosspost) crosspostsFound++;

      await prisma.monitoredPost.create({
        data: {
          redditId: post.name,
          subreddit: post.subreddit,
          title: post.title,
          selftext: post.selftext || "",
          author: post.author,
          url: post.url,
          permalink: post.permalink.startsWith("http") ? post.permalink : `https://reddit.com${post.permalink}`,
          score: post.score,
          numComments: post.num_comments,
          createdUtc: new Date(post.created_utc * 1000),
          relevanceScore: score,
          matchedKeywords: matched.join(","),
          projectId,
          subredditTargetId: subredditId || null,
          status: "new",
          isCrosspost: crosspostInfo.isCrosspost,
          crosspostParentId: crosspostInfo.crosspostParentId,
          crosspostGroupId: crosspostInfo.crosspostGroupId,
        },
      });
      found++;
    }

    return NextResponse.json({ found, skipped, crossposts: crosspostsFound });
  } catch (error) {
    console.error("Ingest error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ingest failed" },
      { status: 500 }
    );
  }
}
