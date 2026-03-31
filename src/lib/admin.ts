import { prisma } from "./prisma";
import { getAuthSession } from "./auth";

export async function requireAdmin(): Promise<string> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    throw new Error("Forbidden");
  }

  return session.user.id;
}
