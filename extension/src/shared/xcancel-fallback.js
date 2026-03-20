import { normalizeHostname, shouldRewritePath } from "./rewriter.js"

export const XCANCEL_HOSTS = new Set([
  "xcancel.com",
  "www.xcancel.com"
])

const PROTECTED_ACCOUNT_PATTERNS = [
  /this account'?s tweets are protected/i,
  /only confirmed followers have access/i
]

const VERIFICATION_PAGE_PATTERNS = [
  /verifying your request/i,
  /original twitter\/x link/i
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

export function isVerificationInterstitialPage(page = {}) {
  const pageText = `${page.title ?? ""}\n${page.textContent ?? ""}`.trim()

  if (pageText === "") {
    return false
  }

  return VERIFICATION_PAGE_PATTERNS.every((pattern) => pattern.test(pageText))
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

export function shouldFallbackFromXcancelPage(page = {}) {
  return (
    isProtectedAccountPage(page) ||
    isVerificationInterstitialPage(page) ||
    isNotFoundErrorPage(page)
  )
}

export function getProtectedPostFallbackUrlForPage(input, page = {}) {
  if (!shouldFallbackFromXcancelPage(page)) {
    return null
  }

  return getProtectedPostFallbackUrl(input)
}
