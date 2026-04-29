"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime } from "@/lib/utils";
import { useProject } from "@/lib/project-context";
import {
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit2,
  Trash2,
  ExternalLink,
} from "lucide-react";

interface Reply {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  scheduledFor: string | null;
  postedAt: string | null;
  redditCommentId: string | null;
  errorMessage: string | null;
  staggerDelay: number | null;
  post: {
    id: string;
    title: string;
    subreddit: string;
    permalink: string;
  };
}

export default function RepliesPage() {
  const { activeProject } = useProject();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("draft");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const fetchReplies = (status: string) => {
    if (!activeProject) return;
    setLoading(true);
    fetch(`/api/replies?status=${status}&projectId=${activeProject.id}`)
      .then((r) => r.json())
      .then(setReplies)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReplies(tab); }, [tab, activeProject]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteReply = async (id: string) => {
    await fetch("/api/replies", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchReplies(tab);
  };

  const updateReply = async (id: string, data: Record<string, unknown>) => {
    await fetch("/api/replies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    setEditingId(null);
    fetchReplies(tab);
  };

  const postReplyNow = async (replyId: string) => {
    const res = await fetch("/api/replies/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replyId }),
    });
    if (res.ok) {
      fetchReplies(tab);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "draft": return <Edit2 className="h-4 w-4 text-gray-500" />;
      case "scheduled": return <Clock className="h-4 w-4 text-purple-500" />;
      case "posted": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed": return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "draft": return "secondary" as const;
      case "scheduled": return "default" as const;
      case "posted": return "success" as const;
      case "failed": return "destructive" as const;
      default: return "secondary" as const;
    }
  };

  if (!activeProject) {
    return <p className="text-gray-500">Select a project from the sidebar.</p>;
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Replies</h2>
        <p className="text-gray-500 text-sm mt-1">
          Manage replies for <span className="font-medium">{activeProject.name}</span>
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="posted">Posted</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
          ) : replies.length === 0 ? (
            <Card className="mt-4">
              <CardContent className="p-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <Send className="h-5 w-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-gray-700 font-medium">No {tab} replies yet</p>
                    <p className="text-gray-400 text-sm mt-1">
                      {tab === "draft" && <><Link href="/queue" className="text-orange-600 hover:underline">Head to the Queue</Link> to draft replies to relevant posts.</>}
                      {tab === "scheduled" && "Drafts you schedule will appear here."}
                      {tab === "posted" && "Successfully posted replies show up here."}
                      {tab === "failed" && "No failed replies. That's a good thing!"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4 mt-4">
              {replies.map((reply) => (
                <Card key={reply.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {statusIcon(reply.status)}
                        <a
                          href={reply.post.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-gray-900 hover:text-orange-600 flex items-center gap-1"
                        >
                          {reply.post.title}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          r/{reply.post.subreddit}
                        </Badge>
                        <Badge variant={statusBadgeVariant(reply.status)} className="text-xs">
                          {reply.status}
                        </Badge>
                      </div>
                    </div>

                    {editingId === reply.id ? (
                      <div>
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={4}
                          className="mb-2"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateReply(reply.id, { content: editContent })}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                        {reply.content}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <div className="text-xs text-gray-400">
                        Created {formatRelativeTime(new Date(reply.createdAt))}
                        {reply.scheduledFor && (
                          <> | Scheduled for {new Date(reply.scheduledFor).toLocaleString()}</>
                        )}
                        {reply.staggerDelay != null && reply.staggerDelay > 0 && (
                          <span className="text-purple-500"> | +{reply.staggerDelay}m stagger</span>
                        )}
                        {reply.postedAt && (
                          <> | Posted {formatRelativeTime(new Date(reply.postedAt))}</>
                        )}
                        {reply.errorMessage && (
                          <span className="text-red-500"> | Error: {reply.errorMessage}</span>
                        )}
                      </div>

                      {(reply.status === "draft" || reply.status === "scheduled" || reply.status === "failed") && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Edit reply"
                            onClick={() => {
                              setEditingId(reply.id);
                              setEditContent(reply.content);
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          {(reply.status === "draft" || reply.status === "failed") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Post reply now"
                              onClick={() => postReplyNow(reply.id)}
                            >
                              <Send className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Delete reply"
                            onClick={() => deleteReply(reply.id)}
                          >
                            <Trash2 className="h-3 w-3 text-red-400" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
