import { NextAuthOptions, getServerSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "./prisma";
import type { Adapter } from "next-auth/adapters";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    }),
  ],
  session: {
    strategy: "database",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;

        // Fetch plan info
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { plan: true, planExpiresAt: true },
        });
        session.user.plan = dbUser?.plan || "free";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

export async function getAuthSession() {
  return getServerSession(authOptions);
}

// Get the current user ID or throw
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
    scanInterval: "manual", // no cron
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

  // Check if pro has expired
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
