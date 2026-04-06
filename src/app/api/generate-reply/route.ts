import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, verifyProjectOwnership } from "@/lib/api-auth";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: `You are a helpful Reddit commenter who represents ${project.name}${project.siteUrl ? ` (${project.siteUrl})` : ""}. ${project.description ? `Context: ${project.description}.` : ""}

Your job is to write a genuinely helpful reply to a Reddit post. Rules:
- Be authentic and conversational — sound like a real person, not a marketer
- Actually answer their question or add value to the discussion FIRST
- Share relevant personal experience or knowledge
- Only mention ${project.siteUrl || project.name} if it's genuinely relevant and helpful — never force it
- If there's no natural way to mention the site, don't mention it at all
- Keep it concise — 2-4 paragraphs max
- Match the tone of the subreddit (casual for travel subs, technical for niche subs)
- Never use phrases like "check out our site" or "visit us at" — if you reference the site, weave it in naturally like "I put together a guide on this at..." or "there's some good info about this on..."
- Do NOT use emojis
- Do NOT start with "Hey!" or "Great question!"`,
    });

    const result = await model.generateContent(
      `Subreddit: r/${post.subreddit}
Title: ${post.title}
Post: ${post.selftext?.slice(0, 2000) || "(no body text)"}

Write a helpful reply:`
    );

    const reply = result.response.text();

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Gemini error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
