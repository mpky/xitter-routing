import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// Load the pure URL functions from the Scriptable file.
// Everything before collectInputCandidates() is pure JS with no Scriptable deps.
const scriptSource = readFileSync(
  new URL("../scriptable/open-via-xcancel.js", import.meta.url),
  "utf-8"
)

const pureSection = scriptSource.slice(
  0,
  scriptSource.indexOf("function collectInputCandidates()")
)

const createModule = new Function(`
  ${pureSection}
  return { extractFirstSupportedUrl, normalizeCandidateUrl, rewriteStatusUrl }
`)

const { extractFirstSupportedUrl, normalizeCandidateUrl, rewriteStatusUrl } =
  createModule()

// --- extractFirstSupportedUrl ---

test("extracts URL from clean status URL string", () => {
  assert.equal(
    extractFirstSupportedUrl("https://x.com/jack/status/20"),
    "https://x.com/jack/status/20"
  )
})

test("extracts URL from text containing a status URL", () => {
  assert.equal(
    extractFirstSupportedUrl("Check this out https://x.com/jack/status/20 wow"),
    "https://x.com/jack/status/20"
  )
})

test("extracts URL from twitter.com status URL", () => {
  assert.equal(
    extractFirstSupportedUrl("https://twitter.com/jack/status/20?s=20#frag"),
    "https://twitter.com/jack/status/20?s=20#frag"
  )
})

test("extracts URL from mobile.twitter.com", () => {
  assert.equal(
    extractFirstSupportedUrl("https://mobile.twitter.com/user/status/999"),
    "https://mobile.twitter.com/user/status/999"
  )
})

test("extracts xcancel.com URL", () => {
  assert.equal(
    extractFirstSupportedUrl("https://xcancel.com/jack/status/20"),
    "https://xcancel.com/jack/status/20"
  )
})

test("returns null for file:// paths from Shortcuts", () => {
  assert.equal(
    extractFirstSupportedUrl(
      "file:///var/mobile/tmp/com.apple.WorkflowKit.BackgroundShortcutRunner/com.apple.WorkflowKit.BackgroundShortcutRunner/2029875750644461726.html"
    ),
    null
  )
})

test("returns null for empty string", () => {
  assert.equal(extractFirstSupportedUrl(""), null)
})

test("returns null for unrelated URLs", () => {
  assert.equal(extractFirstSupportedUrl("https://example.com/page"), null)
})

test("returns null for bare domain without path", () => {
  assert.equal(extractFirstSupportedUrl("https://x.com"), null)
})

test("extracts URL from HTML-like content", () => {
  assert.equal(
    extractFirstSupportedUrl(
      '<a href="https://x.com/jack/status/20">link</a>'
    ),
    "https://x.com/jack/status/20"
  )
})

test("extracts URL from markdown-like content", () => {
  assert.equal(
    extractFirstSupportedUrl(
      "Here is a link: [tweet](https://x.com/jack/status/20)"
    ),
    "https://x.com/jack/status/20"
  )
})

test("extracts non-status X URL", () => {
  assert.equal(
    extractFirstSupportedUrl("https://x.com/jack"),
    "https://x.com/jack"
  )
})

test("handles schemeless URL", () => {
  assert.equal(
    extractFirstSupportedUrl("x.com/jack/status/20"),
    "https://x.com/jack/status/20"
  )
})

// --- rewriteStatusUrl ---

test("rewrites x.com status URL to xcancel.com", () => {
  assert.equal(
    rewriteStatusUrl("https://x.com/jack/status/20"),
    "https://xcancel.com/jack/status/20"
  )
})

test("rewrites twitter.com status URL to xcancel.com", () => {
  assert.equal(
    rewriteStatusUrl("https://twitter.com/user/status/123?s=20"),
    "https://xcancel.com/user/status/123?s=20"
  )
})

test("rewrites status URL found in surrounding text", () => {
  assert.equal(
    rewriteStatusUrl("Look at this https://x.com/jack/status/20 nice"),
    "https://xcancel.com/jack/status/20"
  )
})

test("returns original URL for non-status X paths", () => {
  assert.equal(
    rewriteStatusUrl("https://x.com/home"),
    "https://x.com/home"
  )
})

test("passes through xcancel.com URLs unchanged", () => {
  assert.equal(
    rewriteStatusUrl("https://xcancel.com/jack/status/20"),
    "https://xcancel.com/jack/status/20"
  )
})

test("returns null for file:// Shortcuts garbage", () => {
  assert.equal(
    rewriteStatusUrl(
      "file:///var/mobile/tmp/com.apple.WorkflowKit.BackgroundShortcutRunner/2029875750644461726.html"
    ),
    null
  )
})

test("returns null for empty input", () => {
  assert.equal(rewriteStatusUrl(""), null)
})

test("returns null for unrelated domain", () => {
  assert.equal(rewriteStatusUrl("https://example.com/page"), null)
})

test("handles URL as the only input (normalizeCandidateUrl fallback)", () => {
  // This tests the ?? fallback path in rewriteStatusUrl
  // normalizeCandidateUrl handles bare URLs that the regex might miss
  assert.equal(
    rewriteStatusUrl("https://x.com/jack/status/20"),
    "https://xcancel.com/jack/status/20"
  )
})

test("rewrites schemeless URL from text", () => {
  assert.equal(
    rewriteStatusUrl("x.com/jack/status/20"),
    "https://xcancel.com/jack/status/20"
  )
})
