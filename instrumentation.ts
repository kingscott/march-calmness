/**
 * Next.js instrumentation hook.
 *
 * ESPN polling now runs as a Cloudflare Cron Trigger (see wrangler.jsonc).
 * This file is kept as a no-op so Next.js doesn't error on a missing export.
 */
export async function register() {
  // no-op: polling is handled by the Cloudflare Cron Trigger
}
