import { NextRequest, NextResponse } from "next/server";
import { staggerReplies, getNextStaggeredTime, getStaggerConfig } from "@/lib/stagger";
import { getOptimalPostTime } from "@/lib/utils";

// POST — schedule replies with staggered timing
export async function POST(req: NextRequest) {
  const { replyIds, startTime } = await req.json();

  if (!replyIds || !Array.isArray(replyIds) || replyIds.length === 0) {
    return NextResponse.json({ error: "replyIds array is required" }, { status: 400 });
  }

  const base = startTime ? new Date(startTime) : getOptimalPostTime();
  const results = await staggerReplies(replyIds, base);

  return NextResponse.json({
    scheduled: results.length,
    results,
    config: getStaggerConfig(),
  });
}

// GET — preview next staggered time slot
export async function GET() {
  const baseTime = getOptimalPostTime();
  const nextSlot = await getNextStaggeredTime(baseTime);
  const config = getStaggerConfig();

  return NextResponse.json({
    baseTime,
    nextSlot,
    config,
  });
}
