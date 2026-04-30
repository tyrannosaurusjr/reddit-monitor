# RedditReach

Monitor subreddits for keyword-matched posts, draft replies, and schedule outreach for any site or brand.

## Features

- **Subreddit monitoring** — track multiple subreddits, poll for new posts every 30 minutes
- **Keyword filtering** — score posts by relevance using configurable keyword lists
- **Reply drafting** — write and edit reply drafts per post
- **Scheduled posting** — queue replies to post automatically via Reddit API
- **Dashboard** — stats overview with recent posts and reply status
- **Cron automation** — built-in polling and reply-posting on intervals
- **Best-time analytics** — engagement heatmaps per subreddit showing peak activity windows
- **Cross-post detection** — flags duplicate posts across subreddits, warns before double-replying
- **Reply staggering** — spaces out replies (8-25 min gaps, max 4/hr, random jitter) to look natural

## Stack

- Next.js 14 (App Router)
- Prisma + SQLite
- Tailwind CSS + shadcn/ui
- Reddit OAuth2 API (password grant)
- node-cron for scheduling

## Setup

```bash
# Install dependencies
npm install

# Copy env and fill in your Reddit API credentials
cp .env.example .env

# Create the database
npx prisma db push

# Generate Prisma client
npx prisma generate

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Reddit API Credentials

1. Go to https://www.reddit.com/prefs/apps/
2. Create an app — choose **script** type
3. Set redirect URI to `http://localhost:3000`
4. Copy the client ID (under the app name) and secret into `.env`
5. Add your Reddit username and password

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — stats and recent activity |
| `/monitor` | Browse and scan monitored posts |
| `/queue` | Review queued posts and manage status |
| `/replies` | Draft, edit, and schedule replies |
| `/analytics` | Engagement heatmaps and best posting windows |
| `/settings` | Manage subreddits, keywords, and app config |

## API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/subreddits` | GET/POST/DELETE | Manage subreddit targets |
| `/api/keywords` | GET/POST/DELETE | Manage keyword filters |
| `/api/posts` | GET/PATCH | List and update monitored posts |
| `/api/posts/scan` | POST | Trigger a scan (with crosspost detection) |
| `/api/replies` | GET/POST/PATCH/DELETE | Manage draft replies (with auto-stagger) |
| `/api/replies/post` | POST | Post a reply to Reddit |
| `/api/analytics` | GET/POST | Fetch or sample engagement data |
| `/api/stagger` | GET/POST | Preview or batch-schedule staggered replies |
| `/api/stats` | GET | Dashboard statistics |
| `/api/cron/poll` | POST | Cron: poll subreddits + sample engagement |
| `/api/cron/post-replies` | POST | Cron: post scheduled replies |
| `/api/cron/start` | POST | Start the cron scheduler |

## Smart Features

### Best-time Analytics
Engagement data is sampled every time subreddits are polled. The Analytics page shows a 7-day x 24-hour heatmap weighted toward comment activity (70% comments, 30% upvotes) since comments signal higher outreach potential. Top 5 windows are highlighted per subreddit and aggregated.

### Cross-post Detection
During scans, posts are checked for crossposts using Reddit's native `crosspost_parent` field, with a fallback to title similarity matching (85%+ match, or 70%+ with same author). Linked posts are grouped and the Queue page warns you if another version already has a reply.

### Reply Staggering
Scheduled replies are automatically spaced out: 8-25 minute gaps between posts, max 4 per hour, with random jitter. This prevents bot-like posting patterns. Stagger delays are visible on the Replies page.

## Cron Jobs

The built-in scheduler runs two jobs:
- **Poll subreddits** — every 30 minutes, fetches new posts, detects crossposts, and samples engagement
- **Post replies** — every 15 minutes, posts any replies scheduled before now (respects stagger timing)

Start cron by hitting `POST /api/cron/start` or triggering it from the Settings page.

## Operations

- Incident note: [docs/2026-04-30-stale-monitoring-incident.md](docs/2026-04-30-stale-monitoring-incident.md)

## Companion Tool

This app is designed to complement [Later for Reddit](https://laterforreddit.com/) (scheduling your own posts at optimal times). RedditReach handles the other half: finding and engaging with other people's posts.
