// Open via xcancel for Scriptable on iOS
// Run from Scriptable directly or via a Shortcut that passes input text/URL.

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

function resolveInputText() {
  const shortcutInput = args.shortcutParameter

  if (shortcutInput !== null && shortcutInput !== undefined) {
    const normalizedShortcutInput = String(shortcutInput).trim()

    if (normalizedShortcutInput !== "") {
      return normalizedShortcutInput
    }
  }

  if (args.plainTexts?.length) {
    return args.plainTexts.join("\n")
  }

  if (args.urls?.length) {
    return String(args.urls[0])
  }

  const clipboardText = Pasteboard.pasteString()
  return typeof clipboardText === "string" ? clipboardText : ""
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
  const inputText = resolveInputText()

  Script.setShortcutOutput("DEBUG input: [" + inputText + "]")
  return

  const finalUrl = rewriteStatusUrl(inputText)

  if (!finalUrl) {
    await fail(
      "No supported X, Twitter, or xcancel URL was found in the shared input or clipboard."
    )
    return
  }

  if (isShortcutContext()) {
    Script.setShortcutOutput(finalUrl)
    return
  }

  Safari.open(finalUrl)
}

await main()
