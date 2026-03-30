import { prisma } from "./prisma";

interface StaggerConfig {
  minDelayMinutes: number; // minimum gap between replies
  maxDelayMinutes: number; // maximum gap between replies
  maxPerHour: number;      // max replies to post in a single hour
  jitterMinutes: number;   // random jitter to add
}

const DEFAULT_CONFIG: StaggerConfig = {
  minDelayMinutes: 8,
  maxDelayMinutes: 25,
  jitterMinutes: 5,
  maxPerHour: 4,
};

// Get a random delay in range, for human-like variance
function randomDelay(min: number, max: number, jitter: number): number {
  const base = min + Math.random() * (max - min);
  const jitterAmount = (Math.random() - 0.5) * 2 * jitter;
  return Math.max(min, Math.round(base + jitterAmount));
}

// Calculate the next available posting slot, respecting rate limits and stagger rules
export async function getNextStaggeredTime(
  baseTime: Date,
  config: StaggerConfig = DEFAULT_CONFIG
): Promise<Date> {
  // Find the most recent scheduled or posted reply
  const lastReply = await prisma.draftReply.findFirst({
    where: {
      status: { in: ["scheduled", "posted"] },
      scheduledFor: { not: null },
    },
    orderBy: { scheduledFor: "desc" },
    select: { scheduledFor: true },
  });

  // Count replies already scheduled in the same hour window
  const hourStart = new Date(baseTime);
  hourStart.setMinutes(0, 0, 0);
  const hourEnd = new Date(hourStart);
  hourEnd.setHours(hourEnd.getHours() + 1);

  const repliesInHour = await prisma.draftReply.count({
    where: {
      status: { in: ["scheduled", "posted"] },
      scheduledFor: { gte: hourStart, lt: hourEnd },
    },
  });

  let nextTime = new Date(baseTime);

  // If there's a recent reply, ensure minimum gap
  if (lastReply?.scheduledFor) {
    const earliestAfterLast = new Date(lastReply.scheduledFor);
    const delay = randomDelay(
      config.minDelayMinutes,
      config.maxDelayMinutes,
      config.jitterMinutes
    );
    earliestAfterLast.setMinutes(earliestAfterLast.getMinutes() + delay);

    if (earliestAfterLast > nextTime) {
      nextTime = earliestAfterLast;
    }
  }

  // If the hour is full, push to next hour
  if (repliesInHour >= config.maxPerHour) {
    nextTime = new Date(hourEnd);
    const delay = randomDelay(
      config.minDelayMinutes,
      config.maxDelayMinutes,
      config.jitterMinutes
    );
    nextTime.setMinutes(nextTime.getMinutes() + delay);
  }

  return nextTime;
}

// Schedule multiple replies with staggered timing
export async function staggerReplies(
  replyIds: string[],
  startTime: Date,
  config: StaggerConfig = DEFAULT_CONFIG
): Promise<Array<{ replyId: string; scheduledFor: Date; staggerDelay: number }>> {
  const results: Array<{ replyId: string; scheduledFor: Date; staggerDelay: number }> = [];
  let currentTime = new Date(startTime);

  for (let i = 0; i < replyIds.length; i++) {
    const scheduledFor = i === 0
      ? currentTime
      : await getNextStaggeredTime(currentTime, config);

    const delayMinutes = Math.round(
      (scheduledFor.getTime() - startTime.getTime()) / 60000
    );

    await prisma.draftReply.update({
      where: { id: replyIds[i] },
      data: {
        status: "scheduled",
        scheduledFor,
        staggerGroup: Date.now(), // batch identifier
        staggerDelay: delayMinutes,
      },
    });

    results.push({
      replyId: replyIds[i],
      scheduledFor,
      staggerDelay: delayMinutes,
    });

    currentTime = scheduledFor;
  }

  return results;
}

// Get stagger config (could be extended to read from AppSettings)
export function getStaggerConfig(): StaggerConfig {
  return DEFAULT_CONFIG;
}
