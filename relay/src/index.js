/**
 * Retro relay — a Cloudflare Worker that does the ONE thing a static site on
 * GitHub Pages cannot: finish a GitHub OAuth sign-in, which needs the OAuth
 * App's client secret.
 *
 *   GET  /auth/start?state=…&redirect_uri=…
 *        → 302 to github.com/login/oauth/authorize (scopes below)
 *   POST /auth/exchange   { code, redirect_uri }
 *        → { access_token }   (we never store it; the browser keeps it)
 *   GET  /health
 *
 * Everything else the app does goes browser → api.github.com directly with
 * that token. The relay holds no data, no sessions and no GitHub token of
 * its own. Compare Bullpen's relay, which proxies every Alpaca call because
 * Alpaca sends no CORS headers; GitHub's API does, so this relay is tiny.
 *
 * Only origins listed in ALLOWED_ORIGINS (wrangler.toml) may call it, and the
 * redirect_uri must be on one of those origins, so a stranger cannot use it
 * to mint tokens for their own site.
 */

const SCOPES = "repo read:org project";
const AUTHORIZE = "https://github.com/login/oauth/authorize";
const TOKEN = "https://github.com/login/oauth/access_token";

/** Which of the configured origins (if any) this request may be answered for. */
export function allowedOrigin(originHeader, env) {
  if (!originHeader) return null;
  const list = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const pat of list) {
    if (pat === originHeader) return originHeader;
    if (pat.endsWith(":*") && originHeader.startsWith(pat.slice(0, -1))) return originHeader;
  }
  return null;
}

/** A redirect_uri is acceptable only if its origin is an allowed origin. */
export function redirectAllowed(redirectUri, env) {
  try {
    const u = new URL(redirectUri);
    return allowedOrigin(u.origin, env) !== null;
  } catch {
    return false;
  }
}

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(status, body, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(origin ? cors(origin) : {}) },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request.headers.get("Origin"), env);

    if (url.pathname === "/" || url.pathname === "/health") {
      return json(200, { ok: true, service: "retro-relay", configured: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) }, origin);
    }

    if (request.method === "OPTIONS") {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      return json(503, { message: "Relay has no GitHub OAuth App configured (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)." }, origin);
    }

    // Top-level navigation: the browser arrives here from the app's "Sign in"
    // button, so there is no Origin header — we check the redirect_uri instead.
    if (url.pathname === "/auth/start" && request.method === "GET") {
      const state = url.searchParams.get("state") || "";
      const redirectUri = url.searchParams.get("redirect_uri") || "";
      if (!state || !redirectAllowed(redirectUri, env)) return json(400, { message: "Bad state or redirect_uri." });
      const to = new URL(AUTHORIZE);
      to.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      to.searchParams.set("redirect_uri", redirectUri);
      to.searchParams.set("scope", SCOPES);
      to.searchParams.set("state", state);
      return Response.redirect(to.toString(), 302);
    }

    if (url.pathname === "/auth/exchange" && request.method === "POST") {
      if (!origin) return json(403, { message: "Origin not allowed." });
      let body;
      try {
        body = await request.json();
      } catch {
        return json(400, { message: "Expected JSON." }, origin);
      }
      const { code, redirect_uri } = body || {};
      if (!code || !redirectAllowed(redirect_uri, env)) return json(400, { message: "Missing code or bad redirect_uri." }, origin);

      const upstream = await fetch(env.GITHUB_TOKEN_URL || TOKEN, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri,
        }),
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok || data.error || !data.access_token) {
        return json(400, { message: data.error_description || data.error || "GitHub refused the code." }, origin);
      }
      // Only the token goes back. Scope/type are informational.
      return json(200, { access_token: data.access_token, scope: data.scope, token_type: data.token_type }, origin);
    }

    return json(404, { message: "Unknown route." }, origin);
  },
};
