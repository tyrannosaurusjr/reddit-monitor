import { prisma } from "./prisma";

// Get keywords for a specific project
export async function getKeywordsForProject(
  projectId: string
): Promise<{ global: string[]; contextual: string[]; contextualSubs: Set<string> }> {
  const [dbKeywords, subreddits] = await Promise.all([
    prisma.keywordFilter.findMany({
      where: { projectId, enabled: true },
    }),
    prisma.subredditTarget.findMany({
      where: { projectId, enabled: true },
      select: { name: true },
    }),
  ]);

  // Contextual keywords match in ANY subreddit that belongs to this project
  const contextualSubs = new Set(subreddits.map((s) => s.name.toLowerCase()));

  if (dbKeywords.length > 0) {
    return {
      global: dbKeywords.filter((k) => k.isGlobal).map((k) => k.keyword.toLowerCase()),
      contextual: dbKeywords.filter((k) => !k.isGlobal).map((k) => k.keyword.toLowerCase()),
      contextualSubs,
    };
  }

  return { global: [], contextual: [], contextualSubs };
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
  keywords: { global: string[]; contextual: string[]; contextualSubs: Set<string> },
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

  // Contextual keywords match in any of this project's own subreddits
  if (subreddit && keywords.contextualSubs.has(subreddit.toLowerCase())) {
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
