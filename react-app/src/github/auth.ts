/**
 * Sign-in. Two paths, same result (a token in IndexedDB):
 *
 *  1. GitHub OAuth (normal). The browser is sent to the relay's /auth/start,
 *     which redirects to github.com/login/oauth/authorize. GitHub sends the
 *     user back to THIS app with ?code=…&state=…; we POST the code to the
 *     relay's /auth/exchange, which holds the client secret and returns the
 *     token. The relay never stores anything.
 *
 *  2. Paste a fine-grained PAT in Settings (dev, or if the relay is down).
 *
 * The `state` value is a random string we keep in sessionStorage and check on
 * return, so a code planted in a link by someone else is ignored (CSRF).
 */
import { env } from "../config/env";
import { graphql, setToken } from "./client";

const STATE_KEY = "retro.oauth.state";
const RETURN_KEY = "retro.oauth.return";

export interface Viewer {
  login: string;
  avatarUrl: string;
  name: string | null;
}

export function beginOAuth(): void {
  const state = crypto.getRandomValues(new Uint32Array(4)).join("-");
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(RETURN_KEY, location.hash);
  const redirect = location.origin + location.pathname; // the app itself, no hash
  const url = new URL(env.authStart, location.origin);
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirect);
  location.assign(url.toString());
}

/**
 * Call once on startup. If the URL carries an OAuth code for us, exchange it,
 * store the token, scrub the URL and return true.
 */
export async function completeOAuthIfReturning(): Promise<boolean> {
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return false;
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  const hash = sessionStorage.getItem(RETURN_KEY) ?? "";
  sessionStorage.removeItem(RETURN_KEY);
  // Always scrub the code from the address bar, even on failure.
  history.replaceState(null, "", location.pathname + hash);
  if (!expected || expected !== state) throw new Error("Sign-in was not started from this app (state mismatch). Try again.");

  const res = await fetch(env.authExchange, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: location.origin + location.pathname }),
  });
  if (!res.ok) throw new Error(`Sign-in failed (${res.status}). ${await res.text().catch(() => "")}`);
  const { access_token } = (await res.json()) as { access_token?: string };
  if (!access_token) throw new Error("Sign-in failed: no token returned.");
  await setToken(access_token);
  return true;
}

export async function signInWithPat(pat: string): Promise<void> {
  await setToken(pat.trim());
  try {
    await whoAmI();
  } catch (e) {
    await setToken(null);
    throw e;
  }
}

export async function signOut(): Promise<void> {
  await setToken(null);
}

export async function whoAmI(): Promise<Viewer> {
  const data = await graphql<{ viewer: Viewer }>(`query { viewer { login avatarUrl name } }`);
  return data.viewer;
}
