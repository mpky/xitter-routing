import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TARGET_HOST,
  REDIRECT_MODES,
  rewriteUrl,
  shouldRewritePath,
  shouldRewriteHostname
} from "../extension/src/shared/rewriter.js";

test("rewrites x.com URLs to xcancel.com", () => {
  assert.equal(
    rewriteUrl("https://x.com/user/status/123"),
    "https://xcancel.com/user/status/123"
  );
});

test("does not rewrite non-status URLs in status-only mode", () => {
  assert.equal(rewriteUrl("https://x.com/home"), null);
  assert.equal(rewriteUrl("https://twitter.com/elonmusk"), null);
});

test("rewrites twitter.com URLs and preserves query and fragment", () => {
  assert.equal(
    rewriteUrl("https://twitter.com/user/status/123?s=20&t=abc#frag"),
    "https://xcancel.com/user/status/123?s=20&t=abc#frag"
  );
});

test("rewrites mobile.twitter.com and forces https", () => {
  assert.equal(
    rewriteUrl("http://mobile.twitter.com/user/status/123"),
    "https://xcancel.com/user/status/123"
  );
});

test("does not rewrite already rewritten URLs", () => {
  assert.equal(rewriteUrl(`https://${DEFAULT_TARGET_HOST}/user/status/123`), null);
});

test("does not rewrite non-target domains", () => {
  assert.equal(rewriteUrl("https://example.com/user/status/123"), null);
});

test("does not rewrite malformed URLs", () => {
  assert.equal(rewriteUrl("not a url"), null);
});

test("can rewrite all X/Twitter URLs when all mode is enabled", () => {
  assert.equal(
    rewriteUrl("https://x.com/home", { redirectMode: REDIRECT_MODES.ALL }),
    "https://xcancel.com/home"
  );
});

test("matches the allowed host list only", () => {
  assert.equal(shouldRewriteHostname("X.COM"), true);
  assert.equal(shouldRewriteHostname("mobile.twitter.com"), true);
  assert.equal(shouldRewriteHostname("api.x.com"), false);
});

test("matches only status-style paths in status-only mode", () => {
  assert.equal(shouldRewritePath("/user/status/123"), true);
  assert.equal(shouldRewritePath("/i/status/456"), true);
  assert.equal(shouldRewritePath("/user/status/123/photo/1"), true);
  assert.equal(shouldRewritePath("/home"), false);
  assert.equal(shouldRewritePath("/explore"), false);
});
