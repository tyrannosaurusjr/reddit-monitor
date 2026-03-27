"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { formatRelativeTime, getOptimalPostTime } from "@/lib/utils";
import {
  ExternalLink,
  Send,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from "lucide-react";

interface Post {
  id: string;
  redditId: string;
  subreddit: string;
  title: string;
  selftext: string;
  author: string;
  permalink: string;
  score: number;
  numComments: number;
  createdUtc: string;
  relevanceScore: number;
  matchedKeywords: string;
  status: string;
  replies: Array<{ id: string; status: string }>;
}

export default function QueuePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"new" | "queued" | "all">("new");

  const fetchPosts = useCallback(() => {
    setLoading(true);
    fetch(`/api/posts?status=${filter}`)
      .then((r) => r.json())
      .then(setPosts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const dismissPost = async (id: string) => {
    await fetch("/api/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "dismissed" }),
    });
    fetchPosts();
  };

  const saveReply = async (postId: string, schedule: boolean) => {
    const content = replyContent[postId];
    if (!content?.trim()) return;

    await fetch("/api/replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postId,
        content,
        scheduledFor: schedule ? getOptimalPostTime().toISOString() : undefined,
      }),
    });

    setReplyContent((prev) => ({ ...prev, [postId]: "" }));
    setExpandedPost(null);
    fetchPosts();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Review Queue</h2>
          <p className="text-gray-500 text-sm mt-1">
            Review relevant posts and draft your replies
          </p>
        </div>
        <div className="flex gap-2">
          {(["new", "queued", "all"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No posts in queue. Run a scan from the Monitor page.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">
                        r/{post.subreddit}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        by u/{post.author}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatRelativeTime(new Date(post.createdUtc))}
                      </span>
                    </div>
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-900 hover:text-orange-600 flex items-center gap-1"
                    >
                      {post.title}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-gray-500">
                        Score: {post.score} | Comments: {post.numComments}
                      </span>
                      <Badge
                        variant={post.relevanceScore >= 30 ? "success" : "warning"}
                        className="text-xs"
                      >
                        Relevance: {post.relevanceScore}
                      </Badge>
                      {post.matchedKeywords && (
                        <span className="text-xs text-gray-400">
                          Keywords: {post.matchedKeywords}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setExpandedPost(expandedPost === post.id ? null : post.id)
                      }
                    >
                      {expandedPost === post.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => dismissPost(post.id)}
                      title="Dismiss"
                    >
                      <X className="h-4 w-4 text-gray-400" />
                    </Button>
                  </div>
                </div>

                {expandedPost === post.id && (
                  <div className="mt-4 border-t pt-4">
                    {post.selftext && (
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 max-h-40 overflow-y-auto">
                        {post.selftext}
                      </div>
                    )}
                    <Textarea
                      placeholder="Write your reply... Be helpful and authentic. Naturally reference jacamp.com where relevant."
                      className="mb-3"
                      rows={4}
                      value={replyContent[post.id] || ""}
                      onChange={(e) =>
                        setReplyContent((prev) => ({
                          ...prev,
                          [post.id]: e.target.value,
                        }))
                      }
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveReply(post.id, false)}
                      >
                        <Send className="h-3 w-3 mr-2" />
                        Save Draft
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveReply(post.id, true)}
                      >
                        <Clock className="h-3 w-3 mr-2" />
                        Schedule (Optimal Time)
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
