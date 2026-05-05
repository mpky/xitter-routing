// Open via xcancel for Scriptable on iOS
// Run from Scriptable directly or via a Shortcut that passes input text/URL.

// Bump on every meaningful change. Surfaced in alerts and the script's success
// notification so you can verify which version is on the device.
const SCRIPT_VERSION = "2026-05-05T22:00Z+files"

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
const MAX_FILE_CANDIDATE_CHARS = 300000

// Scriptable's JavaScriptCore does NOT expose the global `URL` constructor, so
// `new URL(...)` throws ReferenceError in this runtime. parseSupportedUrl is a
// regex-based stand-in that handles the URL shapes we care about.
const SUPPORTED_URL_SHAPE =
  /^(?:https?:\/\/)?((?:www\.|mobile\.)?(?:x\.com|twitter\.com|xcancel\.com))(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i

function parseSupportedUrl(input) {
  if (typeof input !== "string") {
    return null
  }
  const match = input.trim().match(SUPPORTED_URL_SHAPE)
  if (!match) {
    return null
  }
  return {
    hostname: match[1].toLowerCase(),
    pathname: match[2] || "/",
    search: match[3] || "",
    hash: match[4] || ""
  }
}

function buildSupportedUrl({ hostname, pathname, search, hash }) {
  return `https://${hostname}${pathname}${search}${hash}`
}

function normalizeFilePath(value) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  if (trimmed === "") {
    return null
  }

  let path = null
  if (/^file:\/\//i.test(trimmed)) {
    path = trimmed.replace(/^file:\/\//i, "")
    if (path.startsWith("localhost/")) {
      path = path.slice("localhost".length)
    }
    if (!path.startsWith("/")) {
      path = "/" + path
    }
  } else if (trimmed.startsWith("/")) {
    path = trimmed
  }

  if (!path) {
    return null
  }

  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

function readFileTextCandidate(value) {
  const filePath = normalizeFilePath(value)
  if (!filePath || typeof FileManager === "undefined") {
    return null
  }

  try {
    const fm = FileManager.local()
    if (typeof fm.fileExists === "function" && !fm.fileExists(filePath)) {
      return null
    }

    const text = fm.readString(filePath)
    if (typeof text !== "string" || text.trim() === "") {
      return null
    }

    return text.slice(0, MAX_FILE_CANDIDATE_CHARS)
  } catch {
    return null
  }
}

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

    const parts = parseSupportedUrl(normalizedUrl)

    if (!parts) {
      continue
    }

    if (parts.hostname === DEFAULT_TARGET_HOST || TARGET_HOSTS.has(parts.hostname)) {
      return normalizedUrl
    }
  }

  return null
}

function rewriteStatusUrl(rawInput) {
  const candidateUrl = extractFirstSupportedUrl(rawInput) ?? normalizeCandidateUrl(rawInput)

  if (!candidateUrl) {
    return null
  }

  const parts = parseSupportedUrl(candidateUrl)

  if (!parts) {
    return null
  }

  if (parts.hostname === DEFAULT_TARGET_HOST) {
    return buildSupportedUrl(parts)
  }

  if (!TARGET_HOSTS.has(parts.hostname)) {
    return null
  }

  if (!STATUS_PATH_PATTERN.test(parts.pathname)) {
    return buildSupportedUrl(parts)
  }

  return buildSupportedUrl({ ...parts, hostname: DEFAULT_TARGET_HOST })
}

function addTextCandidate(candidates, source, value) {
  const text = String(value).trim()
  if (text === "") {
    return
  }

  candidates.push({ source, value: text })

  const fileText = readFileTextCandidate(text)
  if (fileText) {
    candidates.push({ source: `${source}.fileText`, value: fileText })
  }
}

function collectStructuredCandidate(candidates, source, value, depth = 0) {
  if (value === null || value === undefined || depth > 4) {
    return
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    addTextCandidate(candidates, source, value)
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectStructuredCandidate(candidates, `${source}[${index}]`, item, depth + 1)
    })
    return
  }

  if (typeof value === "object") {
    for (const [key, val] of Object.entries(value)) {
      collectStructuredCandidate(candidates, `${source}.${key}`, val, depth + 1)
    }

    const text = String(value).trim()
    if (text !== "" && text !== "[object Object]") {
      addTextCandidate(candidates, source, text)
    }
  }
}

function collectInputCandidates() {
  const candidates = []

  collectStructuredCandidate(candidates, "shortcutParameter", args.shortcutParameter)

  if (args.urls?.length) {
    args.urls.forEach((u, index) => {
      collectStructuredCandidate(candidates, `args.urls[${index}]`, u)
    })
  }

  if (args.plainTexts?.length) {
    args.plainTexts.forEach((t, index) => {
      collectStructuredCandidate(candidates, `args.plainTexts[${index}]`, t)
    })
  }

  if (args.fileURLs?.length) {
    args.fileURLs.forEach((f, index) => {
      collectStructuredCandidate(candidates, `args.fileURLs[${index}]`, f)
    })
  }

  if (args.all?.length) {
    args.all.forEach((item, index) => {
      collectStructuredCandidate(candidates, `args.all[${index}]`, item)
    })
  }

  if (args.queryParameters) {
    for (const [key, val] of Object.entries(args.queryParameters)) {
      collectStructuredCandidate(candidates, `queryParam.${key}`, val)
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

function summarizeCandidates(candidates) {
  if (candidates.length === 0) {
    return "no input"
  }
  return candidates
    .map((c) => `${c.source}=${JSON.stringify(c.value).slice(0, 80)}`)
    .join(" | ")
}

async function fail(message, candidates = []) {
  const dump = summarizeCandidates(candidates)
  const stamped = `${message}\n\nv${SCRIPT_VERSION}\nInputs: ${dump}`

  if (isShortcutContext()) {
    Script.setShortcutOutput(stamped)
    return
  }

  await showAlert(`Open via xcancel v${SCRIPT_VERSION}`, `${message}\n\nInputs: ${dump}`)
}

function notifyDirectRunSuccess(finalUrl) {
  try {
    const notification = new Notification()
    notification.title = `Open via xcancel v${SCRIPT_VERSION}`
    notification.body = `Opening ${finalUrl}`
    notification.schedule()
  } catch {
    // Notifications may be denied; opening Safari is the real signal.
  }
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
      "No supported X, Twitter, or xcancel URL was found in the shared input or clipboard.",
      candidates
    )
    return
  }

  if (isShortcutContext()) {
    // The script's job is to transform the URL. The host Shortcut opens it via
    // an "Open URLs" action chained after Run Script — this is the only
    // reliable way to navigate from a Shortcut context, since Scriptable's
    // Run Script action runs without a foreground UI surface and
    // Safari.openInApp() silently fails to present anything.
    Script.setShortcutOutput(finalUrl)
    return
  }

  notifyDirectRunSuccess(finalUrl)

  try {
    await Safari.openInApp(finalUrl, false)
  } catch {
    // openInApp is the reliable path; fall back to external Safari only on error.
    Safari.open(finalUrl)
  }
}

await main()
