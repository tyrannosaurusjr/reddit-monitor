import { prisma } from "./prisma";
import { fetchSubredditPosts, RedditPost } from "./reddit";

interface HourlyBucket {
  dayOfWeek: number;
  hourUtc: number;
  avgScore: number;
  avgComments: number;
  postCount: number;
}

export interface SubredditAnalytics {
  subreddit: string;
  heatmap: HourlyBucket[];
  bestWindows: Array<{
    dayOfWeek: number;
    hourUtc: number;
    engagementScore: number;
  }>;
  lastSampled: Date | null;
}

// Analyze posts to build hourly engagement buckets
function buildHourlyBuckets(posts: RedditPost[]): Map<string, { scores: number[]; comments: number[] }> {
  const buckets = new Map<string, { scores: number[]; comments: number[] }>();

  for (const post of posts) {
    const date = new Date(post.created_utc * 1000);
    const day = date.getUTCDay();
    const hour = date.getUTCHours();
    const key = `${day}-${hour}`;

    if (!buckets.has(key)) {
      buckets.set(key, { scores: [], comments: [] });
    }
    const bucket = buckets.get(key)!;
    bucket.scores.push(post.score);
    bucket.comments.push(post.num_comments);
  }

  return buckets;
}

// Fetch recent posts from a subreddit and compute engagement patterns
export async function sampleSubredditEngagement(subreddit: string): Promise<void> {
  // Fetch hot posts (these represent what's getting engagement)
  const hotPosts = await fetchSubredditPosts(subreddit, "hot", 25);
  // Also fetch new posts for a fuller picture
  const newPosts = await fetchSubredditPosts(subreddit, "new", 25);

  const allPosts = [...hotPosts, ...newPosts];
  // Deduplicate by ID
  const seen = new Set<string>();
  const unique = allPosts.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  const buckets = buildHourlyBuckets(unique);

  const bucketEntries = Array.from(buckets.entries());
  for (const [key, data] of bucketEntries) {
    const [dayStr, hourStr] = key.split("-");
    const dayOfWeek = parseInt(dayStr);
    const hourUtc = parseInt(hourStr);

    const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
    const avgComments = data.comments.reduce((a, b) => a + b, 0) / data.comments.length;

    await prisma.engagementSnapshot.upsert({
      where: {
        subreddit_dayOfWeek_hourUtc: { subreddit, dayOfWeek, hourUtc },
      },
      update: {
        avgScore: Math.round(avgScore * 100) / 100,
        avgComments: Math.round(avgComments * 100) / 100,
        postCount: data.scores.length,
        sampledAt: new Date(),
      },
      create: {
        subreddit,
        dayOfWeek,
        hourUtc,
        avgScore: Math.round(avgScore * 100) / 100,
        avgComments: Math.round(avgComments * 100) / 100,
        postCount: data.scores.length,
      },
    });
  }
}

// Get the full analytics for a subreddit
export async function getSubredditAnalytics(subreddit: string): Promise<SubredditAnalytics> {
  const snapshots = await prisma.engagementSnapshot.findMany({
    where: { subreddit },
    orderBy: [{ dayOfWeek: "asc" }, { hourUtc: "asc" }],
  });

  const heatmap: HourlyBucket[] = snapshots.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    hourUtc: s.hourUtc,
    avgScore: s.avgScore,
    avgComments: s.avgComments,
    postCount: s.postCount,
  }));

  // Rank windows by combined engagement score (weighted: comments matter more for outreach)
  const ranked = heatmap
    .map((h) => ({
      dayOfWeek: h.dayOfWeek,
      hourUtc: h.hourUtc,
      engagementScore: Math.round((h.avgScore * 0.3 + h.avgComments * 0.7) * 100) / 100,
    }))
    .sort((a, b) => b.engagementScore - a.engagementScore);

  const lastSnapshot = snapshots.length > 0
    ? snapshots.reduce((latest, s) => (s.sampledAt > latest.sampledAt ? s : latest)).sampledAt
    : null;

  return {
    subreddit,
    heatmap,
    bestWindows: ranked.slice(0, 5),
    lastSampled: lastSnapshot,
  };
}

// Get aggregated analytics across all monitored subreddits
export async function getAggregatedAnalytics(): Promise<{
  heatmap: Array<{ dayOfWeek: number; hourUtc: number; avgScore: number; avgComments: number; totalPosts: number }>;
  bestWindows: Array<{ dayOfWeek: number; hourUtc: number; engagementScore: number }>;
  subredditBreakdown: SubredditAnalytics[];
}> {
  const subreddits = await prisma.subredditTarget.findMany({
    where: { enabled: true },
  });

  const subredditBreakdown: SubredditAnalytics[] = [];
  for (const sub of subreddits) {
    subredditBreakdown.push(await getSubredditAnalytics(sub.name));
  }

  // Aggregate across all subreddits
  const aggregated = new Map<string, { scores: number[]; comments: number[]; posts: number }>();

  for (const analytics of subredditBreakdown) {
    for (const bucket of analytics.heatmap) {
      const key = `${bucket.dayOfWeek}-${bucket.hourUtc}`;
      if (!aggregated.has(key)) {
        aggregated.set(key, { scores: [], comments: [], posts: 0 });
      }
      const agg = aggregated.get(key)!;
      agg.scores.push(bucket.avgScore);
      agg.comments.push(bucket.avgComments);
      agg.posts += bucket.postCount;
    }
  }

  const aggEntries = Array.from(aggregated.entries());
  const heatmap = aggEntries.map(([key, data]) => {
    const [dayStr, hourStr] = key.split("-");
    return {
      dayOfWeek: parseInt(dayStr),
      hourUtc: parseInt(hourStr),
      avgScore: Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 100) / 100,
      avgComments: Math.round((data.comments.reduce((a, b) => a + b, 0) / data.comments.length) * 100) / 100,
      totalPosts: data.posts,
    };
  }).sort((a, b) => a.dayOfWeek * 24 + a.hourUtc - (b.dayOfWeek * 24 + b.hourUtc));

  const bestWindows = heatmap
    .map((h) => ({
      dayOfWeek: h.dayOfWeek,
      hourUtc: h.hourUtc,
      engagementScore: Math.round((h.avgScore * 0.3 + h.avgComments * 0.7) * 100) / 100,
    }))
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, 5);

  return { heatmap, bestWindows, subredditBreakdown };
}

// Day name helper
export function dayName(day: number): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day];
}

// Format hour as readable time
export function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}
