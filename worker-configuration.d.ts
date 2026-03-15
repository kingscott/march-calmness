// Augments Cloudflare.Env with the bindings declared in wrangler.jsonc.
// Run `wrangler types` after setting a real database_id to regenerate this.
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ANTHROPIC_API_KEY: string;
  }
}
