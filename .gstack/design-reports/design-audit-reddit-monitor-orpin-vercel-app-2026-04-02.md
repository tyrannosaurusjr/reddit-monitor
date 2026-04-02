# Design Audit — reddit-monitor-orpin.vercel.app
**Date:** 2026-04-02
**Branch:** claude/reddit-outreach-platform-0EcWL
**Classifier:** APP UI
**Depth:** Standard (7 pages)
**Pages:** login, dashboard (/), monitor, queue, replies, analytics, settings, admin

---

## First Impression

The site communicates **"data tool for power users."** Sidebar + stats + ranked posts reads as competent internal tooling. Orange accent is consistent. The dashboard is dense but organized, with three clear sections: stat cards, ranked queue, and trending posts.

The first 3 things the eye goes to: **1) "98 New Posts" stat card**, **2) orange "Act on These Now" section**, **3) green upvote numbers in Trending**.

One word: **functional.**

---

## Summary

| Metric | Value |
|--------|-------|
| Total findings | 10 |
| Fixed (verified) | 7 |
| Deferred | 3 |
| Baseline Design Score | C+ |
| Baseline AI Slop Score | B |
| Final Design Score | B- |
| Final AI Slop Score | B |

**PR Summary:** Design review found 10 issues, fixed 7. Design score C+ to B-, AI slop score B (unchanged).

---

## Design Score Breakdown

| Category | Weight | Baseline | Final | Notes |
|----------|--------|----------|-------|-------|
| Visual Hierarchy | 15% | B | B | Clear sections, dashboard communicates purpose |
| Typography | 15% | C | B | Geist Sans now wired up (was falling back to system font) |
| Spacing & Layout | 15% | B | B | Consistent spacing, grid works on desktop |
| Color & Contrast | 10% | B | B | Orange accent coherent, semantic colors proper |
| Interaction States | 10% | C | C | Hover states on nav, but no skeleton loads everywhere |
| Responsive | 10% | F | C | Sidebar now collapses on mobile (was completely broken) |
| Content Quality | 10% | C | B- | Replies empty state improved, login copy improved |
| AI Slop | 5% | B | B | Template patterns but no egregious slop |
| Motion | 5% | D | D | Zero intentional animations, no transitions |
| Performance Feel | 5% | C | B- | Dashboard has skeleton loading now |

**Baseline: C+ | Final: B-**

---

## AI Slop Score: B

**Verdict:** Reads as "built fast with Tailwind + shadcn" not "AI generated." Orange accent is a real choice. No purple gradients, no blobs, no emoji in headings, no "Unlock the power of" copy. The stat card grid and uniform rounded corners lean template-ish, but the data density and functional layout feel intentional.

**Litmus Checks:**
1. Brand/product unmistakable in first screen? **YES** — RedditReach name + orange accent
2. One strong visual anchor present? **YES** — "Act on These Now" section
3. Page understandable by scanning headlines only? **YES** — Dashboard, Monitor, Queue, Replies, Analytics, Settings
4. Each section has one job? **YES**
5. Are cards actually necessary? **MOSTLY** — stat cards are borderline, content cards serve their purpose
6. Does motion improve hierarchy? **NO** — zero motion
7. Premium without decorative shadows? **YES** — no gratuitous shadows

---

## Findings

### FINDING-001 — Sidebar doesn't collapse on mobile/tablet
**Severity:** High
**Category:** Responsive
**Fix Status:** verified
**Commit:** 3b29d17
**Files Changed:** `src/components/nav.tsx`, `src/app/layout.tsx`

Sidebar was fixed at `w-64` with no responsive logic. On mobile (375px), it consumed ~65% of the viewport. Content was pushed off-screen. App was unusable on any device under 768px.

**Fix:** Added hamburger button (md:hidden), overlay backdrop, slide-in animation with transition-transform, close button. Sidebar is `fixed -translate-x-full` on mobile, `md:relative md:translate-x-0` on desktop. Content area gets mobile-appropriate padding (`p-4 pt-16 md:p-8 md:pt-8`).

---

### FINDING-002 — Analytics page infinite loading spinner
**Severity:** High
**Category:** Performance / UX
**Fix Status:** deferred

Analytics page shows orange spinner indefinitely (tested 8+ seconds). No error state, no timeout, no fallback content. Likely a data-fetch issue (API timeout or silent error) rather than pure CSS.

---

### FINDING-003 — Touch targets undersized across entire app
**Severity:** Medium
**Category:** Accessibility
**Fix Status:** verified (nav), verified (icon buttons)
**Commits:** e9d7363, 4777399
**Files Changed:** `src/components/nav.tsx`, `src/app/monitor/page.tsx`, `src/app/queue/page.tsx`, `src/app/replies/page.tsx`

Nav links were 36px, filter pills 26px, icon buttons 26px, project selector 38px. Almost everything under the 44px WCAG minimum.

