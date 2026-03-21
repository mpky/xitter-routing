import test from "node:test"
import assert from "node:assert/strict"

import {
  DELAYED_ERROR_FALLBACK_MS,
  getFallbackReasonForXcancelPage,
  getProtectedPostFallbackUrlForPage,
  isForbiddenErrorPage,
  isNotFoundErrorPage,
  isProtectedAccountPage,
  isXcancelHostname
} from "../extension/src/shared/xcancel-fallback.js"

test("matches xcancel hostnames only", () => {
  assert.equal(isXcancelHostname("xcancel.com"), true)
  assert.equal(isXcancelHostname("www.xcancel.com"), true)
  assert.equal(isXcancelHostname("x.com"), false)
})

test("detects protected-account copy in page content", () => {
  assert.equal(
    isProtectedAccountPage({
      textContent: "This account's tweets are protected. Only confirmed followers have access to @user's tweets."
    }),
    true
  )
})

test("falls back from a protected xcancel status page to x.com", () => {
  assert.equal(
    getProtectedPostFallbackUrlForPage("https://xcancel.com/someone/status/123?s=20#frag", {
      textContent: "This account's tweets are protected. Only confirmed followers have access to @someone's tweets."
    }),
    "https://x.com/someone/status/123?s=20#frag"
  )
})

test("classifies protected-account fallback pages", () => {
  assert.equal(
    getFallbackReasonForXcancelPage({
      textContent: "This account's tweets are protected. Only confirmed followers have access to @someone's tweets."
    }),
    "protected-account"
  )
})

test("does not fall back from an xcancel verification interstitial", () => {
  assert.equal(
    getProtectedPostFallbackUrlForPage("https://xcancel.com/someone/status/123?s=20#frag", {
      title: "X Cancelled | Verifying your request",
      textContent: "Sorry this pages exist in order to keep the service usable for everyone. Want to access the original Twitter/X link? click here"
    }),
    null
  )
})

test("detects xcancel forbidden error pages", () => {
  assert.equal(
    isForbiddenErrorPage({
      title: "403 Forbidden",
      textContent: "403 Forbidden openresty"
    }),
    true
  )
})

test("detects xcancel forbidden pages from the title alone", () => {
  assert.equal(
    isForbiddenErrorPage({
      title: "403 Forbidden"
    }),
    true
  )
})

test("classifies forbidden fallback pages", () => {
  assert.equal(
    getFallbackReasonForXcancelPage({
      title: "403 Forbidden"
    }),
    "forbidden"
  )
})

test("does not fall back from an xcancel forbidden status page before the grace period", () => {
  assert.equal(
    getProtectedPostFallbackUrlForPage(
      "https://xcancel.com/someone/status/123?s=20#frag",
      {
        title: "403 Forbidden",
        textContent: "403 Forbidden openresty"
      },
      {
        elapsedMs: DELAYED_ERROR_FALLBACK_MS - 1
      }
    ),
    null
  )
})

test("falls back from an xcancel forbidden status page to x.com after the grace period", () => {
  assert.equal(
    getProtectedPostFallbackUrlForPage(
      "https://xcancel.com/someone/status/123?s=20#frag",
      {
        title: "403 Forbidden",
        textContent: "403 Forbidden openresty"
      },
      {
        elapsedMs: DELAYED_ERROR_FALLBACK_MS
      }
    ),
    "https://x.com/someone/status/123?s=20#frag"
  )
})

test("detects xcancel not-found error pages", () => {
  assert.equal(
    isNotFoundErrorPage({
      title: "Error | XCancel",
      textContent: "Tweet not found"
    }),
    true
  )
})

test("classifies not-found fallback pages", () => {
  assert.equal(
    getFallbackReasonForXcancelPage({
      title: "Error | XCancel",
      textContent: "Tweet not found"
    }),
    "not-found"
  )
})

test("does not fall back from an xcancel not-found page before the grace period", () => {
  assert.equal(
    getProtectedPostFallbackUrlForPage(
      "https://xcancel.com/someone/status/123?s=20#frag",
      {
        title: "Error | XCancel",
        textContent: "Tweet not found"
      },
      {
        elapsedMs: DELAYED_ERROR_FALLBACK_MS - 1
      }
    ),
    null
  )
})

test("falls back from an xcancel not-found page after the grace period", () => {
  assert.equal(
    getProtectedPostFallbackUrlForPage(
      "https://xcancel.com/someone/status/123?s=20#frag",
      {
        title: "Error | XCancel",
        textContent: "Tweet not found"
      },
      {
        elapsedMs: DELAYED_ERROR_FALLBACK_MS
      }
    ),
    "https://x.com/someone/status/123?s=20#frag"
  )
})

test("does not fall back for non-status xcancel pages", () => {
  assert.equal(
    getProtectedPostFallbackUrlForPage("https://xcancel.com/someone", {
      textContent: "This account's tweets are protected. Only confirmed followers have access to @someone's tweets."
    }),
    null
  )
})

test("does not fall back when the page is not a protected-account error", () => {
  assert.equal(
    getProtectedPostFallbackUrlForPage("https://xcancel.com/someone/status/123", {
      textContent: "A normal public post page"
    }),
    null
  )
})
