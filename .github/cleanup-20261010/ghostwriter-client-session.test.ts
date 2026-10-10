import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import * as guard from "../src/lib/ghostwriter-client-guard.ts";

function browser(t: TestContext, cookie = "gw_csrf=initial", refresh: "ok" | "refused" | "empty" | "throws" = "ok") {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  const document = { cookie };
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  t.after(() => previous ? Object.defineProperty(globalThis, "document", previous) : Reflect.deleteProperty(globalThis, "document"));
  const requests: RequestInit[] = [];
  const refreshError = new Error("refresh network failure");
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/second-voice?shield=refresh");
    requests.push(options);
    if (refresh === "throws") throw refreshError;
    document.cookie = refresh === "empty" ? "" : "gw_csrf=renewed";
    return new Response(null, { status: refresh === "refused" ? 503 : 200 });
  });
  return { requests, refreshError };
}

for (const operation of ["rewrite", "share", "feedback", "lab"]) {
  test(`${operation}: successful protected request returns its value without renewal`, async t => {
    const { requests } = browser(t);
    const value = { operation };
    assert.equal(await guard.withGhostwriterSession(new AbortController().signal, async token => {
      assert.equal(token, "initial");
      return value;
    }), value);
    assert.equal(requests.length, 0);
  });
}

test("missing cookies renew once before the operation is sent", async t => {
  const { requests } = browser(t, "");
  const signal = new AbortController().signal;
  const tokens: string[] = [];
  await guard.withGhostwriterSession(signal, async token => { tokens.push(token); });
  assert.deepEqual(tokens, ["renewed"]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].signal, signal);
  assert.equal(requests[0].credentials, "same-origin");
  assert.equal(requests[0].cache, "no-store");
});

for (const message of guard.RECOVERABLE_SESSION_ERRORS) {
  test(`only one retry is allowed for: ${message}`, async t => {
    const { requests } = browser(t);
    const tokens: string[] = [];
    const error = new guard.GhostwriterRequestError(message, "request-identity");
    await assert.rejects(guard.withGhostwriterSession(new AbortController().signal, async token => {
      tokens.push(token);
      throw error;
    }), actual => actual === error);
    assert.deepEqual(tokens, ["initial", "renewed"]);
    assert.equal(requests.length, 1);
  });
}

test("a renewed session can return successfully without changing operation identity", async t => {
  browser(t);
  const tokens: string[] = [];
  const value = { idempotencyKey: "stable-key", consent: "unchanged" };
  assert.equal(await guard.withGhostwriterSession(new AbortController().signal, async token => {
    tokens.push(token);
    if (tokens.length === 1) throw new Error("Request verification failed.");
    return value;
  }), value);
  assert.deepEqual(tokens, ["initial", "renewed"]);
});

for (const outcome of ["refused", "empty", "throws"] as const) {
  test(`failed renewal (${outcome}) never sends a second operation`, async t => {
    const { requests, refreshError } = browser(t, "gw_csrf=initial", outcome);
    const original = new Error("Request verification failed.");
    let calls = 0;
    await assert.rejects(guard.withGhostwriterSession(new AbortController().signal, async () => {
      calls++;
      throw original;
    }), actual => actual === (outcome === "throws" ? refreshError : original));
    assert.equal(calls, 1);
    assert.equal(requests.length, 1);
  });
}

for (const error of [
  new guard.GhostwriterRequestError("Provider unavailable", "request-identity", { retryAfterSeconds: 90, reasonCode: "PROVIDER_BUSY" }),
  new DOMException("Stopped", "AbortError"),
  "Request verification failed.",
]) {
  test(`non-session errors are never retried: ${String(error)}`, async t => {
    const { requests } = browser(t);
    let calls = 0;
    await assert.rejects(guard.withGhostwriterSession(new AbortController().signal, async () => {
      calls++;
      throw error;
    }), actual => actual === error);
    assert.equal(calls, 1);
    assert.equal(requests.length, 0);
  });
}
