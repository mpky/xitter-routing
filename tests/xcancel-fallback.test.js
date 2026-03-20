import test from "node:test"
import assert from "node:assert/strict"

import {
  getProtectedPostFallbackUrlForPage,
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
