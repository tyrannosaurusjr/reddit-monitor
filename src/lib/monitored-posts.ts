import { prisma } from "./prisma";
import { calculateRelevance, getKeywordsForProject, type ProjectKeywords } from "./keywords";
import { detectCrosspost, type RedditPostWithCrosspost } from "./crosspost";

const ACTIVE_REPLY_STATUSES = new Set(["draft", "scheduled", "failed"]);

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
}

export function normalizeRedditPermalink(permalink: string): string {
  return permalink.startsWith("http") ? permalink : `https://reddit.com${permalink}`;
}

export function deriveMonitoredPostStatus(currentStatus: string, replyStatuses: string[]): string {
  if (replyStatuses.includes("posted")) {
    return "replied";
  }

  if (replyStatuses.some((status) => ACTIVE_REPLY_STATUSES.has(status))) {
    return "queued";
  }

  if (currentStatus === "dismissed") {
    return "dismissed";
  }

  return "new";
}

export async function syncMonitoredPostStatus(postId: string): Promise<void> {
  const post = await prisma.monitoredPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      status: true,
      replies: { select: { status: true } },
    },
  });

  if (!post) return;

  const nextStatus = deriveMonitoredPostStatus(
    post.status,
    post.replies.map((reply) => reply.status)
  );

  if (nextStatus !== post.status) {
    await prisma.monitoredPost.update({
      where: { id: postId },
      data: { status: nextStatus },
    });
  }
}

export async function rescoreProjectPosts(projectId: string): Promise<void> {
  const keywords = await getKeywordsForProject(projectId);
  const posts = await prisma.monitoredPost.findMany({
    where: { projectId },
    select: {
      id: true,
      title: true,
      selftext: true,
      subreddit: true,
      status: true,
      relevanceScore: true,
      matchedKeywords: true,
    },
  });

  for (const post of posts) {
    const { score, matched } = calculateRelevance(
      post.title,
      post.selftext,
      keywords,
      post.subreddit
    );

    const matchedKeywords = matched.join(",");
    const nextStatus = post.status === "trending" && score > 0 ? "new" : post.status;

    if (
      post.relevanceScore !== score ||
      post.matchedKeywords !== matchedKeywords ||
      post.status !== nextStatus
    ) {
      await prisma.monitoredPost.update({
        where: { id: post.id },
        data: {
          relevanceScore: score,
          matchedKeywords,
          status: nextStatus,
        },
      });
    }
  }
}

export async function upsertScannedPost(params: {
  projectId: string;
  subredditTargetId?: string | null;
  subredditName: string;
  post: ScannablePost;
  keywords: ProjectKeywords;
}): Promise<{
  action: "created" | "updated" | "skipped";
  isCrosspost: boolean;
  promotedTrending: boolean;
}> {
  const { projectId, subredditTargetId, subredditName, post, keywords } = params;
  const selftext = post.selftext || "";
  const { score, matched } = calculateRelevance(post.title, selftext, keywords, subredditName);

  const existing = await prisma.monitoredPost.findUnique({
    where: { redditId_projectId: { redditId: post.name, projectId } },
    select: {
      id: true,
      status: true,
      subredditTargetId: true,
    },
  });

  if (!existing && score === 0) {
    return { action: "skipped", isCrosspost: false, promotedTrending: false };
  }

  const crosspostInfo = await detectCrosspost(post as RedditPostWithCrosspost);
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
    await prisma.monitoredPost.update({
      where: { id: existing.id },
      data: {
        ...baseData,
        ...(promotedTrending ? { status: "new" } : {}),
      },
    });

    return {
      action: "updated",
      isCrosspost: crosspostInfo.isCrosspost,
      promotedTrending,
    };
  }

  await prisma.monitoredPost.create({
    data: {
      redditId: post.name,
      projectId,
      status: "new",
      ...baseData,
    },
  });

  return {
    action: "created",
    isCrosspost: crosspostInfo.isCrosspost,
    promotedTrending: false,
  };
}
