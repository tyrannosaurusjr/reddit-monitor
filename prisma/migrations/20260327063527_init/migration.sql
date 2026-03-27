-- CreateTable
CREATE TABLE "SubredditTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KeywordFilter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyword" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MonitoredPost" (
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
    "subredditTargetId" TEXT,
    CONSTRAINT "MonitoredPost_subredditTargetId_fkey" FOREIGN KEY ("subredditTargetId") REFERENCES "SubredditTarget" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DraftReply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scheduledFor" DATETIME,
    "postedAt" DATETIME,
    "redditCommentId" TEXT,
    "errorMessage" TEXT,
    "postId" TEXT NOT NULL,
    CONSTRAINT "DraftReply_postId_fkey" FOREIGN KEY ("postId") REFERENCES "MonitoredPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SubredditTarget_name_key" ON "SubredditTarget"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoredPost_redditId_key" ON "MonitoredPost"("redditId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_key_key" ON "AppSettings"("key");
