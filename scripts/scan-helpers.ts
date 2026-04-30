export interface ProjectKeywords {
  global: string[];
  contextual: string[];
  contextualSubs: Set<string>;
}

export interface ScannablePost {
  name: string;
  subreddit: string;
  title: string;
  selftext?: string;
  author: string;
  url: string;
  permalink: string;
  score: number;
  num_comments: number;
  created_utc: number;
  crosspost_parent?: string;
}

type PrismaLike = any;

function isRetryableDbError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return [
    "ENOTFOUND",
    "ETIMEDOUT",
    "fetch failed",
    "terminated",
    "DriverAdapterError",
  ].some((needle) => message.includes(needle));
}

export async function withDbRetry<T>(operation: () => Promise<T>, label: string): Promise<T> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableDbError(error) || attempt === maxAttempts) {
        throw error;
      }

      const waitMs = attempt * 1500;
      console.warn(`[db retry] ${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${waitMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw new Error(`Unreachable retry state for ${label}`);
}

const CO_OCCURRENCE_RULES: Record<string, { boost: string[]; reject: string[] }> = {
  metal: {
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
  band: {
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
  club: {
    boost: [
      "dj", "dance", "music", "night", "nightlife", "party",
      "venue", "techno", "house", "edm", "set", "lineup",
    ],
    reject: [
      "golf club", "book club", "fight club", "country club",
      "club sandwich", "membership", "subscribe",
    ],
  },
  gig: {
    boost: [
      "band", "show", "concert", "venue", "ticket", "stage",
      "perform", "live", "music", "tour", "setlist",
    ],
    reject: [
      "gig economy", "freelance gig", "side gig", "gigabyte",
    ],
  },
  record: {
    boost: [
      "vinyl", "album", "listen", "music", "shop", "store",
      "spin", "turntable", "pressing", "release", "label",
    ],
    reject: [
      "world record", "record time", "track record", "medical record",
      "criminal record", "on record", "recorded delivery",
    ],
  },
  trail: {
    boost: [
      "hike", "hiking", "trek", "trekking", "walk", "walking",
      "summit", "mountain", "camp", "camping", "backpack",
    ],
    reject: [
      "paper trail", "audit trail", "trail mix", "trail period",
      "free trial",
    ],
  },
  summit: {
    boost: [
      "hike", "climb", "mountain", "peak", "trail", "altitude",
      "camp", "tent", "trek", "ridge",
    ],
    reject: [
      "summit meeting", "summit conference", "g7 summit", "g20 summit",
      "business summit", "tech summit",
    ],
  },
  camp: {
    boost: [
      "tent", "hike", "fire", "campfire", "sleeping bag", "campsite",
      "campground", "outdoor", "trail", "backpack", "nature",
    ],
    reject: [
      "boot camp", "training camp", "camp out", "concentration camp",
      "refugee camp", "band camp", "summer camp", "day camp",
    ],
  },
};

function matchesWholeWord(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

function checkCoOccurrence(text: string, keyword: string): "boost" | "reject" | "neutral" {
  const rule = CO_OCCURRENCE_RULES[keyword];
  if (!rule) return "neutral";

  for (const reject of rule.reject) {
    if (text.includes(reject)) return "reject";
  }

  for (const boost of rule.boost) {
    if (text.includes(boost)) return "boost";
  }

  return "neutral";
}

export function calculateRelevance(
  title: string,
  selftext: string,
  keywords: ProjectKeywords,
  subreddit?: string
): { score: number; matched: string[] } {
  const text = `${title} ${selftext}`.toLowerCase();
  const titleLower = title.toLowerCase();
  const matched: string[] = [];
  let score = 0;

  for (const keyword of keywords.global) {
    if (matchesWholeWord(text, keyword)) {
      if (keyword.split(" ").length > 1) {
        matched.push(keyword);
        score += keyword.split(" ").length * 10;
        continue;
      }

      const coResult = checkCoOccurrence(text, keyword);
      if (coResult === "reject") continue;

      matched.push(keyword);
      score += coResult === "boost" ? 20 : 10;
    }
  }

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

  for (const keyword of matched) {
    if (matchesWholeWord(titleLower, keyword)) {
      score += 15;
    }
  }

  return { score, matched };
}

export function normalizeRedditPermalink(permalink: string): string {
  return permalink.startsWith("http") ? permalink : `https://reddit.com${permalink}`;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleSimilarity(a: string, b: string): number {
  const normA = normalizeTitle(a);
  const normB = normalizeTitle(b);

  if (normA === normB) return 1;

  const wordsA = normA.split(" ");
  const wordsB = new Set(normB.split(" "));
  const wordsASet = new Set(wordsA);
  const intersection = wordsA.filter((word) => wordsB.has(word));
  const union = new Set(wordsA);
  wordsB.forEach((word) => union.add(word));

  if (union.size === 0) return 0;
  return new Set(intersection).size / union.size;
}

