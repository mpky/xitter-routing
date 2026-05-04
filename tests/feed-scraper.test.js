import test from "node:test";
import assert from "node:assert/strict";

import {
  FEED_PATHS,
  isFeedUrl,
  pickTopPosts
} from "../extension/src/shared/feed-scraper.js";

test("isFeedUrl matches feed paths on x.com and twitter.com", () => {
  assert.equal(isFeedUrl("https://x.com/"), true);
  assert.equal(isFeedUrl("https://x.com/home"), true);
  assert.equal(isFeedUrl("https://x.com/home/"), true);
  assert.equal(isFeedUrl("https://twitter.com/home"), true);
  assert.equal(isFeedUrl("https://mobile.x.com/i/timeline"), true);
});

test("isFeedUrl rejects non-feed paths and non-target hosts", () => {
  assert.equal(isFeedUrl("https://x.com/explore"), false);
  assert.equal(isFeedUrl("https://x.com/jack/status/20"), false);
  assert.equal(isFeedUrl("https://x.com/notifications"), false);
  assert.equal(isFeedUrl("https://example.com/home"), false);
  assert.equal(isFeedUrl(""), false);
  assert.equal(isFeedUrl("not a url"), false);
});

test("FEED_PATHS exposes the canonical feed entry points", () => {
  assert.equal(FEED_PATHS.has("/"), true);
  assert.equal(FEED_PATHS.has("/home"), true);
  assert.equal(FEED_PATHS.has("/i/timeline"), true);
});

test("pickTopPosts normalizes status paths to xcancel-ready x.com URLs", () => {
  const candidates = [
    { statusPath: "/jack/status/20" },
    { statusPath: "/i/status/777" },
    { statusPath: "https://x.com/foo/status/42/photo/1" }
  ];
  assert.deepEqual(pickTopPosts(candidates, 3), [
    "https://x.com/jack/status/20",
    "https://x.com/i/status/777",
    "https://x.com/foo/status/42"
  ]);
});

test("pickTopPosts skips ads and pinned posts", () => {
  const candidates = [
    { statusPath: "/spammer/status/1", isAd: true },
    { statusPath: "/realposter/status/2", isPinned: true },
    { statusPath: "/realposter/status/3" },
    { statusPath: "/another/status/4" }
  ];
  assert.deepEqual(pickTopPosts(candidates, 5), [
    "https://x.com/realposter/status/3",
    "https://x.com/another/status/4"
  ]);
});

test("pickTopPosts deduplicates and respects count", () => {
  const candidates = [
    { statusPath: "/a/status/1" },
    { statusPath: "/a/status/1/photo/2" },
    { statusPath: "/b/status/2" },
    { statusPath: "/c/status/3" }
  ];
  assert.deepEqual(pickTopPosts(candidates, 2), [
    "https://x.com/a/status/1",
    "https://x.com/b/status/2"
  ]);
});

test("pickTopPosts ignores malformed entries", () => {
  const candidates = [
    null,
    {},
    { statusPath: "/not/a/status/path" },
    { statusPath: "/jack/status/20" }
  ];
  assert.deepEqual(pickTopPosts(candidates, 3), ["https://x.com/jack/status/20"]);
});

test("pickTopPosts returns [] when count is non-positive or input is invalid", () => {
  assert.deepEqual(pickTopPosts([], 5), []);
  assert.deepEqual(pickTopPosts(null, 5), []);
  assert.deepEqual(pickTopPosts([{ statusPath: "/jack/status/20" }], 0), []);
});