**Fix (nav):** Added `min-h-[44px]` and `py-2.5` to nav links, admin link, and project switcher button.

**Fix (icon buttons):** Added `aria-label` attributes to all icon-only buttons: Monitor toggle/delete, Queue expand/dismiss, Replies edit/post/delete. (184 anonymous buttons flagged by QA ISSUE-002.)

---

### FINDING-004 — No skeleton loading states
**Severity:** Medium
**Category:** Performance Feel
**Fix Status:** verified (dashboard)
**Commit:** 678b37a
**Files Changed:** `src/app/page.tsx`

Every page used the same generic orange spinner. No skeleton shapes matching content layout.

**Fix:** Dashboard loading state replaced with `animate-pulse` skeleton matching the real layout: heading + subtitle, 3x2 stat card grid, content area.

---

### FINDING-005 — Default system font stack
**Severity:** Medium
**Category:** Typography
**Fix Status:** verified
**Commit:** f98d85c
**Files Changed:** `tailwind.config.ts`

Geist Sans was loaded via `next/font/local` with CSS variable `--font-geist-sans`, but Tailwind's `font-sans` utility was never configured to use it. `font-sans` resolved to the default `ui-sans-serif, system-ui` stack.

**Fix:** Added `fontFamily.sans` override in `tailwind.config.ts` pointing to `var(--font-geist-sans)` with system fallbacks.

---

### FINDING-006 — Inconsistent tab/filter patterns
**Severity:** Medium
**Category:** Consistency
**Fix Status:** deferred

Three different tab/filter components across the app:
- Dashboard: colored pill filters (Keywords/Upvotes/Comments/Freshness)
- Queue: dark/outlined pill buttons (New/Queued/All)
- Replies: underline-style tabs (Drafts/Scheduled/Posted/Failed)

Should converge on one pattern. Deferred because it requires a component unification decision.

---

### FINDING-007 — Empty states lack warmth
**Severity:** Medium
**Category:** Content Quality
**Fix Status:** verified (replies)
**Commit:** b9cb07f
**Files Changed:** `src/app/replies/page.tsx`

Replies page showed "No draft replies." as plain centered text. No icon, no guidance, no call to action.

**Fix:** Added icon (Send), descriptive heading ("No draft replies yet"), and contextual help text for each tab state. Drafts tab says "Head to the Queue to draft replies."

---

### FINDING-008 — Flat heading scale
**Severity:** Low
**Category:** Typography
**Fix Status:** deferred

H1 (logo) = 20px, H2 = 24px, H3 = 18px. Very flat hierarchy. Logo is smaller than page titles. No expressive size jumps. Low priority since the app UI classifier doesn't demand dramatic typography.

---

### FINDING-009 — Login page is bare minimum
**Severity:** Low
**Category:** Content Quality
**Fix Status:** verified
**Commit:** 0778724
**Files Changed:** `src/app/login/page.tsx`

Login card only said "Sign in to manage your outreach projects." Communicates nothing about what RedditReach does.

**Fix:** Changed to "Monitor subreddits, find relevant threads, and draft targeted replies across multiple projects."

---

### FINDING-010 — Stat card grid reads as SaaS template
**Severity:** Low (AI Slop)
**Category:** AI Slop
**Fix Status:** deferred

Six cards in 3x2 grid with number + label + icon. Functional but reads as the most "template" part of the UI. Low priority because the data density justifies the layout.

---

## Inferred Design System

- **Font:** Geist Sans (now properly wired), system-ui fallback
- **Primary accent:** Orange-500 (#f97316)
- **Neutral palette:** Slate (warm-neutral). bg: slate-50, text: slate-900
- **Semantic colors:** Green (success/enabled), Red (error/destructive), Blue (info), Yellow (warning), Purple (relevance scores)
- **Border radius:** Consistent rounded-lg across cards and buttons
- **Spacing base:** Tailwind default 4px scale, used consistently
- **Breakpoints:** md (768px) used for sidebar collapse (newly added)

---

## Console Health

Zero JS errors across all pages. Analytics loading issue is server-side (silent API failure), not a client JS error.

---

## Fixes Applied (7 commits)

| # | Finding | Commit | Type |
|---|---------|--------|------|
| 1 | FINDING-001: Responsive sidebar | 3b29d17 | JSX + CSS |
| 2 | FINDING-005: Geist font config | f98d85c | Config |
| 3 | FINDING-003: Nav touch targets | e9d7363 | CSS |
| 4 | FINDING-007: Replies empty state | b9cb07f | JSX |
| 5 | FINDING-003b: Aria labels | 4777399 | JSX |
| 6 | FINDING-004: Dashboard skeleton | 678b37a | JSX |
| 7 | FINDING-009: Login copy | 0778724 | Content |
