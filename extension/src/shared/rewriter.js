export const TARGET_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "mobile.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com"
]);

// Former Nitter-based mirrors. They are offline after X's 2026 legal action,
// but old links to them still circulate, so treat them as X links.
export const MIRROR_HOSTS = new Set([
  "xcancel.com",
  "www.xcancel.com",
  "nitter.net",
  "www.nitter.net"
]);

export const REDIRECT_MODES = Object.freeze({
  ALL: "all",
  STATUS_ONLY: "status-only"
});

export const VIEWERS = Object.freeze({
  READER: "reader",
  EMBED: "embed",
  HOST: "host"
});

export const EMBED_BASE_URL = "https://platform.twitter.com/embed/Tweet.html";

const STATUS_PATH_PATTERN = /^\/(?:i\/status\/(\d+)|([^/]+)\/status\/(\d+))(?:\/.*)?$/i;

export function normalizeHostname(hostname) {
  return typeof hostname === "string" ? hostname.trim().toLowerCase() : "";
}

export function shouldRewriteHostname(hostname) {
  return TARGET_HOSTS.has(normalizeHostname(hostname));
}

export function isMirrorHostname(hostname) {
  return MIRROR_HOSTS.has(normalizeHostname(hostname));
}

export function shouldRewritePath(pathname, redirectMode = REDIRECT_MODES.STATUS_ONLY) {
  if (redirectMode === REDIRECT_MODES.ALL) {
    return true;
  }

  if (typeof pathname !== "string") {
    return false;
  }

  return STATUS_PATH_PATTERN.test(pathname);
}

export function parseStatusPath(pathname) {
  if (typeof pathname !== "string") {
    return null;
  }

  const match = pathname.match(STATUS_PATH_PATTERN);

  if (!match) {
    return null;
  }

  if (match[1]) {
    return { handle: "i", id: match[1] };
  }

  return { handle: match[2], id: match[3] };
}

// Accepts "nitter.example", "https://nitter.example/", or "nitter.example:8443"
// and returns a bare lowercase host, or "" when the value is unusable.
export function normalizeFrontendHost(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return "";
  }

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value.trim())
    ? value.trim()
    : `https://${value.trim()}`;

  let parsedUrl;

  try {
    parsedUrl = new URL(candidate);
  } catch {
    return "";
  }

  const hostname = normalizeHostname(parsedUrl.hostname);

  if (!hostname.includes(".") || TARGET_HOSTS.has(hostname)) {
    return "";
  }

  return parsedUrl.port ? `${hostname}:${parsedUrl.port}` : hostname;
}

export function buildCanonicalStatusUrl({ handle, id }) {
  return `https://x.com/${handle}/status/${id}`;
}

export function buildEmbedUrl(id) {
  return `${EMBED_BASE_URL}?id=${encodeURIComponent(id)}&dnt=true`;
}

export function buildReaderUrl(readerBaseUrl, statusRef) {
  return `${readerBaseUrl}?url=${encodeURIComponent(buildCanonicalStatusUrl(statusRef))}`;
}

// Swaps an X/Twitter (or former mirror) host for targetHost, keeping path,
// query, and fragment. Used for the custom frontend host viewer.
export function rewriteUrl(input, options = {}) {
  if (typeof input !== "string" || input.trim() === "") {
    return null;
  }

  const {
    targetHost = "",
    redirectMode = REDIRECT_MODES.STATUS_ONLY
  } = options;
  const normalizedTarget = normalizeFrontendHost(targetHost);

  if (!normalizedTarget) {
    return null;
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(input);
  } catch {
    return null;
  }

  if (!shouldRewriteHostname(parsedUrl.hostname) && !isMirrorHostname(parsedUrl.hostname)) {
    return null;
  }

  if (!shouldRewritePath(parsedUrl.pathname, redirectMode)) {
    return null;
  }

  parsedUrl.protocol = "https:";
  parsedUrl.host = normalizedTarget;

  return parsedUrl.toString();
}

// Maps an X/Twitter or former-mirror URL onto the configured viewer. Returns
// null when the URL should be left alone.
//
// - reader: the extension's built-in reader page (status URLs only)
// - embed:  X's own login-free embed page (status URLs only)
// - host:   a domain swap onto a user-chosen frontend such as a Nitter instance
export function resolveViewerUrl(input, options = {}) {
  if (typeof input !== "string" || input.trim() === "") {
    return null;
  }

  const {
    frontendHost = "",
    readerBaseUrl = "",
    redirectMode = REDIRECT_MODES.STATUS_ONLY
  } = options;
  let { viewer = VIEWERS.READER } = options;

  let parsedUrl;

  try {
    parsedUrl = new URL(input);
  } catch {
    return null;
  }

  const fromMirror = isMirrorHostname(parsedUrl.hostname);

  if (!shouldRewriteHostname(parsedUrl.hostname) && !fromMirror) {
    return null;
  }

  if (viewer === VIEWERS.HOST) {
    if (normalizeFrontendHost(frontendHost)) {
      return rewriteUrl(input, { redirectMode, targetHost: frontendHost });
    }

    viewer = VIEWERS.READER;
  }

  const statusRef = parseStatusPath(parsedUrl.pathname);

  if (!statusRef) {
    // Dead mirror links still go somewhere useful.
    if (fromMirror) {
      parsedUrl.protocol = "https:";
      parsedUrl.host = "x.com";
      return parsedUrl.toString();
    }

    return null;
  }

  if (viewer === VIEWERS.READER && readerBaseUrl) {
    return buildReaderUrl(readerBaseUrl, statusRef);
  }

  return buildEmbedUrl(statusRef.id);
}
