// Scan a single project: npx tsx scripts/scan-single.ts proj_jj
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});
const prisma = new PrismaClient({ adapter });

const projectId = process.argv[2];
if (!projectId) { console.error("Usage: npx tsx scripts/scan-single.ts <projectId>"); process.exit(1); }

function matchesWholeWord(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

async function main() {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { subreddits: { where: { enabled: true } } },
  });
  if (!project) { console.error("Project not found:", projectId); process.exit(1); }

  const dbKeywords = await prisma.keywordFilter.findMany({
    where: { projectId, enabled: true },
  });
  const globals = dbKeywords.filter(k => k.isGlobal).map(k => k.keyword.toLowerCase());
  const contextuals = dbKeywords.filter(k => !k.isGlobal).map(k => k.keyword.toLowerCase());
  const contextualSubs = new Set(
    project.subreddits.filter((s: any) => s.contextual).map((s: any) => s.name.toLowerCase())
  );

  console.log(`Scanning ${project.name}: ${project.subreddits.length} subs, ${globals.length} global + ${contextuals.length} contextual keywords`);

  let found = 0;

  for (const sub of project.subreddits) {
    for (const sortConfig of [{ sort: "new", time: "" }, { sort: "top", time: "week" }]) {
      try {
        let url = `https://www.reddit.com/r/${sub.name}/${sortConfig.sort}.json?limit=25`;
        if (sortConfig.time) url += `&t=${sortConfig.time}`;

        const res = await fetch(url, { headers: { "User-Agent": "RedditReach/1.0.0" } });
        if (!res.ok) { console.log(`  Skip r/${sub.name} ${sortConfig.sort}: ${res.status}`); continue; }

        const data = await res.json();
        const posts = data.data.children.map((c: any) => c.data);

        for (const post of posts) {
          const text = `${post.title} ${post.selftext || ""}`.toLowerCase();
          const titleLower = post.title.toLowerCase();
          const matched: string[] = [];
          let score = 0;

          for (const kw of globals) {
            if (matchesWholeWord(text, kw)) {
              matched.push(kw);
              score += kw.split(" ").length * 10;
            }
          }

          if (contextualSubs.has(sub.name.toLowerCase())) {
            for (const kw of contextuals) {
              if (!matched.includes(kw) && matchesWholeWord(text, kw)) {
                matched.push(kw);
                score += 15;
              }
            }
          }

          if (score === 0) continue;

          // Title boost
          for (const kw of matched) {
            if (matchesWholeWord(titleLower, kw)) score += 15;
          }

          try {
            await prisma.monitoredPost.create({
              data: {
                redditId: post.name, subreddit: post.subreddit, title: post.title,
                selftext: post.selftext || "", author: post.author, url: post.url,
                permalink: `https://reddit.com${post.permalink}`,
                score: post.score, numComments: post.num_comments,
                createdUtc: new Date(post.created_utc * 1000),
                relevanceScore: score, matchedKeywords: matched.join(","),
                projectId, subredditTargetId: sub.id, status: "new",
              },
            });
            found++;
            console.log(`  [${score}] r/${post.subreddit}: ${post.title.slice(0, 70)}`);
          } catch { /* duplicate */ }
        }

        // Reddit allows ~30 requests/min — wait 3 seconds between requests
        await new Promise(r => setTimeout(r, 3000));
      } catch (err) {
        console.log(`  Error r/${sub.name} ${sortConfig.sort}:`, (err as Error).message);
      }
    }
  }

  console.log(`\nDone — ${found} posts found for ${project.name}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
