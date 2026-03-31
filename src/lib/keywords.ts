import { prisma } from "./prisma";

// Co-occurrence rules for ambiguous keywords
// If an ambiguous keyword is found, check for boost/reject terms
// Boost: increases score (confirms relevance)
// Reject: disqualifies the match (wrong context)
interface CoOccurrenceRule {
  keyword: string;
  boost: string[];   // if any of these also appear, boost the score
  reject: string[];  // if any of these also appear, reject the match
}

// These are defined per-domain. Projects can override via DB in the future.
const CO_OCCURRENCE_RULES: CoOccurrenceRule[] = [
  {
    keyword: "metal",
    boost: [
      "show", "shows", "concert", "gig", "gigs", "live", "tour", "album",
      "song", "songs", "track", "tracks", "band", "bands", "vocalist",
      "guitar", "drummer", "bassist", "riff", "riffs", "mosh", "pit",
      "fest", "festival", "venue", "setlist", "release", "ep", "lp",
      "record", "vinyl", "playlist", "genre", "subgenre", "scene",
      "breakdown", "blast beat", "growl", "scream", "vocals",
      "listen", "listening", "recommend", "recommendation",
    ],
    reject: [
      "shelf", "shelving", "detector", "roofing", "sheet metal",
      "welding", "fabrication", "alloy", "steel", "aluminum",
      "copper", "iron ore", "scrap metal", "precious metal",
      "metal work", "metalwork", "machining", "forging",
    ],
  },
  {
    keyword: "band",
    boost: [
      "show", "shows", "concert", "gig", "live", "tour", "album",
      "song", "music", "guitar", "drummer", "vocalist", "genre",
      "perform", "stage", "venue", "festival", "record", "release",
    ],
    reject: [
      "rubber band", "resistance band", "wrist band", "headband",
      "band aid", "bandwidth", "broadband", "elastic",
    ],
  },
  {
    keyword: "club",
    boost: [
      "dj", "dance", "music", "night", "nightlife", "party",
      "venue", "techno", "house", "edm", "set", "lineup",
    ],
    reject: [
      "golf club", "book club", "fight club", "country club",
      "club sandwich", "membership", "subscribe",
    ],
  },
  {
    keyword: "gig",
    boost: [
      "band", "show", "concert", "venue", "ticket", "stage",
      "perform", "live", "music", "tour", "setlist",
    ],
    reject: [
      "gig economy", "freelance gig", "side gig", "gigabyte",
    ],
  },
  {
    keyword: "record",
    boost: [
      "vinyl", "album", "listen", "music", "shop", "store",
      "spin", "turntable", "pressing", "release", "label",
    ],
    reject: [
      "world record", "record time", "track record", "medical record",
      "criminal record", "on record", "recorded delivery",
    ],
  },
  // Outdoor/camping context
  {
    keyword: "trail",
    boost: [
      "hike", "hiking", "trek", "trekking", "walk", "walking",
      "summit", "mountain", "camp", "camping", "backpack",
    ],
    reject: [
      "paper trail", "audit trail", "trail mix", "trail period",
      "free trial",
    ],
  },
  {
    keyword: "summit",
    boost: [
      "hike", "climb", "mountain", "peak", "trail", "altitude",
      "camp", "tent", "trek", "ridge",
    ],
    reject: [
      "summit meeting", "summit conference", "g7 summit", "g20 summit",
      "business summit", "tech summit",
    ],
  },
  {
    keyword: "camp",
    boost: [
      "tent", "hike", "fire", "campfire", "sleeping bag", "campsite",
      "campground", "outdoor", "trail", "backpack", "nature",
    ],
    reject: [
      "boot camp", "training camp", "camp out", "concentration camp",
      "refugee camp", "band camp", "summer camp", "day camp",
    ],
  },
];

// Build a lookup map for fast access
const ruleMap = new Map<string, CoOccurrenceRule>();
for (const rule of CO_OCCURRENCE_RULES) {
  ruleMap.set(rule.keyword, rule);
}

function checkCoOccurrence(
  text: string,
  keyword: string
): "boost" | "reject" | "neutral" {
  const rule = ruleMap.get(keyword);
  if (!rule) return "neutral";

  // Check reject terms first (stronger signal)
  for (const reject of rule.reject) {
    if (text.includes(reject)) return "reject";
  }

  // Check boost terms
  for (const boost of rule.boost) {
    if (text.includes(boost)) return "boost";
  }

  return "neutral";
}

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

// Match whole words/phrases only
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
      // Multi-word phrases are unambiguous, skip co-occurrence check
      if (keyword.split(" ").length > 1) {
        matched.push(keyword);
        score += keyword.split(" ").length * 10;
        continue;
      }

      // Single-word global keywords get co-occurrence filtering
      const coResult = checkCoOccurrence(text, keyword);
      if (coResult === "reject") continue; // skip this match entirely
      matched.push(keyword);
      score += coResult === "boost" ? 20 : 10; // boosted matches score higher
    }
  }

  // Contextual keywords match in project's own subreddits
  if (subreddit && keywords.contextualSubs.has(subreddit.toLowerCase())) {
    for (const keyword of keywords.contextual) {
      if (matchesWholeWord(text, keyword) && !matched.includes(keyword)) {
        const coResult = checkCoOccurrence(text, keyword);
        if (coResult === "reject") continue;
        matched.push(keyword);
        score += coResult === "boost" ? 25 : 15;
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
