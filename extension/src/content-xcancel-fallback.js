(async function fallbackProtectedPostsToX() {
  const extensionApi = globalThis.browser ?? globalThis.chrome

  if (!extensionApi?.runtime?.getURL) {
    return
  }

  const [
    { getSettings, registerFallbackBypass },
    { getProtectedPostFallbackUrlForPage }
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
  let resolved = false
  let observer = null

  async function tryFallback() {
    if (resolved) {
      return
    }

    const fallbackUrl = getProtectedPostFallbackUrlForPage(window.location.href, {
      textContent: document.body?.innerText ?? document.body?.textContent ?? "",
      title: document.title
    })

    if (!fallbackUrl || fallbackUrl === window.location.href) {
      if (Date.now() - fallbackStartAt >= fallbackTimeoutMs) {
        observer?.disconnect()
      }
      return
    }

    resolved = true
    observer?.disconnect()
    await registerFallbackBypass(fallbackUrl)
    window.location.replace(fallbackUrl)
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

    globalThis.setTimeout(() => {
      observer?.disconnect()
    }, fallbackTimeoutMs)
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWatching, { once: true })
    return
  }

  startWatching()
})().catch(() => {})
