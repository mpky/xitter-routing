import { normalizeHostname, shouldRewritePath } from "./rewriter.js"

export const XCANCEL_HOSTS = new Set([
  "xcancel.com",
  "www.xcancel.com"
])

export const DELAYED_ERROR_FALLBACK_MS = 2_000

const PROTECTED_ACCOUNT_PATTERNS = [
  /this account'?s tweets are protected/i,
  /only confirmed followers have access/i
]

const FORBIDDEN_PAGE_PATTERNS = [
  /403 forbidden/i,
  /access denied/i
]

const NOT_FOUND_PAGE_PATTERNS = [
  /error\s*\|\s*xcancel/i,
  /tweet not found/i
]

export function isXcancelHostname(hostname) {
  return XCANCEL_HOSTS.has(normalizeHostname(hostname))
}

export function isProtectedAccountPage(page = {}) {
  const pageText = `${page.title ?? ""}\n${page.textContent ?? ""}`.trim()

  if (pageText === "") {
    return false
  }

  return PROTECTED_ACCOUNT_PATTERNS.every((pattern) => pattern.test(pageText))
}

export function isForbiddenErrorPage(page = {}) {
  const pageText = `${page.title ?? ""}\n${page.textContent ?? ""}`.trim()

  if (pageText === "") {
    return false
  }

  return (
    /403 forbidden/i.test(pageText) ||
    FORBIDDEN_PAGE_PATTERNS.every((pattern) => pattern.test(pageText))
  )
}

export function isNotFoundErrorPage(page = {}) {
  const pageText = `${page.title ?? ""}\n${page.textContent ?? ""}`.trim()

  if (pageText === "") {
    return false
  }

  return NOT_FOUND_PAGE_PATTERNS.every((pattern) => pattern.test(pageText))
}

export function getProtectedPostFallbackUrl(input) {
  if (typeof input !== "string" || input.trim() === "") {
    return null
  }

  let parsedUrl

  try {
    parsedUrl = new URL(input)
  } catch {
    return null
  }

  if (!isXcancelHostname(parsedUrl.hostname)) {
    return null
  }

  if (!shouldRewritePath(parsedUrl.pathname)) {
    return null
  }

  parsedUrl.protocol = "https:"
  parsedUrl.hostname = "x.com"
  parsedUrl.port = ""

  return parsedUrl.toString()
}

export function getFallbackReasonForXcancelPage(page = {}) {
  if (isProtectedAccountPage(page)) {
    return "protected-account"
  }

  if (isForbiddenErrorPage(page)) {
    return "forbidden"
  }

  if (isNotFoundErrorPage(page)) {
    return "not-found"
  }

  return null
}

export function getPageTextSnippet(page = {}, maxLength = 220) {
  const pageText = `${page.title ?? ""}\n${page.textContent ?? ""}`
    .replace(/\s+/g, " ")
    .trim()

  if (pageText === "") {
    return ""
  }

  return pageText.slice(0, maxLength)
}

export function shouldFallbackFromXcancelPage(page = {}, options = {}) {
  const {
    delayedFallbackMs = DELAYED_ERROR_FALLBACK_MS,
    elapsedMs = 0
  } = options
  const reason = getFallbackReasonForXcancelPage(page)

  if (reason === "protected-account") {
    return true
  }

  if (reason === "forbidden" || reason === "not-found") {
    return elapsedMs >= delayedFallbackMs
  }

  return false
}

export function getProtectedPostFallbackUrlForPage(input, page = {}, options = {}) {
  if (!shouldFallbackFromXcancelPage(page, options)) {
    return null
  }

  return getProtectedPostFallbackUrl(input)
}
