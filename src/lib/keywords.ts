import { prisma } from "./prisma";

// Japan-specific subreddits where single outdoor keywords are relevant
const JAPAN_SUBREDDITS = new Set([
  "japantravel",
  "japantraveltips",
  "japanlife",
  "japanoutdoors",
  "japanpics",
  "movingtojapan",
  "japan",
]);

export function isJapanSubreddit(subreddit: string): boolean {
  return JAPAN_SUBREDDITS.has(subreddit.toLowerCase());
}

// Get keywords for a specific project
export async function getKeywordsForProject(
  projectId: string
): Promise<{ global: string[]; contextual: string[] }> {
  const dbKeywords = await prisma.keywordFilter.findMany({
    where: { projectId, enabled: true },
  });

  if (dbKeywords.length > 0) {
    return {
      global: dbKeywords.filter((k) => k.isGlobal).map((k) => k.keyword.toLowerCase()),
      contextual: dbKeywords.filter((k) => !k.isGlobal).map((k) => k.keyword.toLowerCase()),
    };
  }

  // No keywords configured — return empty (project must set up its own)
  return { global: [], contextual: [] };
}

// Match whole words/phrases only — "band" won't match "husband"
function matchesWholeWord(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`);
  return regex.test(text);
}

export function calculateRelevance(
  title: string,
  selftext: string,
  keywords: { global: string[]; contextual: string[] },
  subreddit?: string
): { score: number; matched: string[] } {
  const text = `${title} ${selftext}`.toLowerCase();
  const titleLower = title.toLowerCase();
  const matched: string[] = [];
  let score = 0;

  // Global keywords match in any subreddit
  for (const keyword of keywords.global) {
    if (matchesWholeWord(text, keyword)) {
      matched.push(keyword);
      const wordCount = keyword.split(" ").length;
      score += wordCount * 10;
    }
  }

  // Contextual keywords only match in Japan-specific subreddits
  if (subreddit && isJapanSubreddit(subreddit)) {
    for (const keyword of keywords.contextual) {
      if (matchesWholeWord(text, keyword) && !matched.includes(keyword)) {
        matched.push(keyword);
        score += 15;
      }
    }
  }

  // Boost for title matches
  for (const kw of matched) {
    if (matchesWholeWord(titleLower, kw)) {
      score += 15;
    }
  }

  return { score, matched };
}
