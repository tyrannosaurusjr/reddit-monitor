"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { useProject } from "@/lib/project-context";
import Link from "next/link";
import {
  MessageSquare,
  Send,
  Radio,
  TrendingUp,
  Clock,
  AlertCircle,
  ExternalLink,
  Zap,
  ArrowRight,
} from "lucide-react";

interface PostSummary {
  id: string;
  title: string;
  subreddit: string;
  permalink: string;
  relevanceScore: number;
  status: string;
  fetchedAt: string;
  score: number;
  numComments: number;
  matchedKeywords: string;
}

interface TopPost extends PostSummary {
  author: string;
  selftext: string;
  createdUtc: string;
}

interface Stats {
  posts: { total: number; new: number; queued: number; replied: number; dismissed: number };
  replies: { total: number; draft: number; scheduled: number; posted: number; failed: number };
  subredditCount: number;
  recentPosts: PostSummary[];
  topPosts: TopPost[];
}

type RankingFactor = "keywords" | "upvotes" | "comments" | "freshness" | "discussion";

const RANKING_FACTORS: { key: RankingFactor; label: string; description: string }[] = [
  { key: "keywords", label: "Keywords", description: "Keyword match relevance" },
  { key: "upvotes", label: "Upvotes", description: "Reddit score" },
  { key: "comments", label: "Comments", description: "Number of comments" },
  { key: "freshness", label: "Freshness", description: "Newer posts rank higher" },
  { key: "discussion", label: "Discussion", description: "Comment-to-upvote ratio (high = active thread)" },
];

function computeCompositeScore(post: TopPost, factors: Set<RankingFactor>): number {
  let score = 0;

  if (factors.has("keywords")) {
    score += post.relevanceScore;
  }

  if (factors.has("upvotes")) {
    // Logarithmic so a 1000-upvote post doesn't completely dominate
    score += Math.log2(Math.max(post.score, 1) + 1) * 5;
  }

  if (factors.has("comments")) {
    score += Math.log2(Math.max(post.numComments, 1) + 1) * 8;
  }

  if (factors.has("freshness")) {
    const ageHours = (Date.now() - new Date(post.createdUtc).getTime()) / 3600000;
    // Posts < 6 hours old get full boost, decays over 48 hours
    const freshnessBoost = Math.max(0, 20 - (ageHours / 48) * 20);
    score += freshnessBoost;
  }

  if (factors.has("discussion")) {
    // High comments relative to upvotes = active discussion = good outreach opportunity
    if (post.score > 0) {
      const ratio = post.numComments / Math.max(post.score, 1);
      score += Math.min(ratio * 10, 25); // Cap at 25
    }
  }

  return Math.round(score * 10) / 10;
}

export default function DashboardPage() {
  const { activeProject, loading: projectLoading } = useProject();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFactors, setActiveFactors] = useState<Set<RankingFactor>>(
    new Set<RankingFactor>(["keywords", "upvotes", "comments", "freshness"])
  );

  useEffect(() => {
    if (!activeProject) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/stats?projectId=${activeProject.id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeProject]);

  const toggleFactor = (factor: RankingFactor) => {
    setActiveFactors((prev) => {
      const next = new Set(prev);
      if (next.has(factor)) {
        if (next.size > 1) next.delete(factor); // Keep at least one
      } else {
        next.add(factor);
      }
      return next;
    });
  };

  const rankedPosts = useMemo(() => {
    if (!stats?.topPosts) return [];
    return stats.topPosts
      .map((post) => ({
        ...post,
        compositeScore: computeCompositeScore(post, activeFactors),
      }))
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, 3);
  }, [stats?.topPosts, activeFactors]);

  if (projectLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!activeProject) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-gray-500">No projects set up yet. Go to Settings to create one.</p>
        </CardContent>
      </Card>
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
          Overview of Reddit outreach for{" "}
          {activeProject.siteUrl ? (
            <span className="font-medium">{activeProject.siteUrl}</span>
          ) : (
            <span className="font-medium">{activeProject.name}</span>
          )}
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

      {/* Act Now — top ranked posts */}
      {rankedPosts.length > 0 && (
        <Card className="mb-6 border-orange-200 bg-orange-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-orange-500" />
                  Act on These Now
                </CardTitle>
                <p className="text-xs text-gray-500 mt-1">Ranked by your selected factors</p>
              </div>
            </div>
            {/* Ranking factor toggles */}
            <div className="flex gap-1.5 flex-wrap mt-3">
              {RANKING_FACTORS.map((factor) => (
                <button
                  key={factor.key}
                  onClick={() => toggleFactor(factor.key)}
                  title={factor.description}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    activeFactors.has(factor.key)
                      ? "bg-orange-500 text-white"
                      : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {factor.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rankedPosts.map((post, i) => (
                <div
                  key={post.id}
                  className="flex items-start gap-3 p-4 rounded-lg bg-white border border-orange-100 hover:border-orange-300 transition-colors"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold text-sm shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-900 hover:text-orange-600 flex items-center gap-1"
                    >
                      {post.title}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-xs">r/{post.subreddit}</Badge>
                      <span className="text-xs text-gray-400">by u/{post.author}</span>
                      <span className="text-xs text-gray-400">
                        {post.score} pts | {post.numComments} comments
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatRelativeTime(new Date(post.createdUtc))}
                      </span>
                    </div>
                    {post.selftext && (
                      <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">
                        {post.selftext.slice(0, 200)}{post.selftext.length > 200 ? "..." : ""}
                      </p>
                    )}
                    {post.matchedKeywords && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {post.matchedKeywords.split(",").map((kw) => (
                          <Badge key={kw} variant="outline" className="text-[10px] border-orange-200 text-orange-700">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className="bg-orange-500 text-white text-xs">
                      {post.compositeScore}
                    </Badge>
                    <div className="text-[10px] text-gray-400 mt-1 space-y-0.5">
                      {activeFactors.has("keywords") && <div>kw: {post.relevanceScore}</div>}
                      {activeFactors.has("upvotes") && <div>up: {post.score}</div>}
                      {activeFactors.has("comments") && <div>cm: {post.numComments}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/queue">
              <Button variant="outline" size="sm" className="mt-4 w-full">
                View Full Queue
                <ArrowRight className="h-3 w-3 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Recent Discoveries */}
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
                <a
                  key={post.id}
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-colors cursor-pointer block"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1">
                      {post.title}
                      <ExternalLink className="h-3 w-3 text-gray-400 shrink-0" />
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        r/{post.subreddit}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {formatRelativeTime(new Date(post.fetchedAt))}
                      </span>
                      <span className="text-xs text-gray-400">
                        {post.score} pts | {post.numComments} comments
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
                      {post.relevanceScore}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
