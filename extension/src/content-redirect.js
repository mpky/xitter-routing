(async function redirectCurrentPage() {
  const extensionApi = globalThis.browser ?? globalThis.chrome

  if (!extensionApi?.runtime?.getURL) {
    return
  }

  const [{ getSettings }, { rewriteUrl }] = await Promise.all([
    import(extensionApi.runtime.getURL("src/storage.js")),
    import(extensionApi.runtime.getURL("src/shared/rewriter.js"))
  ])

  const settings = await getSettings()

  if (settings.enabled === false) {
    return
  }

  const rewrittenUrl = rewriteUrl(window.location.href, {
    redirectMode: settings.redirectMode
  })

  if (rewrittenUrl && rewrittenUrl !== window.location.href) {
    window.location.replace(rewrittenUrl)
  }
})().catch(() => {})
