(async function feedFanOutController() {
  const extensionApi = globalThis.browser ?? globalThis.chrome;

  if (!extensionApi?.runtime?.getURL) {
    return;
  }

  const SCRAPE_TIMEOUT_MS = 8000;
  const SCRAPE_POLL_INTERVAL_MS = 250;
  const MASK_WATCHDOG_MS = 10000;
  const MASK_ID = "xrt-fanout-mask";

  function describeError(error) {
    return String(error?.message ?? error ?? "").slice(0, 200);
  }

  async function logFanOutEvent(loggerImport, action, fields) {
    try {
      const { appendDiagnosticLog } = await loggerImport;
      await appendDiagnosticLog({
        action,
        source: "content-feed-fanout",
        timestamp: Date.now(),
        ...fields
      });
    } catch {
      // Diagnostic logging is best-effort; never block the user on it.
    }
  }

  function applyMask() {
    if (document.getElementById(MASK_ID)) {
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = MASK_ID;
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "background:#f4f1e8",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "font-family:Georgia,'Times New Roman',serif",
      "color:#1c1917",
      "font-size:1.2rem",
      "letter-spacing:0.01em"
    ].join(";");
    overlay.textContent = "Loading top posts…";

    if (document.documentElement) {
      document.documentElement.appendChild(overlay);
    } else {
      document.addEventListener(
        "DOMContentLoaded",
        () => document.documentElement?.appendChild(overlay),
        { once: true }
      );
    }
  }

  function removeMask() {
    document.getElementById(MASK_ID)?.remove();
  }

  function waitForCandidates({ collectTweetCandidates, pickTopPosts }, count) {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      let timer = null;
      let observer = null;

      function cleanup() {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      }

      function tick() {
        const candidates = collectTweetCandidates(document);
        const picked = pickTopPosts(candidates, count);

        if (picked.length >= count) {
          cleanup();
          resolve(picked);
          return;
        }

        if (Date.now() - startedAt >= SCRAPE_TIMEOUT_MS) {
          cleanup();
          resolve(picked);
          return;
        }

        timer = setTimeout(tick, SCRAPE_POLL_INTERVAL_MS);
      }

      if (typeof MutationObserver === "function" && document.documentElement) {
        observer = new MutationObserver(() => {
          const candidates = collectTweetCandidates(document);
          const picked = pickTopPosts(candidates, count);

          if (picked.length >= count) {
            cleanup();
            resolve(picked);
          }
        });
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true
        });
      }

      tick();
    });
  }

  function sendMessage(payload) {
    if (!extensionApi.runtime?.sendMessage) {
      return Promise.resolve({ ok: false, reason: "sendMessage-unavailable" });
    }

    try {
      const result = extensionApi.runtime.sendMessage(payload);

      if (result && typeof result.then === "function") {
        return result.then(
          () => ({ ok: true }),
          (error) => ({ ok: false, reason: describeError(error) })
        );
      }
    } catch (error) {
      return Promise.resolve({ ok: false, reason: describeError(error) });
    }

    return Promise.resolve({ ok: true });
  }

  const storageImport = import(extensionApi.runtime.getURL("src/storage.js"));
  const [
    { getSettings },
    { collectTweetCandidates, isFeedUrl, pickTopPosts },
    { rewriteUrl }
  ] = await Promise.all([
    storageImport,
    import(extensionApi.runtime.getURL("src/shared/feed-scraper.js")),
    import(extensionApi.runtime.getURL("src/shared/rewriter.js"))
  ]);

  const settings = await getSettings();

  if (!settings.enabled || !settings.feedFanOut) {
    return;
  }

  const pageUrl = window.location.href;

  if (!isFeedUrl(pageUrl)) {
    return;
  }

  applyMask();

  const count = Math.max(1, Math.min(20, Number(settings.feedFanOutCount) || 5));
  const xUrls = await waitForCandidates({ collectTweetCandidates, pickTopPosts }, count);

  const rewrittenUrls = xUrls
    .map((url) => rewriteUrl(url, { redirectMode: "all" }))
    .filter((url) => typeof url === "string" && url !== "");

  if (rewrittenUrls.length === 0) {
    removeMask();
    await logFanOutEvent(storageImport, "fan-out-no-candidates", {
      url: pageUrl,
      requestedCount: count
    });
    return;
  }

  const result = await sendMessage({
    type: "fan-out-feed",
    urls: rewrittenUrls
  });

  if (!result.ok) {
    removeMask();
    await logFanOutEvent(storageImport, "fan-out-send-message-failed", {
      url: pageUrl,
      reason: result.reason
    });
    return;
  }

  // Background should close this tab once the fan-out tabs open. The watchdog
  // takes the mask down if that never happens — a permanent mask would brick
  // the page, so we trade the brief "loading" UX for a guaranteed escape.
  setTimeout(() => {
    if (document.getElementById(MASK_ID)) {
      removeMask();
      logFanOutEvent(storageImport, "fan-out-watchdog", {
        url: pageUrl,
        timeoutMs: MASK_WATCHDOG_MS
      });
    }
  }, MASK_WATCHDOG_MS);
})().catch(async (error) => {
  document.getElementById("xrt-fanout-mask")?.remove();

  try {
    const extensionApi = globalThis.browser ?? globalThis.chrome;
    const { appendDiagnosticLog } = await import(
      extensionApi.runtime.getURL("src/storage.js")
    );
    await appendDiagnosticLog({
      action: "fan-out-error",
      source: "content-feed-fanout",
      url: window.location?.href ?? "",
      message: String(error?.message ?? error ?? "").slice(0, 200),
      timestamp: Date.now()
    });
  } catch {
    // Last-ditch logging only; nothing else to do.
  }
});
