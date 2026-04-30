"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useProject } from "@/lib/project-context";
import { Plus, Trash2, Power, PowerOff, FolderPlus } from "lucide-react";

interface Keyword {
  id: string;
  keyword: string;
  enabled: boolean;
  isGlobal: boolean;
}

export default function SettingsPage() {
  const { activeProject, projects, refreshProjects } = useProject();
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywordGlobal, setNewKeywordGlobal] = useState(true);
  const [loading, setLoading] = useState(true);

  // New project form
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", slug: "", siteUrl: "", color: "#f97316" });
  const [newProjectError, setNewProjectError] = useState("");

  const fetchKeywords = () => {
    if (!activeProject) return;
    fetch(`/api/keywords?projectId=${activeProject.id}`)
      .then((r) => r.json())
      .then(setKeywords)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    fetchKeywords();
  }, [activeProject]); // eslint-disable-line react-hooks/exhaustive-deps

  const addKeyword = async () => {
    if (!newKeyword.trim() || !activeProject) return;
    await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: newKeyword,
        projectId: activeProject.id,
        isGlobal: newKeywordGlobal,
      }),
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

  const createProject = async () => {
    if (!newProject.name) { setNewProjectError("Name is required."); return; }
    if (!newProject.slug) { setNewProjectError("Slug is required."); return; }
    setNewProjectError("");
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newProject),
    });
    if (res.ok) {
      setNewProject({ name: "", slug: "", siteUrl: "", color: "#f97316" });
      setShowNewProject(false);
      refreshProjects();
    } else {
      const body = await res.json().catch(() => ({}));
      setNewProjectError(body.error || "Failed to create project.");
    }
  };

  const deleteProject = async (id: string) => {
    await fetch("/api/projects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    refreshProjects();
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-500 text-sm mt-1">
          Manage projects, keywords, and configuration
        </p>
      </div>

      <div className="grid gap-6">
        {/* Projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Projects</CardTitle>
                <CardDescription>Each project targets a different site with its own subreddits and keywords</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowNewProject(!showNewProject)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showNewProject && (
              <div className="mb-4 p-4 border border-dashed border-gray-300 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Name</label>
                    <Input
                      placeholder="JaCamp"
                      value={newProject.name}
                      onChange={(e) => setNewProject((p) => ({
                        ...p,
                        name: e.target.value,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"),
                      }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Site URL</label>
                    <Input
                      placeholder="jacamp.com"
                      value={newProject.siteUrl}
                      onChange={(e) => setNewProject((p) => ({ ...p, siteUrl: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Slug</label>
                    <Input
                      placeholder="jacamp"
                      value={newProject.slug}
                      onChange={(e) => setNewProject((p) => ({ ...p, slug: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={newProject.color}
                        onChange={(e) => setNewProject((p) => ({ ...p, color: e.target.value }))}
                        className="h-9 w-12 rounded border border-gray-200 cursor-pointer"
                      />
                      <Input value={newProject.color} readOnly className="flex-1" />
                    </div>
                  </div>
                </div>
                {newProjectError && (
                  <p className="text-sm text-red-600">{newProjectError}</p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" onClick={createProject}>Create Project</Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowNewProject(false); setNewProjectError(""); }}>Cancel</Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <div>
                      <span className="font-medium text-sm">{project.name}</span>
                      {project.siteUrl && (
                        <span className="text-xs text-gray-400 ml-2">{project.siteUrl}</span>
                      )}
                      <div className="flex gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {project._count?.subreddits || 0} subs
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {project._count?.keywords || 0} keywords
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {project._count?.posts || 0} posts
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteProject(project.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              ))}
              {projects.length === 0 && (
                <p className="text-gray-500 text-sm">No projects yet. Create one above to get started.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Keywords (per project) */}
        {activeProject && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Keywords for {activeProject.name}</CardTitle>
              <CardDescription>
                <strong>Global</strong> keywords match in any subreddit (e.g. &ldquo;camping japan&rdquo;).{" "}
                <strong>Contextual</strong> keywords only match in subreddit targets you mark as contextual on the Monitor page (e.g. &ldquo;hiking&rdquo;).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="e.g., camping japan"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                  className="flex-1"
                />
                <select
                  value={newKeywordGlobal ? "global" : "contextual"}
                  onChange={(e) => setNewKeywordGlobal(e.target.value === "global")}
                  className="border border-gray-200 rounded-lg px-3 text-sm"
                >
                  <option value="global">Global</option>
                  <option value="contextual">Contextual</option>
                </select>
                <Button onClick={addKeyword}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>

              {loading ? (
                <p className="text-gray-500 text-sm">Loading...</p>
              ) : keywords.length === 0 ? (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    No keywords configured for this project. Add keywords above to start matching posts.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {keywords.map((kw) => (
                    <div
                      key={kw.id}
                      className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${kw.enabled ? "text-gray-900" : "text-gray-400 line-through"}`}>
                          {kw.keyword}
                        </span>
                        <Badge variant={kw.isGlobal ? "default" : "outline"} className="text-[10px]">
                          {kw.isGlobal ? "global" : "contextual"}
                        </Badge>
                      </div>
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
        )}

        {/* Info cards */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Smart Scheduling</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-gray-600">
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Default window: Weekdays at <strong>10:00 AM EST</strong></li>
                <li><strong>Stagger:</strong> 8-25 min gap between replies, max 4/hr, random jitter</li>
                <li>Check <strong>Analytics</strong> for data-driven best times per subreddit</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cross-post Detection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-gray-600">
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Uses Reddit&apos;s native crosspost fields + title similarity (85%+ match)</li>
                <li>Queue page warns if another version already has a reply</li>
                <li>Cross-posted items tagged with <strong>Crosspost</strong> badge</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
