import {
  DEFAULT_TARGET_HOST,
  REDIRECT_MODES,
  TARGET_HOSTS,
  normalizeHostname,
  rewriteUrl
} from "../../extension/src/shared/rewriter.js";

const SCHEMELESS_URL_PATTERN =
  /\b(?:(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x\.com|twitter\.com|xcancel\.com)\/[^\s<>"'`)\]}]+)/gi;

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

  if (/^(?:www\.|mobile\.)?(?:x\.com|twitter\.com|xcancel\.com)\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return null;
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
      const parsedUrl = new URL(normalizedUrl);
      const hostname = normalizeHostname(parsedUrl.hostname);

      if (hostname === DEFAULT_TARGET_HOST || TARGET_HOSTS.has(hostname)) {
        return normalizedUrl;
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function resolveQuickActionUrl(rawInput) {
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

  if (hostname === DEFAULT_TARGET_HOST) {
    return parsedUrl.toString();
  }

  if (!TARGET_HOSTS.has(hostname)) {
    return null;
  }

  return rewriteUrl(candidateUrl, { redirectMode: REDIRECT_MODES.ALL });
}
