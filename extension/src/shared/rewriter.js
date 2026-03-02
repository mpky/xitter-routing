export const TARGET_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "mobile.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com"
]);

export const DEFAULT_TARGET_HOST = "xcancel.com";
export const REDIRECT_MODES = Object.freeze({
  ALL: "all",
  STATUS_ONLY: "status-only"
});

export function normalizeHostname(hostname) {
  return typeof hostname === "string" ? hostname.trim().toLowerCase() : "";
}

export function shouldRewriteHostname(hostname) {
  return TARGET_HOSTS.has(normalizeHostname(hostname));
}

export function shouldRewritePath(pathname, redirectMode = REDIRECT_MODES.STATUS_ONLY) {
  if (redirectMode === REDIRECT_MODES.ALL) {
    return true;
  }

  if (typeof pathname !== "string") {
    return false;
  }

  return /^\/(?:i\/status\/\d+|[^/]+\/status\/\d+)(?:\/.*)?$/i.test(pathname);
}

export function rewriteUrl(input, options = {}) {
  if (typeof input !== "string" || input.trim() === "") {
    return null;
  }

  const {
    targetHost = DEFAULT_TARGET_HOST,
    redirectMode = REDIRECT_MODES.STATUS_ONLY
  } = options;

  let parsedUrl;

  try {
    parsedUrl = new URL(input);
  } catch {
    return null;
  }

  if (!shouldRewriteHostname(parsedUrl.hostname)) {
    return null;
  }

  if (!shouldRewritePath(parsedUrl.pathname, redirectMode)) {
    return null;
  }

  const normalizedTarget = normalizeHostname(targetHost);

  if (parsedUrl.hostname === normalizedTarget) {
    return null;
  }

  parsedUrl.protocol = "https:";
  parsedUrl.hostname = normalizedTarget;
  parsedUrl.port = "";

  return parsedUrl.toString();
}
