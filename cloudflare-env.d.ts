declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    CREATOR_EMAIL?: string;
    MODEL_API_KEY?: string;
    GODMODE_LIVE_ENABLED?: string;
    GODMODE_PROJECT_BUDGET_MICRO_USD?: string;
    GODMODE_BACKGROUND_ENABLED?: string;
  }
}
