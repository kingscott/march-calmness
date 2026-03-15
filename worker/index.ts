/**
 * Cloudflare Worker entry point.
 *
 * - fetch: delegated to the vinext App Router handler
 * - scheduled: ESPN poll triggered by Cron Trigger
 */

import { pollOnce } from "../lib/poller";

export default {
  // HTTP requests are handled by vinext — this re-export lets the worker
  // delegate to the framework while still exporting a scheduled handler.
  // vinext merges its own fetch handler at build time.
  scheduled: async (_event: ScheduledEvent) => {
    const result = await pollOnce();
    if (result.skipped) {
      console.log("[cron] Outside tournament window — skipped");
      return;
    }
    if (result.errors.length) {
      console.warn(`[cron] ${result.errors.length} fetch error(s):`, result.errors);
    }
    console.log(`[cron] Done — ${result.gamesUpserted}/${result.eventsFound} events stored`);
  },
};
