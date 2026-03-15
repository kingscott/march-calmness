/**
 * Cloudflare Worker entry point.
 *
 * - fetch: delegated to the vinext App Router handler
 * - scheduled: ESPN poll triggered by Cron Trigger
 */

import appHandler from "vinext/server/app-router-entry";
import { pollOnce } from "../lib/poller";

export default {
  // Delegate all HTTP requests to the vinext App Router handler.
  fetch: appHandler.fetch,

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