async function detectCrosspost(
  prisma: PrismaLike,
  post: ScannablePost
): Promise<{
  isCrosspost: boolean;
  crosspostParentId: string | null;
  crosspostGroupId: string | null;
}> {
  if (post.crosspost_parent) {
    const parentId = post.crosspost_parent;

    const parent: any = await withDbRetry(
      () =>
        prisma.monitoredPost.findFirst({
          where: { redditId: parentId },
        }),
      "find crosspost parent"
    );

    const groupId = parent?.crosspostGroupId || parentId;

    if (parent && !parent.crosspostGroupId) {
      await withDbRetry(
        () =>
          prisma.monitoredPost.update({
            where: { id: parent.id },
            data: { crosspostGroupId: groupId },
          }),
        "update crosspost parent group"
      );
    }

    return {
      isCrosspost: true,
      crosspostParentId: parentId,
      crosspostGroupId: groupId,
    };
  }

  const recentPosts: any[] = await withDbRetry(
    () =>
      prisma.monitoredPost.findMany({
        where: {
          subreddit: { not: post.subreddit },
          createdUtc: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { redditId: true, title: true, crosspostGroupId: true, author: true },
      }),
    "find recent posts for crosspost detection"
  );

  for (const existing of recentPosts) {
    const similarity = titleSimilarity(post.title, existing.title);

    if (similarity >= 0.85 || (similarity >= 0.7 && post.author === existing.author)) {
      const groupId = existing.crosspostGroupId || existing.redditId;

      if (!existing.crosspostGroupId) {
        await withDbRetry(
          () =>
            prisma.monitoredPost.updateMany({
              where: { redditId: existing.redditId },
              data: { crosspostGroupId: groupId },
            }),
          "update matched crosspost group"
        );
      }

      return {
        isCrosspost: true,
        crosspostParentId: existing.redditId,
        crosspostGroupId: groupId,
      };
    }
  }

  return {
    isCrosspost: false,
    crosspostParentId: null,
    crosspostGroupId: null,
  };
}

export async function upsertScannedPost(
  prisma: PrismaLike,
  params: {
    projectId: string;
    subredditTargetId?: string | null;
    subredditName: string;
    post: ScannablePost;
    keywords: ProjectKeywords;
  }
): Promise<{
  action: "created" | "updated" | "skipped";
  isCrosspost: boolean;
  promotedTrending: boolean;
}> {
  const { projectId, subredditTargetId, subredditName, post, keywords } = params;
  const selftext = post.selftext || "";
  const { score, matched } = calculateRelevance(post.title, selftext, keywords, subredditName);

  const existing: any = await withDbRetry(
    () =>
      prisma.monitoredPost.findUnique({
        where: { redditId_projectId: { redditId: post.name, projectId } },
        select: {
          id: true,
          status: true,
          subredditTargetId: true,
        },
      }),
    "find existing monitored post"
  );

  if (!existing && score === 0) {
    return { action: "skipped", isCrosspost: false, promotedTrending: false };
  }

  const crosspostInfo = await detectCrosspost(prisma, post);
  const baseData = {
    subreddit: post.subreddit,
    title: post.title,
    selftext,
    author: post.author,
    url: post.url,
    permalink: normalizeRedditPermalink(post.permalink),
    score: post.score,
    numComments: post.num_comments,
    createdUtc: new Date(post.created_utc * 1000),
    fetchedAt: new Date(),
    relevanceScore: score,
    matchedKeywords: matched.join(","),
    subredditTargetId: subredditTargetId ?? existing?.subredditTargetId ?? null,
    isCrosspost: crosspostInfo.isCrosspost,
    crosspostParentId: crosspostInfo.crosspostParentId,
    crosspostGroupId: crosspostInfo.crosspostGroupId,
  };

  if (existing) {
    const promotedTrending = existing.status === "trending" && score > 0;

    await withDbRetry(
      () =>
        prisma.monitoredPost.update({
          where: { id: existing.id },
          data: {
            ...baseData,
            ...(promotedTrending ? { status: "new" } : {}),
          },
        }),
      "update monitored post"
    );

    return {
      action: "updated",
      isCrosspost: crosspostInfo.isCrosspost,
      promotedTrending,
    };
  }

  await withDbRetry(
    () =>
      prisma.monitoredPost.create({
        data: {
          redditId: post.name,
          projectId,
          status: "new",
          ...baseData,
        },
      }),
    "create monitored post"
  );

  return {
    action: "created",
    isCrosspost: crosspostInfo.isCrosspost,
    promotedTrending: false,
  };
}
