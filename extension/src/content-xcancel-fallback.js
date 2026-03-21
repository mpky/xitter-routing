(async function fallbackProtectedPostsToX() {
  const extensionApi = globalThis.browser ?? globalThis.chrome

  if (!extensionApi?.runtime?.getURL) {
    return
  }

  const [
    { appendDiagnosticLog, getSettings, registerFallbackBypass },
    {
      getFallbackReasonForXcancelPage,
      getPageTextSnippet,
      getProtectedPostFallbackUrlForPage
    }
  ] = await Promise.all([
    import(extensionApi.runtime.getURL("src/storage.js")),
    import(extensionApi.runtime.getURL("src/shared/xcancel-fallback.js"))
  ])

  const settings = await getSettings()

  if (settings.enabled === false) {
    return
  }

  const fallbackStartAt = Date.now()
  const fallbackTimeoutMs = 5_000
  const fallbackPollIntervalMs = 250
  let resolved = false
  let observer = null
  let fallbackIntervalId = null
  let fallbackTimeoutId = null
  let lastLoggedStateKey = null

  async function logDiagnostic(action, details = {}) {
    await appendDiagnosticLog({
      action,
      source: "xcancel-fallback",
      timestamp: Date.now(),
      title: document.title,
      url: window.location.href,
      ...details
    }).catch(() => {})
  }

  async function tryFallback() {
    if (resolved) {
      return
    }

    const page = {
      textContent: document.body?.innerText ?? document.body?.textContent ?? "",
      title: document.title
    }
    const elapsedMs = Date.now() - fallbackStartAt
    const reason = getFallbackReasonForXcancelPage(page)
    const fallbackUrl = getProtectedPostFallbackUrlForPage(
      window.location.href,
      page,
      {
        elapsedMs
      }
    )

    if (!fallbackUrl || fallbackUrl === window.location.href) {
      const stateKey = JSON.stringify({
        elapsedBucket: Math.floor(elapsedMs / 500),
        reason,
        title: page.title
      })

      if (stateKey !== lastLoggedStateKey) {
        lastLoggedStateKey = stateKey
        await logDiagnostic("observe", {
          elapsedMs,
          fallbackUrl: fallbackUrl ?? "",
          reason: reason ?? "none",
          textSnippet: getPageTextSnippet(page)
        })
      }

      if (Date.now() - fallbackStartAt >= fallbackTimeoutMs) {
        stopWatching()
        await logDiagnostic("timeout", {
          elapsedMs,
          reason: reason ?? "none",
          textSnippet: getPageTextSnippet(page)
        })
      }
      return
    }

    resolved = true
    stopWatching()
    await logDiagnostic("fallback", {
      elapsedMs,
      fallbackUrl,
      reason: reason ?? "unknown",
      textSnippet: getPageTextSnippet(page)
    })
    await registerFallbackBypass(fallbackUrl)
    window.location.replace(fallbackUrl)
  }

  function stopWatching() {
    observer?.disconnect()
    observer = null

    if (fallbackIntervalId !== null) {
      globalThis.clearInterval(fallbackIntervalId)
      fallbackIntervalId = null
    }

    if (fallbackTimeoutId !== null) {
      globalThis.clearTimeout(fallbackTimeoutId)
      fallbackTimeoutId = null
    }
  }

  function startWatching() {
    void tryFallback()

    observer = new MutationObserver(() => {
      void tryFallback()
    })
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    })

    fallbackIntervalId = globalThis.setInterval(() => {
      void tryFallback()
    }, fallbackPollIntervalMs)

    fallbackTimeoutId = globalThis.setTimeout(() => {
      stopWatching()
    }, fallbackTimeoutMs)
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWatching, { once: true })
    return
  }

  startWatching()
})().catch(() => {})
