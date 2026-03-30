import { NextAuthOptions, getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  // No adapter — use JWT sessions instead of database sessions
  // We create/find the user manually in the signIn callback
  providers: [
    // Only register providers when credentials are configured
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })]
      : []),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [GitHubProvider({
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        })]
      : []),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email || !account) return false;

      // Always allow sign-in — DB user creation is best-effort
      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!dbUser) {
          await prisma.user.create({
            data: {
              email: user.email,
              name: user.name || null,
              image: user.image || null,
            },
          });
        }
      } catch (error) {
        // Log but don't block sign-in — user will be created on next API call
        console.error("[Auth] DB user creation failed (non-blocking):", error);
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        try {
          // Find or create DB user on initial sign in
          let dbUser = await prisma.user.findUnique({
            where: { email: user.email },
            select: { id: true, plan: true },
          });

          if (!dbUser) {
            dbUser = await prisma.user.create({
              data: {
                email: user.email,
                name: user.name || null,
                image: user.image || null,
              },
              select: { id: true, plan: true },
            });
          }

          token.userId = dbUser.id;
          token.plan = dbUser.plan;
        } catch (error) {
          console.error("[Auth] JWT user lookup failed:", error);
          // Use email as fallback ID so session still works
          token.userId = user.email;
          token.plan = "free";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
        session.user.plan = (token.plan as string) || "free";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  debug: process.env.NODE_ENV === "development",
};

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export async function requireAuth(): Promise<string> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// Plan limits
export const PLAN_LIMITS = {
  free: {
    maxProjects: 1,
    maxSubredditsPerProject: 3,
    maxKeywordsPerProject: 10,
    scanInterval: "manual",
  },
  pro: {
    maxProjects: 10,
    maxSubredditsPerProject: 25,
    maxKeywordsPerProject: 100,
    scanInterval: "30min",
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;

export async function getUserPlan(userId: string): Promise<PlanType> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, planExpiresAt: true },
  });

  if (!user) return "free";

  if (user.plan === "pro" && user.planExpiresAt && user.planExpiresAt < new Date()) {
    await prisma.user.update({
      where: { id: userId },
      data: { plan: "free" },
    });
    return "free";
  }

  return user.plan as PlanType;
}

export async function checkProjectLimit(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId);
  const count = await prisma.project.count({ where: { userId } });
  return count < PLAN_LIMITS[plan].maxProjects;
}

export async function checkSubredditLimit(userId: string, projectId: string): Promise<boolean> {
  const plan = await getUserPlan(userId);
  const count = await prisma.subredditTarget.count({ where: { projectId } });
  return count < PLAN_LIMITS[plan].maxSubredditsPerProject;
}

export async function checkKeywordLimit(userId: string, projectId: string): Promise<boolean> {
  const plan = await getUserPlan(userId);
  const count = await prisma.keywordFilter.count({ where: { projectId } });
  return count < PLAN_LIMITS[plan].maxKeywordsPerProject;
}
