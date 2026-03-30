import { prisma } from "./prisma";
import { RedditPost } from "./reddit";

// Detect if a post is a crosspost based on Reddit API data
// Reddit includes crosspost_parent and crosspost_parent_list in the API response
export interface RedditPostWithCrosspost extends RedditPost {
  crosspost_parent?: string; // e.g. "t3_abc123"
  crosspost_parent_list?: Array<{ name: string; subreddit: string; title: string }>;
}

// Check for crossposts by matching title similarity
// Used as a fallback when Reddit's crosspost fields aren't present
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

  if (normA === normB) return 1.0;

  const wordsA = normA.split(" ");
  const wordsB = new Set(normB.split(" "));
  const wordsASet = new Set(wordsA);
  const intersection = wordsA.filter((w) => wordsB.has(w));
  const unionArr = Array.from(wordsASet);
  wordsB.forEach((w) => { if (!wordsASet.has(w)) unionArr.push(w); });

  if (unionArr.length === 0) return 0;
  return new Set(intersection).size / unionArr.length;
}

// Process a post for crosspost detection and return crosspost metadata
export async function detectCrosspost(
  post: RedditPostWithCrosspost
): Promise<{
  isCrosspost: boolean;
  crosspostParentId: string | null;
  crosspostGroupId: string | null;
}> {
  // Method 1: Reddit's native crosspost field
  if (post.crosspost_parent) {
    const parentId = post.crosspost_parent;

    // Check if parent is already in our DB
    const parent = await prisma.monitoredPost.findFirst({
      where: { redditId: parentId },
    });

    const groupId = parent?.crosspostGroupId || parentId;

    // Update parent's group ID if it doesn't have one
    if (parent && !parent.crosspostGroupId) {
      await prisma.monitoredPost.update({
        where: { id: parent.id },
        data: { crosspostGroupId: groupId },
      });
    }

    return {
      isCrosspost: true,
      crosspostParentId: parentId,
      crosspostGroupId: groupId,
    };
  }

  // Method 2: Title similarity check against recent posts from other subreddits
  const recentPosts = await prisma.monitoredPost.findMany({
    where: {
      subreddit: { not: post.subreddit },
      createdUtc: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // last 7 days
    },
    select: { redditId: true, title: true, crosspostGroupId: true, author: true },
  });

  for (const existing of recentPosts) {
    const similarity = titleSimilarity(post.title, existing.title);

    // High similarity + same author = very likely crosspost
    if (similarity >= 0.85 || (similarity >= 0.7 && post.author === existing.author)) {
      const groupId = existing.crosspostGroupId || existing.redditId;

      // Update the matched post's group ID if needed
      if (!existing.crosspostGroupId) {
        await prisma.monitoredPost.updateMany({
          where: { redditId: existing.redditId },
          data: { crosspostGroupId: groupId },
        });
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

// Get all posts in the same crosspost group
export async function getCrosspostGroup(groupId: string) {
  return prisma.monitoredPost.findMany({
    where: { crosspostGroupId: groupId },
    orderBy: { createdUtc: "asc" },
    select: {
      id: true,
      redditId: true,
      subreddit: true,
      title: true,
      score: true,
      numComments: true,
      status: true,
      replies: { select: { id: true, status: true } },
    },
  });
}

// Check if any post in the crosspost group has already been replied to
export async function hasGroupBeenReplied(groupId: string): Promise<boolean> {
  const posts = await prisma.monitoredPost.findMany({
    where: {
      crosspostGroupId: groupId,
      status: { in: ["replied", "queued"] },
    },
  });
  return posts.length > 0;
}
