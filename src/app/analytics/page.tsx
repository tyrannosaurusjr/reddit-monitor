"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, TrendingUp, Clock, Zap } from "lucide-react";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number): string {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

interface HeatmapCell {
  dayOfWeek: number;
  hourUtc: number;
  avgScore: number;
  avgComments: number;
  totalPosts?: number;
}

interface BestWindow {
  dayOfWeek: number;
  hourUtc: number;
  engagementScore: number;
}

interface SubredditAnalytics {
  subreddit: string;
  heatmap: HeatmapCell[];
  bestWindows: BestWindow[];
  lastSampled: string | null;
}

interface AggregatedAnalytics {
  heatmap: (HeatmapCell & { totalPosts: number })[];
  bestWindows: BestWindow[];
  subredditBreakdown: SubredditAnalytics[];
}

function HeatmapGrid({ heatmap, bestWindows }: { heatmap: HeatmapCell[]; bestWindows: BestWindow[] }) {
  // Build a lookup map
  const lookup = new Map<string, HeatmapCell>();
  let maxEngagement = 0;

  for (const cell of heatmap) {
    const key = `${cell.dayOfWeek}-${cell.hourUtc}`;
    lookup.set(key, cell);
    const engagement = cell.avgScore * 0.3 + cell.avgComments * 0.7;
    if (engagement > maxEngagement) maxEngagement = engagement;
  }

  // Best window keys for highlighting
  const bestKeys = new Set(bestWindows.map((w) => `${w.dayOfWeek}-${w.hourUtc}`));

  function cellColor(engagement: number, isBest: boolean): string {
    if (maxEngagement === 0) return "bg-gray-50";
    const ratio = engagement / maxEngagement;
    if (isBest) return "bg-orange-500 text-white";
    if (ratio > 0.75) return "bg-orange-200";
    if (ratio > 0.5) return "bg-orange-100";
    if (ratio > 0.25) return "bg-orange-50";
    return "bg-gray-50";
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Hour labels */}
        <div className="flex gap-px mb-1 ml-12">
          {HOURS.filter((h) => h % 3 === 0).map((h) => (
            <div
              key={h}
              className="text-[10px] text-gray-400 text-center"
              style={{ width: `${(3 / 24) * 100}%` }}
            >
              {formatHour(h)}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {DAY_NAMES.map((day, dayIdx) => (
          <div key={day} className="flex items-center gap-px mb-px">
            <div className="w-12 text-xs text-gray-500 text-right pr-2 shrink-0">
              {day}
            </div>
            <div className="flex-1 flex gap-px">
              {HOURS.map((hour) => {
                const key = `${dayIdx}-${hour}`;
                const cell = lookup.get(key);
                const engagement = cell
                  ? cell.avgScore * 0.3 + cell.avgComments * 0.7
                  : 0;
                const isBest = bestKeys.has(key);

                return (
                  <div
                    key={hour}
                    className={`flex-1 h-7 rounded-sm ${cellColor(engagement, isBest)} transition-colors cursor-default`}
                    title={
                      cell
                        ? `${day} ${formatHour(hour)} UTC — Score: ${cell.avgScore.toFixed(1)}, Comments: ${cell.avgComments.toFixed(1)}${isBest ? " ★ BEST" : ""}`
                        : `${day} ${formatHour(hour)} UTC — No data`
                    }
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-3 mt-3 ml-12 text-[10px] text-gray-400">
          <span>Low</span>
          <div className="flex gap-px">
            <div className="w-4 h-3 rounded-sm bg-gray-50" />
            <div className="w-4 h-3 rounded-sm bg-orange-50" />
            <div className="w-4 h-3 rounded-sm bg-orange-100" />
            <div className="w-4 h-3 rounded-sm bg-orange-200" />
            <div className="w-4 h-3 rounded-sm bg-orange-500" />
          </div>
          <span>High</span>
          <span className="ml-2">★ = Best window</span>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AggregatedAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [sampling, setSampling] = useState(false);
  const [samplingResult, setSamplingResult] = useState<string | null>(null);

  const fetchAnalytics = () => {
    setLoading(true);
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAnalytics(); }, []);

  const runSampling = async () => {
    setSampling(true);
    setSamplingResult(null);
    try {
      const res = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      setSamplingResult(result.message || "Sampling complete");
      fetchAnalytics();
    } catch {
      setSamplingResult("Sampling failed");
    } finally {
      setSampling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  const hasData = data && data.heatmap.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
          <p className="text-gray-500 text-sm mt-1">
            Best-time engagement analysis across your monitored subreddits
          </p>
        </div>
        <Button onClick={runSampling} disabled={sampling}>
          <RefreshCw className={`h-4 w-4 mr-2 ${sampling ? "animate-spin" : ""}`} />
          {sampling ? "Sampling..." : "Sample Now"}
        </Button>
      </div>

      {samplingResult && (
        <div className="mb-6 p-4 rounded-lg bg-blue-50 text-blue-700 text-sm">
          {samplingResult}
        </div>
      )}

      {!hasData ? (
        <Card>
          <CardContent className="p-12 text-center">
            <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No engagement data yet.</p>
            <p className="text-gray-400 text-sm">
              Click &ldquo;Sample Now&rdquo; to analyze posting patterns, or wait for the cron scheduler to collect data automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Best Windows */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-orange-500" />
                Best Posting Windows
              </CardTitle>
              <CardDescription>
                Top engagement time slots across all monitored subreddits (times in UTC)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {data!.bestWindows.map((w, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border ${i === 0 ? "border-orange-300 bg-orange-50" : "border-gray-100"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {i === 0 && <Badge className="bg-orange-500 text-white text-[10px]">BEST</Badge>}
                      <span className="text-xs text-gray-400">#{i + 1}</span>
                    </div>
                    <p className="font-semibold text-sm">
                      {DAY_NAMES[w.dayOfWeek]} {formatHour(w.hourUtc)} UTC
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Score: {w.engagementScore}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Aggregated Heatmap */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-500" />
                Engagement Heatmap (All Subreddits)
              </CardTitle>
              <CardDescription>
                Darker = higher engagement. Orange star = best posting windows. Hover for details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HeatmapGrid heatmap={data!.heatmap} bestWindows={data!.bestWindows} />
            </CardContent>
          </Card>

          {/* Per-subreddit breakdown */}
          {data!.subredditBreakdown.filter((s) => s.heatmap.length > 0).map((sub) => (
            <Card key={sub.subreddit}>
              <CardHeader>
                <CardTitle className="text-base">
                  r/{sub.subreddit}
                  {sub.lastSampled && (
                    <span className="text-xs text-gray-400 font-normal ml-2">
                      Last sampled: {new Date(sub.lastSampled).toLocaleString()}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3">
                  <div className="flex gap-2 flex-wrap">
                    {sub.bestWindows.slice(0, 3).map((w, i) => (
                      <Badge key={i} variant={i === 0 ? "default" : "secondary"} className="text-xs">
                        {DAY_NAMES[w.dayOfWeek]} {formatHour(w.hourUtc)} UTC — {w.engagementScore}
                      </Badge>
                    ))}
                  </div>
                </div>
                <HeatmapGrid heatmap={sub.heatmap} bestWindows={sub.bestWindows} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
