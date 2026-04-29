import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, verifyProjectOwnership } from "@/lib/api-auth";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest();
  if ("error" in auth) return auth.error;

  const { postId, projectId } = await req.json();

  if (!postId || !projectId) {
    return NextResponse.json({ error: "postId and projectId required" }, { status: 400 });
  }

  if (!(await verifyProjectOwnership(projectId, auth.userId))) {
    return NextResponse.json({ error: "Invalid project" }, { status: 403 });
  }

  const [post, project] = await Promise.all([
    prisma.monitoredPost.findUnique({ where: { id: postId } }),
    prisma.project.findUnique({ where: { id: projectId } }),
  ]);

  if (!post || !project) {
    return NextResponse.json({ error: "Post or project not found" }, { status: 404 });
  }

  const systemPrompt = `You are a helpful Reddit commenter who represents ${project.name}${project.siteUrl ? ` (${project.siteUrl})` : ""}. ${project.description ? `Context: ${project.description}.` : ""}

Your job is to write a genuinely helpful reply to a Reddit post. Rules:
- Be authentic and conversational — sound like a real person, not a marketer
- Actually answer their question or add value to the discussion FIRST
- Share relevant personal experience or knowledge
- Only mention ${project.siteUrl || project.name} if it's genuinely relevant and helpful — never force it
- If there's no natural way to mention the site, don't mention it at all
- Keep it concise — 2-4 paragraphs max
- Match the tone of the subreddit (casual for travel subs, technical for niche subs)
- Never use phrases like "check out our site" or "visit us at" — if you reference the site, weave it in naturally
- Do NOT use emojis
- Do NOT start with "Hey!" or "Great question!"`;

  const userPrompt = `Subreddit: r/${post.subreddit}
Title: ${post.title}
Post: ${post.selftext?.slice(0, 2000) || "(no body text)"}

Write a helpful reply:`;

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error("Ollama returned an empty response");
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Ollama error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
