import { TARGET_HOSTS, normalizeHostname } from "./rewriter.js";

export const FEED_PATHS = new Set([
  "/",
  "/home",
  "/i/timeline"
]);

const STATUS_PATH_PATTERN = /^\/(?:i\/status\/(\d+)|([^/]+)\/status\/(\d+))(?:\/.*)?$/i;

export function isFeedUrl(input) {
  if (typeof input !== "string" || input.trim() === "") {
    return false;
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(input);
  } catch {
    return false;
  }

  if (!TARGET_HOSTS.has(normalizeHostname(parsedUrl.hostname))) {
    return false;
  }

  const pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";
  return FEED_PATHS.has(pathname);
}

function normalizeStatusPath(input) {
  if (typeof input !== "string") {
    return null;
  }

  let pathname = input;

  if (/^https?:\/\//i.test(input)) {
    try {
      pathname = new URL(input).pathname;
    } catch {
      return null;
    }
  }

  const match = pathname.match(STATUS_PATH_PATTERN);

  if (!match) {
    return null;
  }

  if (match[1]) {
    return `/i/status/${match[1]}`;
  }

  return `/${match[2]}/status/${match[3]}`;
}

export function pickTopPosts(candidates, count) {
  if (!Array.isArray(candidates) || !Number.isFinite(count) || count <= 0) {
    return [];
  }

  const seen = new Set();
  const picked = [];

  for (const candidate of candidates) {
    if (picked.length >= count) {
      break;
    }

    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    if (candidate.isAd === true) {
      continue;
    }

    if (candidate.isPinned === true) {
      continue;
    }

    const normalizedPath = normalizeStatusPath(candidate.statusPath);

    if (!normalizedPath) {
      continue;
    }

    if (seen.has(normalizedPath)) {
      continue;
    }

    seen.add(normalizedPath);
    picked.push(`https://x.com${normalizedPath}`);
  }

  return picked;
}

function isAdArticle(article) {
  const socialContext = article.querySelector('[data-testid="socialContext"]');
  const socialContextText = socialContext?.textContent?.trim().toLowerCase() ?? "";

  if (socialContextText === "ad" || socialContextText === "promoted") {
    return true;
  }

  if (article.closest('[data-testid="placementTracking"]')) {
    return true;
  }

  return false;
}

function isPinnedArticle(article) {
  const socialContext = article.querySelector('[data-testid="socialContext"]');
  const text = socialContext?.textContent?.trim().toLowerCase() ?? "";
  return text.includes("pinned");
}

function extractStatusPath(article) {
  const anchors = article.querySelectorAll('a[href*="/status/"]');

  for (const anchor of anchors) {
    const href = anchor.getAttribute("href");

    if (typeof href !== "string") {
      continue;
    }

    const path = href.startsWith("http") ? new URL(href).pathname : href;
    const normalized = normalizeStatusPath(path);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function collectTweetCandidates(documentRef) {
  if (!documentRef || typeof documentRef.querySelectorAll !== "function") {
    return [];
  }

  const articles = documentRef.querySelectorAll('article[data-testid="tweet"]');
  const candidates = [];

  for (const article of articles) {
    candidates.push({
      isAd: isAdArticle(article),
      isPinned: isPinnedArticle(article),
      statusPath: extractStatusPath(article)
    });
  }

  return candidates;
}
