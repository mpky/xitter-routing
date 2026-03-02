(function redirectCurrentPage() {
  const browserApi = globalThis.browser ?? null;
  const chromeApi = globalThis.chrome ?? null;
  const targetHosts = new Set([
    "x.com",
    "www.x.com",
    "mobile.x.com",
    "twitter.com",
    "www.twitter.com",
    "mobile.twitter.com"
  ]);

  async function getRedirectSettings() {
    if (browserApi?.storage?.local) {
      return browserApi.storage.local.get({
        enabled: true,
        redirectMode: "status-only"
      });
    }

    if (chromeApi?.storage?.local) {
      return new Promise((resolve, reject) => {
        chromeApi.storage.local.get({
          enabled: true,
          redirectMode: "status-only"
        }, (items) => {
          const error = chromeApi.runtime?.lastError;

          if (error) {
            reject(new Error(error.message));
            return;
          }

          resolve(items);
        });
      });
    }

    return {
      enabled: true,
      redirectMode: "status-only"
    };
  }

  function shouldRewritePath(pathname, redirectMode) {
    if (redirectMode === "all") {
      return true;
    }

    return /^\/(?:i\/status\/\d+|[^/]+\/status\/\d+)(?:\/.*)?$/i.test(pathname);
  }

  async function run() {
    const currentUrl = window.location.href;
    const currentHostname = window.location.hostname.trim().toLowerCase();

    if (!targetHosts.has(currentHostname)) {
      return;
    }

    const settings = await getRedirectSettings();

    if (settings.enabled === false) {
      return;
    }

    if (!shouldRewritePath(window.location.pathname, settings.redirectMode)) {
      return;
    }

    let rewrittenUrl;

    try {
      const parsedUrl = new URL(currentUrl);
      parsedUrl.protocol = "https:";
      parsedUrl.hostname = "xcancel.com";
      parsedUrl.port = "";
      rewrittenUrl = parsedUrl.toString();
    } catch {
      return;
    }

    if (rewrittenUrl !== currentUrl) {
      window.location.replace(rewrittenUrl);
    }
  }

  run().catch(() => {});
})();
