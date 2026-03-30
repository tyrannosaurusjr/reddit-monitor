const REDDIT_BASE_URL = "https://oauth.reddit.com";
const REDDIT_AUTH_URL = "https://www.reddit.com/api/v1/access_token";
const REDDIT_PUBLIC_URL = "https://www.reddit.com";

let cachedToken: { token: string; expiresAt: number } | null = null;

function hasOAuthCredentials(): boolean {
  return !!(
    process.env.REDDIT_CLIENT_ID &&
    process.env.REDDIT_CLIENT_SECRET &&
    process.env.REDDIT_USERNAME &&
    process.env.REDDIT_PASSWORD
  );
}

export async function getRedditAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error("Reddit API credentials not configured. Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, and REDDIT_PASSWORD.");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(REDDIT_AUTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "RedditReach/1.0.0",
    },
    body: new URLSearchParams({
      grant_type: "password",
      username,
      password,
    }),
  });

  if (!res.ok) {
    throw new Error(`Reddit auth failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.token;
}

// Authenticated fetch (requires OAuth creds)
async function redditFetch(endpoint: string, options: RequestInit = {}) {
  const token = await getRedditAccessToken();
  const res = await fetch(`${REDDIT_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "RedditReach/1.0.0",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Reddit API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

// Public JSON fetch (no auth needed — read-only)
async function redditPublicFetch(path: string) {
  // Insert .json before query params: /r/sub/new?limit=25 -> /r/sub/new.json?limit=25
  const [pathname, query] = path.split("?");
  const url = `${REDDIT_PUBLIC_URL}${pathname}.json${query ? `?${query}` : ""}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "RedditReach/1.0.0",
    },
  });

  if (!res.ok) {
    throw new Error(`Reddit public API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

export interface RedditPost {
  id: string;
  name: string; // "t3_xxx"
  subreddit: string;
  title: string;
  selftext: string;
  author: string;
  url: string;
  permalink: string;
  score: number;
  num_comments: number;
  created_utc: number;
}

export async function fetchSubredditPosts(
  subreddit: string,
  sort: "new" | "hot" = "new",
  limit: number = 25
): Promise<RedditPost[]> {
  // Use OAuth if credentials are available, otherwise fall back to public JSON API
  if (hasOAuthCredentials()) {
    const data = await redditFetch(`/r/${subreddit}/${sort}?limit=${limit}`);
    return data.data.children.map((child: { data: RedditPost }) => child.data);
  }

  const data = await redditPublicFetch(`/r/${subreddit}/${sort}?limit=${limit}`);
  return data.data.children.map((child: { data: RedditPost }) => child.data);
}

export async function postComment(
  parentFullname: string,
  text: string
): Promise<{ id: string; name: string }> {
  if (!hasOAuthCredentials()) {
    throw new Error("Cannot post comments without Reddit API credentials. Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, and REDDIT_PASSWORD in .env");
  }

  const token = await getRedditAccessToken();
  const res = await fetch(`${REDDIT_BASE_URL}/api/comment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "RedditReach/1.0.0",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      thing_id: parentFullname,
      text,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to post comment: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const comment = data.json?.data?.things?.[0]?.data;
  return { id: comment?.id ?? "", name: comment?.name ?? "" };
}
