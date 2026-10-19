import {
  buildCanonicalStatusUrl,
  buildEmbedUrl,
  parseStatusPath
} from "./shared/rewriter.js"
import {
  SOURCE_LABELS,
  escapeHtml,
  fetchTweet,
  renderTweetArticle
} from "./shared/tweet-reader.js"
import { appendDiagnosticLog, registerFallbackBypass } from "./storage.js"

const FETCH_TIMEOUT_MS = 8_000

const contentNode = document.querySelector("#content")
const openOnXButton = document.querySelector("#open-on-x")
const openEmbedLink = document.querySelector("#open-embed")
const sourceNoteNode = document.querySelector("#source-note")

function logDiagnostic(action, fields = {}) {
  return appendDiagnosticLog({
    action,
    source: "reader",
    timestamp: Date.now(),
    ...fields
  }).catch(() => {})
}

async function fetchJson(url) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      credentials: "omit",
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

function getStatusRef() {
  const target = new URLSearchParams(window.location.search).get("url") ?? ""

  try {
    return parseStatusPath(new URL(target).pathname)
  } catch {
    return null
  }
}

function renderFailure(attempts) {
  const items = attempts
    .map((attempt) => `<li>${escapeHtml(SOURCE_LABELS[attempt.source] ?? attempt.source)}: ${escapeHtml(attempt.error)}</li>`)
    .join("")

  contentNode.innerHTML = [
    "<p>Couldn’t load this post from any login-free source. It may be",
    " protected, deleted, or age-restricted, or the sources may be down.</p>",
    items ? `<ul class="attempts">${items}</ul>` : ""
  ].join("")
}

async function main() {
  const statusRef = getStatusRef()

  if (!statusRef) {
    contentNode.innerHTML = "<p>This page needs an X post URL.</p>"
    openOnXButton.hidden = true
    openEmbedLink.hidden = true
    return
  }

  // Extension CSP forbids inline onerror, so hide broken images from here.
  contentNode.addEventListener("error", (event) => {
    if (event.target instanceof HTMLImageElement) {
      event.target.style.visibility = "hidden"
    }
  }, true)

  const xUrl = buildCanonicalStatusUrl(statusRef)
  openEmbedLink.href = buildEmbedUrl(statusRef.id)

  openOnXButton.addEventListener("click", async () => {
    // Without the bypass the extension would bounce X straight back here.
    await registerFallbackBypass(xUrl)
    window.location.href = xUrl
  })

  const { attempts, tweet } = await fetchTweet(statusRef, fetchJson)

  if (!tweet) {
    renderFailure(attempts)
    await logDiagnostic("load-failed", {
      attempts: attempts.map((a) => `${a.source}: ${a.error}`).join(" | "),
      url: xUrl
    })
    return
  }

  const authorLabel = tweet.author.name || tweet.author.handle
  document.title = authorLabel ? `${authorLabel} on X` : "Post reader"
  contentNode.innerHTML = renderTweetArticle(tweet)
  sourceNoteNode.textContent = `via ${SOURCE_LABELS[tweet.source] ?? tweet.source}`

  if (attempts.length > 1) {
    await logDiagnostic("loaded-after-fallback", {
      attempts: attempts.map((a) => (a.ok ? `${a.source}: ok` : `${a.source}: ${a.error}`)).join(" | "),
      url: xUrl
    })
  }
}

main().catch((error) => {
  contentNode.textContent = `Reader error: ${String(error?.message ?? error)}`
})
