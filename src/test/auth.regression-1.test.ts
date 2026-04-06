import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression: ISSUE-001 — JWT refresh does not re-fetch isAdmin/plan from DB
// Found by /qa on 2026-04-02
// Report: .gstack/qa-reports/qa-report-reddit-monitor-orpin-vercel-app-2026-04-02.md
//
// Root cause: jwt() callback only queried the DB when `user` was present (initial
// sign-in). Subsequent JWT refreshes skipped the lookup, so plan/isAdmin changes
// made after the JWT was first issued never took effect until the user signed out.

// Mock prisma before importing authOptions
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
const jwtCallback = authOptions.callbacks!.jwt! as Function;

describe("auth JWT callback — isAdmin/plan refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets isAdmin and plan on initial sign-in", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      plan: "pro",
      isAdmin: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);

    const token = await jwtCallback({
      token: {},
      user: { email: "test@example.com", name: "Test" },
    });

    expect(token.userId).toBe("user-1");
    expect(token.plan).toBe("pro");
    expect(token.isAdmin).toBe(true);
  });

  it("re-fetches isAdmin and plan on JWT refresh (no user object)", async () => {
    // Simulate a token that was issued when user was free/non-admin
    const staleToken = { userId: "user-1", plan: "free", isAdmin: false };

    // DB now has them as pro + admin (changed after initial JWT was issued)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      plan: "pro",
      isAdmin: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);

    const token = await jwtCallback({
      token: staleToken,
      user: undefined, // no user = this is a refresh, not initial sign-in
    });

    expect(token.plan).toBe("pro");
    expect(token.isAdmin).toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { plan: true, isAdmin: true },
    });
  });

  it("keeps stale token values if DB lookup fails on refresh", async () => {
    const staleToken = { userId: "user-1", plan: "free", isAdmin: false };
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("DB down"));

    const token = await jwtCallback({ token: staleToken, user: undefined });

    expect(token.plan).toBe("free");
    expect(token.isAdmin).toBe(false);
  });

  it("skips refresh lookup when no userId in token", async () => {
    const token = await jwtCallback({ token: {}, user: undefined });

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(token).toEqual({});
  });
});
