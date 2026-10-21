/**
 * Where the app finds its relay. The relay is only used for the OAuth code
 * exchange (/auth/*); every GitHub call goes straight from the browser to
 * api.github.com with the user's token. Relative in dev (Vite proxies /auth
 * to `wrangler dev`); on GitHub Pages set the repo variable VITE_API_BASE to
 * the Worker URL.
 */
const apiBase = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

export const env = {
  apiBase,
  authStart: `${apiBase}/auth/start`,
  authExchange: `${apiBase}/auth/exchange`,
  /** Optional: a fine-grained PAT can be pasted in Settings instead of OAuth (dev / fallback). */
  buildTime: typeof __BUILD_TIME__ === "undefined" ? "" : __BUILD_TIME__,
} as const;

export const GITHUB_REPO_URL = "https://github.com/MyWebSiteParticipants/Retro";
export const MY_WEBSITE_URL = "https://mikecostarella.github.io/MyWebSite/";
export const STATEHOUSE_HOME_URL = "https://mikecostarella.github.io/StatehouseHome/";
export const FEEDBACK_URL = `${GITHUB_REPO_URL}/issues/new?template=bug.yml`;
