import { NextResponse } from "next/server";
import { getAuthSession } from "./auth";
import { prisma } from "./prisma";

// Returns userId or a 401 response
export async function authenticateRequest(): Promise<
  { userId: string } | { error: NextResponse }
> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { userId: session.user.id };
}

// Verify a project belongs to the current user
export async function verifyProjectOwnership(
  projectId: string,
  userId: string
): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  return !!project;
}
