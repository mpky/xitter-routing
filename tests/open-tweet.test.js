import test from "node:test";
import assert from "node:assert/strict";

import {
  extractFirstSupportedUrl,
  normalizeCandidateUrl,
  resolveQuickActionUrl
} from "../scripts/lib/open-tweet.js";

const EMBED_20 = "https://platform.twitter.com/embed/Tweet.html?id=20&dnt=true";

test("normalizes schemeless x.com URLs", () => {
  assert.equal(
    normalizeCandidateUrl("x.com/user/status/123"),
    "https://x.com/user/status/123"
  );
});

test("extracts the first supported URL from mixed text", () => {
  assert.equal(
    extractFirstSupportedUrl("See this https://example.com first and then x.com/user/status/123 later"),
    "https://x.com/user/status/123"
  );
});

test("resolves post URLs to X's embed page", () => {
  assert.equal(resolveQuickActionUrl("https://x.com/jack/status/20"), EMBED_20);
  assert.equal(resolveQuickActionUrl("https://twitter.com/jack/status/20?s=20"), EMBED_20);
});

test("opens non-post X URLs as-is in the browser", () => {
  assert.equal(resolveQuickActionUrl("https://x.com/home"), "https://x.com/home");
  assert.equal(resolveQuickActionUrl("http://twitter.com/jack"), "https://twitter.com/jack");
});

test("routes dead mirror links to the embed page or back to X", () => {
  assert.equal(resolveQuickActionUrl("https://xcancel.com/jack/status/20"), EMBED_20);
  assert.equal(resolveQuickActionUrl("nitter.net/jack"), "https://x.com/jack");
});

test("uses a frontend host when given, for all X URLs", () => {
  const options = { frontendHost: "nitter.example.com" };

  assert.equal(
    resolveQuickActionUrl("https://x.com/jack/status/20?s=20#frag", options),
    "https://nitter.example.com/jack/status/20?s=20#frag"
  );
  assert.equal(resolveQuickActionUrl("https://x.com/home", options), "https://nitter.example.com/home");
  assert.equal(
    resolveQuickActionUrl("https://nitter.example.com/jack/status/20", options),
    "https://nitter.example.com/jack/status/20"
  );
});

test("returns null for non-target input", () => {
  assert.equal(resolveQuickActionUrl("https://example.com/story"), null);
  assert.equal(resolveQuickActionUrl("not a URL"), null);
});
