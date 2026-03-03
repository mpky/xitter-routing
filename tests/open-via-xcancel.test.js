import test from "node:test";
import assert from "node:assert/strict";

import {
  extractFirstSupportedUrl,
  normalizeCandidateUrl,
  resolveQuickActionUrl
} from "../scripts/lib/open-via-xcancel.js";

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

test("resolves X/Twitter URLs to xcancel using all mode", () => {
  assert.equal(
    resolveQuickActionUrl("https://x.com/home"),
    "https://xcancel.com/home"
  );
  assert.equal(
    resolveQuickActionUrl("https://twitter.com/jack"),
    "https://xcancel.com/jack"
  );
});

test("preserves existing xcancel URLs", () => {
  assert.equal(
    resolveQuickActionUrl("https://xcancel.com/jack/status/20"),
    "https://xcancel.com/jack/status/20"
  );
});

test("returns null for non-target input", () => {
  assert.equal(resolveQuickActionUrl("https://example.com/story"), null);
  assert.equal(resolveQuickActionUrl("not a URL"), null);
});
