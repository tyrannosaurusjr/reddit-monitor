import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function getOptimalPostTime(): Date {
  // Default: schedule for next optimal window: 9-11 AM EST on weekdays
  const now = new Date();
  const target = new Date(now);

  // Set to 10 AM EST (15:00 UTC)
  target.setUTCHours(15, 0, 0, 0);

  // If it's already past optimal time today, schedule for tomorrow
  if (target <= now) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  // Skip weekends (use UTC to match the UTC-based scheduling)
  const day = target.getUTCDay();
  if (day === 0) target.setUTCDate(target.getUTCDate() + 1); // Sunday -> Monday
  if (day === 6) target.setUTCDate(target.getUTCDate() + 2); // Saturday -> Monday

  return target;
}

// Build an optimal time from analytics best-window data
export function getOptimalPostTimeFromAnalytics(
  bestWindows: Array<{ dayOfWeek: number; hourUtc: number; engagementScore: number }>
): Date {
  if (bestWindows.length === 0) return getOptimalPostTime();

  const now = new Date();
  const best = bestWindows[0]; // highest engagement window

  // Find the next occurrence of this day/hour
  const target = new Date(now);
  target.setUTCHours(best.hourUtc, 0, 0, 0);

  // Advance to the correct day of week
  const currentDay = target.getUTCDay();
  let daysAhead = best.dayOfWeek - currentDay;
  if (daysAhead < 0) daysAhead += 7;
  if (daysAhead === 0 && target <= now) daysAhead = 7;

  target.setDate(target.getDate() + daysAhead);
  return target;
}
