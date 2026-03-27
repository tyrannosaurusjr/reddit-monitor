"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import {
  MessageSquare,
  Send,
  Radio,
  TrendingUp,
  Clock,
  AlertCircle,
} from "lucide-react";

interface Stats {
  posts: { total: number; new: number; queued: number; replied: number; dismissed: number };
  replies: { total: number; draft: number; scheduled: number; posted: number; failed: number };
  subredditCount: number;
  recentPosts: Array<{
    id: string;
    title: string;
    subreddit: string;
    relevanceScore: number;
    status: string;
    fetchedAt: string;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!stats) return <p className="text-gray-500">Failed to load stats.</p>;

  const statCards = [
    { label: "New Posts", value: stats.posts.new, icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Queued", value: stats.posts.queued, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "Replies Sent", value: stats.replies.posted, icon: Send, color: "text-green-600", bg: "bg-green-50" },
    { label: "Scheduled", value: stats.replies.scheduled, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Subreddits", value: stats.subredditCount, icon: Radio, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Failed", value: stats.replies.failed, icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 text-sm mt-1">
          Overview of your Reddit outreach for jacamp.com
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{s.label}</p>
                  <p className="text-3xl font-bold mt-1">{s.value}</p>
                </div>
                <div className={`${s.bg} p-3 rounded-lg`}>
                  <s.icon className={`h-6 w-6 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Discoveries</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentPosts.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No posts found yet. Add subreddits and run a scan from the Monitor page.
            </p>
          ) : (
            <div className="space-y-3">
              {stats.recentPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {post.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        r/{post.subreddit}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {formatRelativeTime(new Date(post.fetchedAt))}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Badge
                      variant={
                        post.status === "new"
                          ? "default"
                          : post.status === "replied"
                          ? "success"
                          : "secondary"
                      }
                    >
                      {post.status}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      Score: {post.relevanceScore}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
