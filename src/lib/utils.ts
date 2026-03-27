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
  // Schedule for next optimal window: 9-11 AM EST on weekdays
  const now = new Date();
  const target = new Date(now);

  // Set to 10 AM EST (15:00 UTC)
  target.setUTCHours(15, 0, 0, 0);

  // If it's already past optimal time today, schedule for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  // Skip weekends
  const day = target.getDay();
  if (day === 0) target.setDate(target.getDate() + 1); // Sunday -> Monday
  if (day === 6) target.setDate(target.getDate() + 2); // Saturday -> Monday

  return target;
}
