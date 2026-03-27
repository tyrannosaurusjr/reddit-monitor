import { prisma } from "./prisma";

const DEFAULT_KEYWORDS = [
  "camping japan",
  "camp japan",
  "camping in japan",
  "japan camping",
  "japanese camping",
  "tent japan",
  "campsite japan",
  "campground japan",
  "outdoor japan",
  "backpacking japan",
  "hiking japan camp",
  "wild camping japan",
  "car camping japan",
  "glamping japan",
  "fuji camping",
  "hokkaido camping",
];

export async function getKeywords(): Promise<string[]> {
  const dbKeywords = await prisma.keywordFilter.findMany({
    where: { enabled: true },
  });

  if (dbKeywords.length > 0) {
    return dbKeywords.map((k) => k.keyword.toLowerCase());
  }

  return DEFAULT_KEYWORDS;
}

export function calculateRelevance(
  title: string,
  selftext: string,
  keywords: string[]
): { score: number; matched: string[] } {
  const text = `${title} ${selftext}`.toLowerCase();
  const matched: string[] = [];
  let score = 0;

  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      matched.push(keyword);
      // Multi-word keywords are more specific, so score higher
      const wordCount = keyword.split(" ").length;
      score += wordCount * 10;
    }
  }

  // Boost for title matches (more visible/relevant)
  for (const keyword of keywords) {
    if (title.toLowerCase().includes(keyword)) {
      score += 15;
    }
  }

  return { score, matched };
}
