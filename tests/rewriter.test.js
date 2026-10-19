import test from "node:test";
import assert from "node:assert/strict";

import {
  REDIRECT_MODES,
  VIEWERS,
  buildEmbedUrl,
  normalizeFrontendHost,
  parseStatusPath,
  resolveViewerUrl,
  rewriteUrl,
  shouldRewritePath,
  shouldRewriteHostname
} from "../extension/src/shared/rewriter.js";

const READER = "chrome-extension://abc/src/reader.html";

test("reader viewer sends status URLs to the reader with a canonical x.com URL", () => {
  assert.equal(
    resolveViewerUrl("https://twitter.com/jack/status/20?s=20#frag", { readerBaseUrl: READER }),
    `${READER}?url=${encodeURIComponent("https://x.com/jack/status/20")}`
  );
  assert.equal(
    resolveViewerUrl("http://mobile.twitter.com/i/status/123/photo/1", { readerBaseUrl: READER }),
    `${READER}?url=${encodeURIComponent("https://x.com/i/status/123")}`
  );
});

test("reader viewer leaves non-status URLs alone, even in all mode", () => {
  assert.equal(resolveViewerUrl("https://x.com/home", { readerBaseUrl: READER }), null);
  assert.equal(
    resolveViewerUrl("https://x.com/jack", {
      readerBaseUrl: READER,
      redirectMode: REDIRECT_MODES.ALL
    }),
    null
  );
});

test("reader viewer falls back to the embed page without a reader base URL", () => {
  assert.equal(
    resolveViewerUrl("https://x.com/jack/status/20"),
    "https://platform.twitter.com/embed/Tweet.html?id=20&dnt=true"
  );
});

test("embed viewer sends status URLs to X's embed page", () => {
  assert.equal(
    resolveViewerUrl("https://x.com/jack/status/20", {
      readerBaseUrl: READER,
      viewer: VIEWERS.EMBED
    }),
    buildEmbedUrl("20")
  );
});

test("host viewer swaps the domain and respects redirect mode", () => {
  const options = { frontendHost: "nitter.example.com", viewer: VIEWERS.HOST };

  assert.equal(
    resolveViewerUrl("https://twitter.com/jack/status/20?s=20#frag", options),
    "https://nitter.example.com/jack/status/20?s=20#frag"
  );
  assert.equal(resolveViewerUrl("https://x.com/home", options), null);
  assert.equal(
    resolveViewerUrl("https://x.com/home", { ...options, redirectMode: REDIRECT_MODES.ALL }),
    "https://nitter.example.com/home"
  );
});

test("host viewer without a host falls back to the reader", () => {
  assert.equal(
    resolveViewerUrl("https://x.com/jack/status/20", {
      frontendHost: "",
      readerBaseUrl: READER,
      viewer: VIEWERS.HOST
    }),
    `${READER}?url=${encodeURIComponent("https://x.com/jack/status/20")}`
  );
});

test("dead mirror links are routed to the viewer or back to X", () => {
  assert.equal(
    resolveViewerUrl("https://xcancel.com/jack/status/20", { readerBaseUrl: READER }),
    `${READER}?url=${encodeURIComponent("https://x.com/jack/status/20")}`
  );
  assert.equal(
    resolveViewerUrl("https://nitter.net/jack", { readerBaseUrl: READER }),
    "https://x.com/jack"
  );
});

test("does not route non-target domains or malformed URLs", () => {
  assert.equal(resolveViewerUrl("https://example.com/user/status/123"), null);
  assert.equal(resolveViewerUrl("not a url"), null);
  assert.equal(resolveViewerUrl(""), null);
});

test("rewriteUrl requires a valid target host", () => {
  assert.equal(rewriteUrl("https://x.com/user/status/123"), null);
  assert.equal(
    rewriteUrl("http://mobile.twitter.com/user/status/123", { targetHost: "https://Nitter.Example.com/" }),
    "https://nitter.example.com/user/status/123"
  );
});

test("normalizeFrontendHost cleans input and rejects X itself", () => {
  assert.equal(normalizeFrontendHost(" https://Nitter.Example.com/some/path "), "nitter.example.com");
  assert.equal(normalizeFrontendHost("nitter.example.com:8443"), "nitter.example.com:8443");
  assert.equal(normalizeFrontendHost("x.com"), "");
  assert.equal(normalizeFrontendHost("localhost"), "");
  assert.equal(normalizeFrontendHost("not a host"), "");
  assert.equal(normalizeFrontendHost(undefined), "");
});

test("parseStatusPath extracts handle and id", () => {
  assert.deepEqual(parseStatusPath("/jack/status/20"), { handle: "jack", id: "20" });
  assert.deepEqual(parseStatusPath("/i/status/456/"), { handle: "i", id: "456" });
  assert.equal(parseStatusPath("/home"), null);
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
