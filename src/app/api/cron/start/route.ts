import { NextRequest, NextResponse } from "next/server";
import { initCronJobs } from "@/lib/cron";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "redditreach-cron";

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  initCronJobs();
  return NextResponse.json({ message: "Cron jobs initialized" });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "redditreach-cron";

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  initCronJobs();
  return NextResponse.json({ message: "Cron jobs initialized" });
}
