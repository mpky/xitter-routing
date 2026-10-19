(async function redirectCurrentPage() {
  const extensionApi = globalThis.browser ?? globalThis.chrome

  if (!extensionApi?.runtime?.getURL) {
    return
  }

  const [
    { appendDiagnosticLog, clearFallbackBypass, getSettings, hasFallbackBypass },
    { resolveViewerUrl },
    { isFeedUrl }
  ] = await Promise.all([
    import(extensionApi.runtime.getURL("src/storage.js")),
    import(extensionApi.runtime.getURL("src/shared/rewriter.js")),
    import(extensionApi.runtime.getURL("src/shared/feed-scraper.js"))
  ])

  const settings = await getSettings()

  if (settings.enabled === false) {
    return
  }

  if (settings.feedFanOut && isFeedUrl(window.location.href)) {
    return
  }

  if (await hasFallbackBypass(window.location.href)) {
    await appendDiagnosticLog({
      action: "bypass-consumed",
      source: "content-redirect",
      timestamp: Date.now(),
      url: window.location.href
    }).catch(() => {})
    await clearFallbackBypass(window.location.href)
    return
  }

  const rewrittenUrl = resolveViewerUrl(window.location.href, {
    ...settings,
    readerBaseUrl: extensionApi.runtime.getURL("src/reader.html")
  })

  if (rewrittenUrl && rewrittenUrl !== window.location.href) {
    await appendDiagnosticLog({
      action: "redirect",
      source: "content-redirect",
      redirectMode: settings.redirectMode,
      viewer: settings.viewer,
      rewrittenUrl,
      timestamp: Date.now(),
      url: window.location.href
    }).catch(() => {})
    window.location.replace(rewrittenUrl)
  }
})().catch(() => {})
