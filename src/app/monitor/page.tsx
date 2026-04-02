"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useProject } from "@/lib/project-context";
import { Plus, Trash2, Radio, RefreshCw, Power, PowerOff } from "lucide-react";

interface Subreddit {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: string;
  _count: { posts: number };
}

export default function MonitorPage() {
  const { activeProject } = useProject();
  const [subreddits, setSubreddits] = useState<Subreddit[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const fetchSubreddits = () => {
    if (!activeProject) return;
    fetch(`/api/subreddits?projectId=${activeProject.id}`)
      .then((r) => r.json())
      .then(setSubreddits)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    fetchSubreddits();
  }, [activeProject]); // eslint-disable-line react-hooks/exhaustive-deps

  const addSubreddit = async () => {
    if (!newName.trim() || !activeProject) return;
    const res = await fetch("/api/subreddits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, projectId: activeProject.id }),
    });
    if (res.ok) {
      setNewName("");
      fetchSubreddits();
    }
  };

  const toggleSubreddit = async (id: string, enabled: boolean) => {
    await fetch("/api/subreddits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled: !enabled }),
    });
    fetchSubreddits();
  };

  const deleteSubreddit = async (id: string) => {
    await fetch("/api/subreddits", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchSubreddits();
  };

  const runScan = async () => {
    if (!activeProject) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/posts/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: activeProject.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setScanResult(`Scanned ${data.scanned} subreddits, found ${data.found} new relevant posts`);
      } else {
        setScanResult(`Error: ${data.error || "Scan failed"}`);
      }
    } catch {
      setScanResult("Network error during scan");
    } finally {
      setScanning(false);
      fetchSubreddits();
    }
  };

  if (!activeProject) {
    return <p className="text-gray-500">Select a project from the sidebar.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Monitor</h2>
          <p className="text-gray-500 text-sm mt-1">
            Manage subreddits for <span className="font-medium">{activeProject.name}</span>
          </p>
        </div>
        <Button onClick={runScan} disabled={scanning}>
          <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning..." : "Scan Now"}
        </Button>
      </div>

      {scanResult && (
        <div className="mb-6 p-4 rounded-lg bg-blue-50 text-blue-700 text-sm">
          {scanResult}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Add Subreddit</CardTitle>
          <CardDescription>Enter a subreddit name to monitor for {activeProject.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex items-center gap-1 flex-1">
              <span className="text-gray-400 text-sm">r/</span>
              <Input
                placeholder="japantravel"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSubreddit()}
              />
            </div>
            <Button onClick={addSubreddit}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monitored Subreddits</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : subreddits.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No subreddits added yet. Add some above to start monitoring.
            </p>
          ) : (
            <div className="space-y-2">
              {subreddits.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <Radio className={`h-4 w-4 ${sub.enabled ? "text-green-500" : "text-gray-300"}`} />
                    <div>
                      <span className="font-medium text-sm">r/{sub.name}</span>
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {sub._count.posts} posts
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleSubreddit(sub.id, sub.enabled)}
                      aria-label={sub.enabled ? `Disable r/${sub.name}` : `Enable r/${sub.name}`}
                    >
                      {sub.enabled ? (
                        <Power className="h-4 w-4 text-green-500" />
                      ) : (
                        <PowerOff className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSubreddit(sub.id)}
                      aria-label={`Delete r/${sub.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
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
