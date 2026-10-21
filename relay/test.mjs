// Relay tests: no dependencies, no network. `node test.mjs` (CI runs this).
import assert from "node:assert/strict";
import worker, { allowedOrigin, redirectAllowed } from "./src/index.js";

const env = {
  ALLOWED_ORIGINS: "https://mywebsiteparticipants.github.io,http://localhost:*",
  GITHUB_CLIENT_ID: "id",
  GITHUB_CLIENT_SECRET: "secret",
};

// allowedOrigin
assert.equal(allowedOrigin("https://mywebsiteparticipants.github.io", env), "https://mywebsiteparticipants.github.io");
assert.equal(allowedOrigin("http://localhost:5173", env), "http://localhost:5173");
assert.equal(allowedOrigin("https://evil.example", env), null);
assert.equal(allowedOrigin(null, env), null);

// redirectAllowed
assert.equal(redirectAllowed("https://mywebsiteparticipants.github.io/Retro/", env), true);
assert.equal(redirectAllowed("https://evil.example/Retro/", env), false);
assert.equal(redirectAllowed("not a url", env), false);

// /auth/start redirects to GitHub with our params
{
  const res = await worker.fetch(
    new Request("https://relay/auth/start?state=abc&redirect_uri=" + encodeURIComponent("https://mywebsiteparticipants.github.io/Retro/")),
    env,
  );
  assert.equal(res.status, 302);
  const to = new URL(res.headers.get("Location"));
  assert.equal(to.origin + to.pathname, "https://github.com/login/oauth/authorize");
  assert.equal(to.searchParams.get("client_id"), "id");
  assert.equal(to.searchParams.get("state"), "abc");
  assert.equal(to.searchParams.get("redirect_uri"), "https://mywebsiteparticipants.github.io/Retro/");
}

// /auth/start refuses a foreign redirect
{
  const res = await worker.fetch(new Request("https://relay/auth/start?state=abc&redirect_uri=https://evil.example/"), env);
  assert.equal(res.status, 400);
}

// /auth/exchange: mock GitHub's token endpoint via GITHUB_TOKEN_URL + a fetch stub
{
  const realFetch = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ access_token: "gho_test", scope: "repo", token_type: "bearer" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const res = await worker.fetch(
      new Request("https://relay/auth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://mywebsiteparticipants.github.io" },
        body: JSON.stringify({ code: "c0de", redirect_uri: "https://mywebsiteparticipants.github.io/Retro/" }),
      }),
      { ...env, GITHUB_TOKEN_URL: "https://mock/token" },
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.access_token, "gho_test");
    assert.equal(seen.url, "https://mock/token");
    assert.equal(seen.body.client_secret, "secret");
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), "https://mywebsiteparticipants.github.io");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// /auth/exchange without an allowed Origin is refused before any upstream call
{
  const res = await worker.fetch(
    new Request("https://relay/auth/exchange", { method: "POST", headers: { Origin: "https://evil.example" }, body: "{}" }),
    env,
  );
  assert.equal(res.status, 403);
}

// Unconfigured relay says so
{
  const res = await worker.fetch(new Request("https://relay/auth/start?state=a&redirect_uri=http://localhost:5173/"), { ALLOWED_ORIGINS: "http://localhost:*" });
  assert.equal(res.status, 503);
}

console.log("relay: all tests passed");
