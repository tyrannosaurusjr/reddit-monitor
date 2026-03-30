import { NextRequest, NextResponse } from "next/server";
import { getAggregatedAnalytics, getSubredditAnalytics, sampleSubredditEngagement } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";

// GET — fetch analytics data
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const subreddit = searchParams.get("subreddit");

  if (subreddit) {
    const analytics = await getSubredditAnalytics(subreddit);
    return NextResponse.json(analytics);
  }

  const aggregated = await getAggregatedAnalytics();
  return NextResponse.json(aggregated);
}

// POST — trigger a fresh sample of engagement data
export async function POST(req: NextRequest) {
  const { subreddit } = await req.json();

  try {
    if (subreddit) {
      await sampleSubredditEngagement(subreddit);
      return NextResponse.json({ message: `Sampled r/${subreddit}` });
    }

    // Sample all enabled subreddits
    const subs = await prisma.subredditTarget.findMany({ where: { enabled: true } });
    for (const sub of subs) {
      await sampleSubredditEngagement(sub.name);
    }
    return NextResponse.json({ message: `Sampled ${subs.length} subreddits` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sampling failed" },
      { status: 500 }
    );
  }
}
