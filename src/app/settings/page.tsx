"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Power, PowerOff } from "lucide-react";

interface Keyword {
  id: string;
  keyword: string;
  enabled: boolean;
}

export default function SettingsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchKeywords = () => {
    fetch("/api/keywords")
      .then((r) => r.json())
      .then(setKeywords)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchKeywords(); }, []);

  const addKeyword = async () => {
    if (!newKeyword.trim()) return;
    await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: newKeyword }),
    });
    setNewKeyword("");
    fetchKeywords();
  };

  const toggleKeyword = async (id: string, enabled: boolean) => {
    await fetch("/api/keywords", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled: !enabled }),
    });
    fetchKeywords();
  };

  const deleteKeyword = async (id: string) => {
    await fetch("/api/keywords", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchKeywords();
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-500 text-sm mt-1">
          Configure keyword filters and application settings
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reddit API Configuration</CardTitle>
            <CardDescription>
              Set these environment variables in your .env file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "REDDIT_CLIENT_ID", desc: "Your Reddit app client ID" },
                { name: "REDDIT_CLIENT_SECRET", desc: "Your Reddit app client secret" },
                { name: "REDDIT_USERNAME", desc: "Reddit account username" },
                { name: "REDDIT_PASSWORD", desc: "Reddit account password" },
              ].map((env) => (
                <div key={env.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <code className="text-sm font-mono text-gray-900">{env.name}</code>
                    <p className="text-xs text-gray-500 mt-0.5">{env.desc}</p>
                  </div>
                  <Badge variant={process.env[env.name] ? "success" : "secondary"} className="text-xs">
                    Set in .env
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Keyword Filters</CardTitle>
            <CardDescription>
              Posts matching these keywords will appear in your review queue.
              If no custom keywords are set, default camping-in-Japan keywords are used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="e.g., camping japan"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addKeyword()}
              />
              <Button onClick={addKeyword}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>

            {loading ? (
              <p className="text-gray-500 text-sm">Loading...</p>
            ) : keywords.length === 0 ? (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 font-medium mb-2">Using default keywords:</p>
                <div className="flex flex-wrap gap-1">
                  {[
                    "camping japan", "camp japan", "camping in japan",
                    "japan camping", "tent japan", "campsite japan",
                    "campground japan", "outdoor japan", "backpacking japan",
                    "wild camping japan", "car camping japan", "glamping japan",
                    "fuji camping", "hokkaido camping",
                  ].map((kw) => (
                    <Badge key={kw} variant="outline" className="text-xs">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {keywords.map((kw) => (
                  <div
                    key={kw.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:bg-gray-50"
                  >
                    <span className={`text-sm ${kw.enabled ? "text-gray-900" : "text-gray-400 line-through"}`}>
                      {kw.keyword}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleKeyword(kw.id, kw.enabled)}
                      >
                        {kw.enabled ? (
                          <Power className="h-4 w-4 text-green-500" />
                        ) : (
                          <PowerOff className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteKeyword(kw.id)}
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

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scheduling</CardTitle>
            <CardDescription>
              How reply scheduling works
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-gray-600">
              <p>
                When you schedule a reply, it will be posted at the next optimal time window:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Weekdays at <strong>10:00 AM EST</strong> (peak Reddit activity)</li>
                <li>Replies are posted automatically via the cron scheduler</li>
                <li>You can also post replies immediately from the Replies page</li>
              </ul>
              <p className="text-xs text-gray-400 mt-4">
                The cron scheduler runs every 15 minutes to check for and post scheduled replies.
                Set the CRON_SECRET environment variable for production security.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
