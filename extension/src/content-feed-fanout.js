(async function feedFanOutController() {
  const extensionApi = globalThis.browser ?? globalThis.chrome;

  if (!extensionApi?.runtime?.getURL) {
    return;
  }

  const SCRAPE_TIMEOUT_MS = 8000;
  const SCRAPE_POLL_INTERVAL_MS = 250;
  const MASK_ID = "xrt-fanout-mask";

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
    if (extensionApi.runtime?.sendMessage) {
      try {
        const result = extensionApi.runtime.sendMessage(payload);

        if (result && typeof result.then === "function") {
          return result.catch(() => undefined);
        }
      } catch {
        // ignore
      }
    }

    return Promise.resolve();
  }

  const [
    { getSettings },
    { collectTweetCandidates, isFeedUrl, pickTopPosts },
    { rewriteUrl }
  ] = await Promise.all([
    import(extensionApi.runtime.getURL("src/storage.js")),
    import(extensionApi.runtime.getURL("src/shared/feed-scraper.js")),
    import(extensionApi.runtime.getURL("src/shared/rewriter.js"))
  ]);

  const settings = await getSettings();

  if (!settings.enabled || !settings.feedFanOut) {
    return;
  }

  if (!isFeedUrl(window.location.href)) {
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
    return;
  }

  await sendMessage({
    type: "fan-out-feed",
    urls: rewrittenUrls
  });

  // Mask stays up; background will close this tab once new ones open.
})().catch(() => {});
