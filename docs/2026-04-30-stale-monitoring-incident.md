# Stale Monitoring Incident

Date: April 30, 2026  
Repo: `reddit-monitor`

## Summary

The app appeared frozen, with monitored posts looking stuck around late March / early April 2026 even after manual scan attempts. The issue was not a single bug. It was a stack of operational and runtime problems:

1. the background scanner stopped running after the repo moved on disk
2. local scan scripts were still using older create-only logic in some paths
3. the local Next.js process on `http://localhost:3002` had become stale/broken
4. Vercel was healthy, but production had not been redeployed recently

The incident was resolved on April 30, 2026 by repairing the scheduler path, hardening the local scanner, restarting the local app server, verifying live Turso freshness, and deploying the current code to Vercel production.

## User-Visible Symptoms

- Dashboard and queue looked frozen around data pulled about 1 to 1.5 months earlier.
- Manual UI refreshes did not appear to show fresh posts.
- The local app process on port `3002` was serving inconsistent content.
- There was confusion about whether GitHub was connected to Vercel.

## Impact

- Automatic subreddit polling was not reliably updating the live dataset.
- Local debugging was misleading because the local app process itself was unhealthy.
- Production on Vercel was behind the current local state.

## Root Causes

### 1. Broken cron path after repo move

The real user crontab still pointed to the old path:

```bash
/path/to/old/reddit-monitor
```

The active repo path had changed to:

```bash
/path/to/reddit-monitor
```

Because of that, automatic scans effectively stopped after the move.

Evidence:

- `crontab -l` showed the old path.
- `logs/launchd-stderr.log` repeatedly showed failures against the old path.
- `logs/scan.log` showed historical runs, then no healthy ongoing cadence matching current expectations.

### 2. Local scanner path lagged behind app scan logic

Some newer shared monitored-post logic existed in the Next.js API routes, but the local scan scripts were still effectively using older behavior in key paths:

- create-only inserts in some flows
- no shared refresh/upsert behavior across all scan entry points
- no retry handling for transient Turso DNS / timeout failures

This made the Mac-side scanner less resilient and less consistent than the app route logic.

### 3. Broken local app process on `localhost:3002`

During investigation, the running local Next.js process:

- was listening on port `3002`
- but returned `404` for `/login`

That meant the local app process itself was stale or broken, so browser behavior from that process was not trustworthy until it was restarted cleanly.

### 4. Vercel was connected, but stale

The Vercel project was already GitHub-linked. The real issue was not missing GitHub auth.

Findings:

- Vercel project owner: `the Vercel project owner`
- Git link existed to `YOUR_USERNAME/reddit-monitor`
- production branch in Vercel metadata: `claude/reddit-outreach-platform-0EcWL`
- last production deployment before the fix: April 6, 2026

So Vercel looked "disconnected" only because production was old, not because GitHub auth was absent.

## Key Evidence Collected

### Historical scan log

`logs/scan.log` showed successful local scans through April 8, 2026, including fresh work such as:

- April 8, 2026 03:15 JST: `5` total new posts
- April 8, 2026 04:15 JST: `3` total new posts
- April 8, 2026 04:44 JST: `2` total new posts

### Live remote DB freshness

Direct Turso inspection later showed fresh `fetchedAt` values for the live dataset on April 30, 2026, including timestamps between:

- `2026-04-30T03:08:06.933Z`
- `2026-04-30T03:23:49.168Z`

Example project counts in the live DB after repair:

- `JaCamp`: `188` posts
- `Music In Japan`: `535` posts
- `Wild Meat Japan`: `41` posts
- `Japanese Jesus`: `71` posts
- `Coaching In Japan`: `115` posts

### Manual live scan result

After repairing the scheduler and scan path, a manual live scan completed with:

- `117` new posts
- `44` existing posts refreshed
- `7` crossposts linked

Per-project highlights:

- `JaCamp`: `5` new, `29` refreshed
- `Music In Japan`: `87` new
- `Wild Meat Japan`: `10` new
- `Coaching In Japan`: `14` new, `15` refreshed
- `Japanese Jesus`: `1` new

## Fixes Applied

### Scheduler and script path fixes

Updated:

- `scripts/cron-scan.sh`
- `scripts/scan.sh`

Changes:

