/**
 * Thin GitHub client: one `graphql()` and one `rest()` function, plus the
 * token store. Everything GitHub-shaped the app does goes through here so the
 * rest of the code never sees a URL or a header.
 *
 * The token is the user's own (OAuth, or a pasted fine-grained PAT). It lives
 * in IndexedDB on this device only. Nothing of ours ever sees it except the
 * relay during the one-time OAuth code exchange.
 */
import { kvGet, kvSet } from "../lib/kvStore";

const TOKEN_KEY = "github.token.v1";
const GQL = "https://api.github.com/graphql";
const REST = "https://api.github.com";

let cachedToken: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  cachedToken = (await kvGet<string>(TOKEN_KEY)) ?? null;
  return cachedToken;
}

export async function setToken(token: string | null): Promise<void> {
  cachedToken = token;
  await kvSet(TOKEN_KEY, token ?? "");
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  if (!token) throw new GitHubError("Not signed in.", 401);
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** Run a GraphQL document. Throws GitHubError on HTTP or GraphQL errors. */
export async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(GQL, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 401) {
    await setToken(null);
    throw new GitHubError("GitHub rejected the token. Sign in again.", 401);
  }
  if (!res.ok) throw new GitHubError(`GitHub ${res.status}`, res.status, await res.text());
  const json = (await res.json()) as { data?: T; errors?: { message: string; type?: string }[] };
  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join("; ");
    throw new GitHubError(msg, 200, json.errors);
  }
  return json.data as T;
}

/** Call a REST endpoint (path starts with /). Used only where GraphQL has no equivalent. */
export async function rest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(REST + path, {
    method,
    headers: { ...(await authHeaders()), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    await setToken(null);
    throw new GitHubError("GitHub rejected the token. Sign in again.", 401);
  }
  if (!res.ok) throw new GitHubError(`GitHub ${res.status} on ${path}`, res.status, await res.text().catch(() => ""));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function splitRepo(full: string): { owner: string; name: string } {
  const [owner, name] = full.split("/");
  if (!owner || !name) throw new Error(`Repository must be owner/name, got "${full}"`);
  return { owner, name };
}
