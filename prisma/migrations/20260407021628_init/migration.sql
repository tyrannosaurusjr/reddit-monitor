/*
  Warnings:

  - Added the required column `projectId` to the `DraftReply` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `KeywordFilter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `MonitoredPost` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `SubredditTarget` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "planExpiresAt" DATETIME
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#f97316',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EngagementSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subreddit" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "hourUtc" INTEGER NOT NULL,
    "avgScore" REAL NOT NULL DEFAULT 0,
    "avgComments" REAL NOT NULL DEFAULT 0,
    "postCount" INTEGER NOT NULL DEFAULT 0,
    "sampledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DraftReply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scheduledFor" DATETIME,
    "postedAt" DATETIME,
    "redditCommentId" TEXT,
    "errorMessage" TEXT,
    "staggerGroup" INTEGER,
    "staggerDelay" INTEGER,
    "projectId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    CONSTRAINT "DraftReply_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DraftReply_postId_fkey" FOREIGN KEY ("postId") REFERENCES "MonitoredPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DraftReply" ("content", "createdAt", "errorMessage", "id", "postId", "postedAt", "redditCommentId", "scheduledFor", "status", "updatedAt") SELECT "content", "createdAt", "errorMessage", "id", "postId", "postedAt", "redditCommentId", "scheduledFor", "status", "updatedAt" FROM "DraftReply";
DROP TABLE "DraftReply";
ALTER TABLE "new_DraftReply" RENAME TO "DraftReply";
CREATE TABLE "new_KeywordFilter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyword" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "KeywordFilter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_KeywordFilter" ("createdAt", "enabled", "id", "keyword") SELECT "createdAt", "enabled", "id", "keyword" FROM "KeywordFilter";
DROP TABLE "KeywordFilter";
ALTER TABLE "new_KeywordFilter" RENAME TO "KeywordFilter";
CREATE TABLE "new_MonitoredPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "redditId" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "selftext" TEXT NOT NULL DEFAULT '',
    "author" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "permalink" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "numComments" INTEGER NOT NULL DEFAULT 0,
    "createdUtc" DATETIME NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relevanceScore" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'new',
    "matchedKeywords" TEXT NOT NULL DEFAULT '',
    "isCrosspost" BOOLEAN NOT NULL DEFAULT false,
    "crosspostParentId" TEXT,
    "crosspostGroupId" TEXT,
    "projectId" TEXT NOT NULL,
    "subredditTargetId" TEXT,
    CONSTRAINT "MonitoredPost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MonitoredPost_subredditTargetId_fkey" FOREIGN KEY ("subredditTargetId") REFERENCES "SubredditTarget" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MonitoredPost" ("author", "createdUtc", "fetchedAt", "id", "matchedKeywords", "numComments", "permalink", "redditId", "relevanceScore", "score", "selftext", "status", "subreddit", "subredditTargetId", "title", "url") SELECT "author", "createdUtc", "fetchedAt", "id", "matchedKeywords", "numComments", "permalink", "redditId", "relevanceScore", "score", "selftext", "status", "subreddit", "subredditTargetId", "title", "url" FROM "MonitoredPost";
DROP TABLE "MonitoredPost";
ALTER TABLE "new_MonitoredPost" RENAME TO "MonitoredPost";
CREATE UNIQUE INDEX "MonitoredPost_redditId_projectId_key" ON "MonitoredPost"("redditId", "projectId");
CREATE TABLE "new_SubredditTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "contextual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "SubredditTarget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SubredditTarget" ("createdAt", "enabled", "id", "name", "updatedAt") SELECT "createdAt", "enabled", "id", "name", "updatedAt" FROM "SubredditTarget";
DROP TABLE "SubredditTarget";
ALTER TABLE "new_SubredditTarget" RENAME TO "SubredditTarget";
CREATE UNIQUE INDEX "SubredditTarget_name_projectId_key" ON "SubredditTarget"("name", "projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_userId_key" ON "Project"("slug", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementSnapshot_subreddit_dayOfWeek_hourUtc_key" ON "EngagementSnapshot"("subreddit", "dayOfWeek", "hourUtc");
