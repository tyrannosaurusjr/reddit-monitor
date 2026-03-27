import { NextResponse } from "next/server";
import { initCronJobs } from "@/lib/cron";

// Initialize cron jobs when this endpoint is called
// In production, call this once on server startup
export async function POST() {
  initCronJobs();
  return NextResponse.json({ message: "Cron jobs initialized" });
}

export async function GET() {
  initCronJobs();
  return NextResponse.json({ message: "Cron jobs initialized" });
}