- resolve the repo path dynamically from the script location
- stop relying on the old hardcoded repo path
- use safer shell defaults
- use the current project path

Real crontab was replaced with:

```bash
*/30 * * * * /bin/bash /path/to/reddit-monitor/scripts/cron-scan.sh
```

### Shared monitored-post scan logic

Added shared scan/update logic in:

- `src/lib/monitored-posts.ts`
- `scripts/scan-helpers.ts`

Changes:

- central `upsertScannedPost(...)`
- refresh existing posts instead of only inserting new ones
- preserve normalized permalink behavior
- keep crosspost metadata in sync
- promote `trending` posts back to actionable `new` when they become keyword matches

### Scanner resilience

Updated:

- `scripts/local-scan.ts`
- `scripts/scan-single.ts`

Changes:

- use shared scan helper logic
- add retry handling for transient Turso failures such as `ENOTFOUND` and `ETIMEDOUT`
- keep a single project-level DB failure from killing all remaining work immediately

### API and UI consistency

Updated routes/pages so status, scoring, and queue behavior match the repaired scan model:

- `src/app/api/cron/poll/route.ts`
- `src/app/api/posts/scan/route.ts`
- `src/app/api/posts/ingest/route.ts`
- `src/app/api/posts/route.ts`
- `src/app/api/replies/route.ts`
- `src/app/api/replies/post/route.ts`
- `src/app/api/stats/route.ts`
- `src/app/api/subreddits/route.ts`
- `src/app/api/keywords/route.ts`
- `src/app/page.tsx`
- `src/app/monitor/page.tsx`
- `src/app/settings/page.tsx`
- `src/lib/keywords.ts`

Highlights:

- new/queued/replied status transitions are synced from reply state
- project rescoring occurs when keywords or subreddit contextual settings change
- dashboard health messaging exposes stale scan conditions better
- manual scan UI shows refreshed counts, not only newly inserted counts

### Local app runtime repair

The broken local Next.js process on `3002` was stopped and restarted cleanly from the current repo state.

Before restart:

- `/login` returned `404`

After restart:

- `/login` returned `200`
- `/api/debug` showed the fresh, correct project inventory

### Vercel verification and production deployment

Verified:

- GitHub repo was already connected to the Vercel project
- Vercel build pipeline worked

Then deployed:

- preview deployment succeeded
- production deployment succeeded

Production alias after repair:

```text
https://reddit-monitor-orpin.vercel.app
```

## Verification

### Test and build checks

- `npm test` passed
- `npm run build` passed

Known warning still present but non-blocking:

- Next.js `themeColor` metadata warning advising `viewport` export instead

### Runtime checks

- local `/api/health` returned `{"status":"ok"}`
- local `/api/debug` showed all current projects and scan readiness
- direct Turso inspection showed fresh `fetchedAt` values on April 30, 2026
- Vercel preview and production builds both completed successfully

## Final State

By the end of the repair:

- the live DB was fresh
- the local app server was healthy
- the scheduler path was corrected
- the local scanner was more resilient
- Vercel production was updated
- the Git branch was pushed to GitHub with commit `f9b9031`

## Prevention Notes

1. Avoid hardcoding repo paths in cron or launch scripts.
2. Keep local scan scripts and API scan logic on the same shared helper path.
3. Prefer one shared upsert/status model for monitored posts.
4. When the UI appears stale, verify all three layers separately:
   - scheduler
   - live DB freshness
   - current app process health
5. When Vercel looks stale, verify whether the problem is:
   - GitHub auth
   - wrong production branch
   - old deployment
   - local changes never pushed

## Useful Commands

Check the active cron job:

```bash
crontab -l
```

Check recent scan history:

```bash
tail -n 40 logs/scan.log
```

Check local app health:

```bash
curl http://127.0.0.1:3002/api/health
curl http://127.0.0.1:3002/api/debug
```

Run a manual local scan:

```bash
set -a
source .env
npx tsx scripts/local-scan.ts
```

Inspect Vercel Git linkage:

```bash
vercel git connect https://github.com/YOUR_USERNAME/reddit-monitor.git
vercel api /v9/projects/prj_LdOinbetuZMNDSsKBHpUrBHYVJ2c
```

Deploy to Vercel production:

```bash
vercel deploy --prod -y
```
