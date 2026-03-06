// Open via xcancel for Scriptable on iOS
// Run from Scriptable directly or via a Shortcut that passes input text/URL.

// Set to true to dump all input sources instead of redirecting.
const DEBUG = false

const TARGET_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "mobile.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com"
])

const DEFAULT_TARGET_HOST = "xcancel.com"
const SCHEMELESS_URL_PATTERN =
  /\b(?:(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x\.com|twitter\.com|xcancel\.com)\/[^\s<>"'`)\]}]+)/gi
const STATUS_PATH_PATTERN = /^\/(?:i\/status\/\d+|[^/]+\/status\/\d+)(?:\/.*)?$/i

function stripTrailingPunctuation(value) {
  return value.replace(/[.,!?;:]+$/u, "")
}

function normalizeCandidateUrl(value) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = stripTrailingPunctuation(value.trim())

  if (trimmed === "") {
    return null
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  if (/^(?:www\.|mobile\.)?(?:x\.com|twitter\.com|xcancel\.com)\//i.test(trimmed)) {
    return `https://${trimmed}`
  }

  return null
}

function extractFirstSupportedUrl(text) {
  if (typeof text !== "string" || text.trim() === "") {
    return null
  }

  for (const match of text.matchAll(SCHEMELESS_URL_PATTERN)) {
    const normalizedUrl = normalizeCandidateUrl(match[0])

    if (!normalizedUrl) {
      continue
    }

    try {
      const parsedUrl = new URL(normalizedUrl)
      const hostname = parsedUrl.hostname.trim().toLowerCase()

      if (hostname === DEFAULT_TARGET_HOST || TARGET_HOSTS.has(hostname)) {
        return normalizedUrl
      }
    } catch {
      continue
    }
  }

  return null
}

function rewriteStatusUrl(rawInput) {
  const candidateUrl = extractFirstSupportedUrl(rawInput) ?? normalizeCandidateUrl(rawInput)

  if (!candidateUrl) {
    return null
  }

  let parsedUrl

  try {
    parsedUrl = new URL(candidateUrl)
  } catch {
    return null
  }

  const hostname = parsedUrl.hostname.trim().toLowerCase()

  if (hostname === DEFAULT_TARGET_HOST) {
    return parsedUrl.toString()
  }

  if (!TARGET_HOSTS.has(hostname)) {
    return null
  }

  if (!STATUS_PATH_PATTERN.test(parsedUrl.pathname)) {
    return parsedUrl.toString()
  }

  parsedUrl.protocol = "https:"
  parsedUrl.hostname = DEFAULT_TARGET_HOST
  parsedUrl.port = ""

  return parsedUrl.toString()
}

function collectInputCandidates() {
  const candidates = []

  const sp = args.shortcutParameter
  if (sp !== null && sp !== undefined) {
    const text = String(sp).trim()
    if (text !== "") {
      candidates.push({ source: "shortcutParameter", value: text })
    }
  }

  if (args.urls?.length) {
    for (const u of args.urls) {
      candidates.push({ source: "args.urls", value: String(u) })
    }
  }

  if (args.plainTexts?.length) {
    for (const t of args.plainTexts) {
      candidates.push({ source: "args.plainTexts", value: String(t) })
    }
  }

  if (args.queryParameters) {
    for (const [key, val] of Object.entries(args.queryParameters)) {
      if (val) {
        candidates.push({ source: "queryParam." + key, value: String(val) })
      }
    }
  }

  try {
    const clip = Pasteboard.pasteString()
    if (typeof clip === "string" && clip.trim() !== "") {
      candidates.push({ source: "clipboard", value: clip })
    }
  } catch {
    // clipboard may not be available
  }

  return candidates
}

async function showAlert(title, message) {
  const alert = new Alert()
  alert.title = title
  alert.message = message
  alert.addAction("OK")
  await alert.present()
}

function isShortcutContext() {
  return Boolean(config.runsWithSiri || args.shortcutParameter !== null)
}

async function fail(message) {
  if (isShortcutContext()) {
    Script.setShortcutOutput(message)
    return
  }

  await showAlert("Open via xcancel", message)
}

async function main() {
  const candidates = collectInputCandidates()

  if (DEBUG) {
    const dump = JSON.stringify(candidates.map(c => ({
      source: c.source,
      value: c.value.slice(0, 300)
    })), null, 2)

    const fm = FileManager.iCloud()
    const debugPath = fm.joinPath(fm.documentsDirectory(), "xcancel-debug.json")
    fm.writeString(debugPath, dump)

    if (isShortcutContext()) {
      Script.setShortcutOutput("DEBUG:\n" + dump)
      return
    }

    Script.complete()
    return
  }

  let finalUrl = null

  for (const { value } of candidates) {
    finalUrl = rewriteStatusUrl(value)
    if (finalUrl) break
  }

  if (!finalUrl) {
    await fail(
      "No supported X, Twitter, or xcancel URL was found in the shared input or clipboard."
    )
    return
  }

  if (isShortcutContext()) {
    try {
      Safari.openInApp(finalUrl, false)
    } catch {
      Script.setShortcutOutput(finalUrl)
    }
    return
  }

  Safari.open(finalUrl)
}

await main()
