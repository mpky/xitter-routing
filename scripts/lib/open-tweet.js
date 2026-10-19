import {
  MIRROR_HOSTS,
  REDIRECT_MODES,
  TARGET_HOSTS,
  VIEWERS,
  normalizeHostname,
  resolveViewerUrl
} from "../../extension/src/shared/rewriter.js";

const SCHEMELESS_URL_PATTERN =
  /\b(?:(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x\.com|twitter\.com|xcancel\.com|nitter\.net)\/[^\s<>"'`)\]}]+)/gi;

function stripTrailingPunctuation(value) {
  return value.replace(/[.,!?;:]+$/u, "");
}

export function normalizeCandidateUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = stripTrailingPunctuation(value.trim());

  if (trimmed === "") {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^(?:www\.|mobile\.)?(?:x\.com|twitter\.com|xcancel\.com|nitter\.net)\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return null;
}

function isSupportedHostname(hostname) {
  const normalized = normalizeHostname(hostname);
  return TARGET_HOSTS.has(normalized) || MIRROR_HOSTS.has(normalized);
}

export function extractFirstSupportedUrl(text) {
  if (typeof text !== "string" || text.trim() === "") {
    return null;
  }

  for (const match of text.matchAll(SCHEMELESS_URL_PATTERN)) {
    const normalizedUrl = normalizeCandidateUrl(match[0]);

    if (!normalizedUrl) {
      continue;
    }

    try {
      if (isSupportedHostname(new URL(normalizedUrl).hostname)) {
        return normalizedUrl;
      }
    } catch {
      continue;
    }
  }

  return null;
}

// Post URLs go to X's login-free embed page, or to frontendHost when given.
// Other X/Twitter URLs are opened as-is in the browser (never the X app),
// where the extension can take over if it is installed.
export function resolveQuickActionUrl(rawInput, options = {}) {
  const { frontendHost = "" } = options;
  const candidateUrl = extractFirstSupportedUrl(rawInput) ?? normalizeCandidateUrl(rawInput);

  if (!candidateUrl) {
    return null;
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(candidateUrl);
  } catch {
    return null;
  }

  const hostname = normalizeHostname(parsedUrl.hostname);

  if (frontendHost && hostname === normalizeHostname(frontendHost)) {
    return parsedUrl.toString();
  }

  if (!isSupportedHostname(hostname)) {
    return null;
  }

  const viewerUrl = resolveViewerUrl(candidateUrl, {
    frontendHost,
    redirectMode: REDIRECT_MODES.ALL,
    viewer: frontendHost ? VIEWERS.HOST : VIEWERS.EMBED
  });

  if (viewerUrl) {
    return viewerUrl;
  }

  parsedUrl.protocol = "https:";
  return parsedUrl.toString();
}
