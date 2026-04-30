// Scan a single project: npx tsx scripts/scan-single.ts proj_jj
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import {
  calculateRelevance,
  type ProjectKeywords,
  type ScannablePost,
  upsertScannedPost,
} from "./scan-helpers.js";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});
const prisma = new PrismaClient({ adapter });

const projectId = process.argv[2];
if (!projectId) { console.error("Usage: npx tsx scripts/scan-single.ts <projectId>"); process.exit(1); }

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
  const keywords: ProjectKeywords = {
    global: globals,
    contextual: contextuals,
    contextualSubs,
  };

  console.log(`Scanning ${project.name}: ${project.subreddits.length} subs, ${globals.length} global + ${contextuals.length} contextual keywords`);

  let found = 0;
  let updated = 0;

  for (const sub of project.subreddits) {
    for (const sortConfig of [{ sort: "new", time: "" }, { sort: "top", time: "week" }]) {
      try {
        let url = `https://www.reddit.com/r/${sub.name}/${sortConfig.sort}.json?limit=25`;
        if (sortConfig.time) url += `&t=${sortConfig.time}`;

        const res = await fetch(url, { headers: { "User-Agent": "RedditReach/1.0.0" } });
        if (!res.ok) { console.log(`  Skip r/${sub.name} ${sortConfig.sort}: ${res.status}`); continue; }

        const data = await res.json();
        const posts = data.data.children.map((c: any) => c.data);

        for (const post of posts as ScannablePost[]) {
          const { score } = calculateRelevance(
            post.title,
            post.selftext || "",
            keywords,
            sub.name
          );

          const result = await upsertScannedPost(prisma, {
            projectId,
            subredditTargetId: sub.id,
            subredditName: sub.name,
            post,
            keywords,
          });

          if (result.action === "created") {
            found++;
            console.log(`  [${score}] new r/${post.subreddit}: ${post.title.slice(0, 70)}`);
          } else if (result.action === "updated") {
            updated++;
            console.log(`  [${score}] refreshed r/${post.subreddit}: ${post.title.slice(0, 70)}`);
          }
        }

        // Reddit allows ~30 requests/min — wait 3 seconds between requests
        await new Promise(r => setTimeout(r, 3000));
      } catch (err) {
        console.log(`  Error r/${sub.name} ${sortConfig.sort}:`, (err as Error).message);
      }
    }
  }

  console.log(`\nDone — ${found} new posts, ${updated} refreshed for ${project.name}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
