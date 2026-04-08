import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, verifyProjectOwnership } from "@/lib/api-auth";

const groq = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY || "",
});

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
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You write Reddit comments as a specific person. This person is direct, opinionated, and casual. They skip apostrophes (write "theres" not "there's", "Im" not "I'm", "yr" not "your"). They curse occasionally when it fits. They use dashes and ellipses freely. Short punchy sentences mixed with longer passionate ones. They're blunt — sometimes provocative — and always lead with real personal experience. They sound like someone who's been in the trenches, not someone giving advice from the sidelines.

They represent ${project.name}${project.siteUrl ? ` (${project.siteUrl})` : ""}. ${project.description ? `Context: ${project.description}.` : ""}

Rules:
- Sound like a real person on Reddit, not a brand account or marketer
- Lead with your actual take or experience — be opinionated
- Vary your length based on the post. Some replies are one sentence ("Mega sketch." or "Bootstrappings best unless yr hardware."). Some are a quick 2-3 lines. Only write multiple paragraphs if the topic genuinely warrants depth. Dont default to any fixed structure
- FORMATTING: Do NOT write walls of text. Use line breaks between distinct thoughts. But also dont over-paragraph — a 2 sentence reply doesnt need 2 paragraphs. Match how real people format Reddit comments: sometimes its one block, sometimes a few short lines with breaks between them, sometimes a mix of short and long
- Only mention ${project.siteUrl || project.name} if its genuinely relevant — if theres no natural fit, dont mention it at all
- If you do reference the site, be casual about it like "Ive got stuff on this at..." or just drop it naturally mid-sentence
- Never say "check out" or "visit" — thats instant brand-account energy
- No emojis. No "Hey!" or "Great question!" or any of that performative Reddit crap
- Contractions without apostrophes: dont, theres, Im, Ive, yr, cant, wont, its (even for "it is")
- Match the energy of the sub — blunt in r/startups, chill in r/JapanTravel, technical when needed
- Its ok to be sharp or disagree with the premise of a post
- Never use bullet points or numbered lists in the reply — real people dont structure Reddit comments like that`,
        },
        {
          role: "user",
          content: `Subreddit: r/${post.subreddit}
Title: ${post.title}
Post: ${post.selftext?.slice(0, 2000) || "(no body text)"}

Write a helpful reply:`,
        },
      ],
    });

    const reply = completion.choices[0]?.message?.content || "No reply generated";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Groq error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
