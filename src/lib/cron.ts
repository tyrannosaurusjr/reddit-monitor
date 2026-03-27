import cron from "node-cron";

let initialized = false;

export function initCronJobs() {
  if (initialized) return;
  initialized = true;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const cronSecret = process.env.CRON_SECRET || "redditreach-cron";

  // Poll subreddits every 30 minutes
  cron.schedule("*/30 * * * *", async () => {
    console.log("[Cron] Polling subreddits...");
    try {
      const res = await fetch(`${baseUrl}/api/cron/poll`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      const data = await res.json();
      console.log(`[Cron] Poll complete: scanned ${data.scanned}, found ${data.found}`);
    } catch (err) {
      console.error("[Cron] Poll failed:", err);
    }
  });

  // Post scheduled replies every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    console.log("[Cron] Checking scheduled replies...");
    try {
      const res = await fetch(`${baseUrl}/api/cron/post-replies`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      const data = await res.json();
      console.log(`[Cron] Reply posting: ${data.posted} posted, ${data.failed} failed`);
    } catch (err) {
      console.error("[Cron] Reply posting failed:", err);
    }
  });

  console.log("[Cron] Scheduled jobs initialized");
}
