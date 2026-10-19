// Loads a single post from public, login-free JSON endpoints and renders it.
// Sources are tried in order; the first that yields a post wins.
//
// - fxtwitter:   FxEmbed's public API (api.fxtwitter.com)
// - syndication: X's own embed backend (cdn.syndication.twimg.com), the same
//                data platform.twitter.com embeds use
// - vxtwitter:   BetterTwitFix's public API (api.vxtwitter.com)

export const TWEET_SOURCES = Object.freeze({
  FXTWITTER: "fxtwitter",
  SYNDICATION: "syndication",
  VXTWITTER: "vxtwitter"
})

export const SOURCE_LABELS = Object.freeze({
  fxtwitter: "FxTwitter",
  syndication: "X embed",
  vxtwitter: "vxTwitter"
})

// Same token derivation react-tweet uses for the syndication endpoint.
export function getSyndicationToken(id) {
  return ((Number(id) / 1e15) * Math.PI)
    .toString(6 ** 2)
    .replace(/(0+|\.)/g, "")
}

export function getTweetSourceRequests({ handle = "i", id }) {
  const safeHandle = encodeURIComponent(handle || "i")
  const safeId = encodeURIComponent(id)

  return [
    {
      source: TWEET_SOURCES.FXTWITTER,
      url: `https://api.fxtwitter.com/${safeHandle}/status/${safeId}`
    },
    {
      source: TWEET_SOURCES.SYNDICATION,
      url: `https://cdn.syndication.twimg.com/tweet-result?id=${safeId}&lang=en&token=${getSyndicationToken(id)}`
    },
    {
      source: TWEET_SOURCES.VXTWITTER,
      url: `https://api.vxtwitter.com/${safeHandle}/status/${safeId}`
    }
  ]
}

function toNumberOrNull(value) {
  return Number.isFinite(value) ? value : null
}

function toHttpsUrl(value) {
  return typeof value === "string" && /^https:\/\//i.test(value) ? value : ""
}

function decodeBasicEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
}

function buildTweet(fields) {
  return {
    author: {
      avatarUrl: toHttpsUrl(fields.author?.avatarUrl),
      handle: typeof fields.author?.handle === "string" ? fields.author.handle : "",
      name: typeof fields.author?.name === "string" ? fields.author.name : ""
    },
    createdAt: typeof fields.createdAt === "string" ? fields.createdAt : "",
    id: String(fields.id ?? ""),
    media: (fields.media ?? []).filter((item) => item && item.url),
    quote: fields.quote ?? null,
    source: fields.source,
    stats: {
      likes: toNumberOrNull(fields.stats?.likes),
      replies: toNumberOrNull(fields.stats?.replies),
      reposts: toNumberOrNull(fields.stats?.reposts),
      views: toNumberOrNull(fields.stats?.views)
    },
    text: typeof fields.text === "string" ? fields.text : ""
  }
}

function epochSecondsToIso(seconds) {
  return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : ""
}

function normalizeFxMediaItem(item) {
  const type = item?.type === "gif" ? "gif" : item?.type === "video" ? "video" : "photo"

  return {
    height: toNumberOrNull(item?.height),
    thumbnailUrl: toHttpsUrl(item?.thumbnail_url),
    type,
    url: toHttpsUrl(item?.url),
    width: toNumberOrNull(item?.width)
  }
}

function normalizeFxTweet(tweet, depth = 0) {
  if (!tweet || typeof tweet !== "object" || !tweet.id) {
    return null
  }

  const mediaItems = Array.isArray(tweet.media?.all)
    ? tweet.media.all
    : [...(tweet.media?.photos ?? []), ...(tweet.media?.videos ?? [])]

  return buildTweet({
    author: {
      avatarUrl: tweet.author?.avatar_url,
      handle: tweet.author?.screen_name,
      name: tweet.author?.name
    },
    createdAt: epochSecondsToIso(tweet.created_timestamp) || tweet.created_at,
    id: tweet.id,
    media: mediaItems.map(normalizeFxMediaItem),
    quote: depth === 0 ? normalizeFxTweet(tweet.quote, depth + 1) : null,
    source: TWEET_SOURCES.FXTWITTER,
    stats: {
      likes: tweet.likes,
      replies: tweet.replies,
      reposts: tweet.retweets,
      views: tweet.views
    },
    text: tweet.text
  })
}

export function normalizeFxTwitterResponse(json) {
  if (!json || typeof json !== "object" || json.code !== 200) {
    return null
  }

  return normalizeFxTweet(json.tweet)
}

function pickBestMp4(variants) {
  if (!Array.isArray(variants)) {
    return ""
  }

  const mp4s = variants
    .filter((variant) => variant?.content_type === "video/mp4" && toHttpsUrl(variant.url))
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))

  return mp4s[0]?.url ?? ""
}

function normalizeSyndicationMediaItem(item) {
  const type = item?.type === "animated_gif" ? "gif" : item?.type === "video" ? "video" : "photo"
  const width = toNumberOrNull(item?.original_info?.width)
  const height = toNumberOrNull(item?.original_info?.height)

  if (type === "photo") {
    return { height, thumbnailUrl: "", type, url: toHttpsUrl(item?.media_url_https), width }
  }

  return {
    height,
    thumbnailUrl: toHttpsUrl(item?.media_url_https),
    type,
    url: pickBestMp4(item?.video_info?.variants),
    width
  }
}

function getSyndicationText(tweet) {
  let text = typeof tweet.text === "string" ? tweet.text : ""
  const range = Array.isArray(tweet.display_text_range) ? tweet.display_text_range : null

  // Indices are in code points; slicing drops leading @replies and the
  // trailing media t.co link.
  if (range && Number.isFinite(range[0]) && Number.isFinite(range[1])) {
    text = Array.from(text).slice(range[0], range[1]).join("")
  }

  for (const entity of tweet.entities?.urls ?? []) {
    if (typeof entity?.url === "string" && typeof entity?.expanded_url === "string") {
      text = text.split(entity.url).join(entity.expanded_url)
    }
  }

  for (const entity of tweet.entities?.media ?? []) {
    if (typeof entity?.url === "string") {
      text = text.split(entity.url).join("")
    }
  }

  return decodeBasicEntities(text).trim()
}

function normalizeSyndicationTweet(tweet, depth = 0) {
  if (!tweet || typeof tweet !== "object") {
    return null
  }

  if (tweet.__typename && tweet.__typename !== "Tweet") {
    return null
  }

  if (!tweet.id_str) {
    return null
  }

  return buildTweet({
    author: {
      avatarUrl: tweet.user?.profile_image_url_https,
      handle: tweet.user?.screen_name,
      name: tweet.user?.name
    },
    createdAt: tweet.created_at,
    id: tweet.id_str,
    media: (tweet.mediaDetails ?? []).map(normalizeSyndicationMediaItem),
    quote: depth === 0 ? normalizeSyndicationTweet(tweet.quoted_tweet, depth + 1) : null,
    source: TWEET_SOURCES.SYNDICATION,
    stats: {
      likes: tweet.favorite_count,
      replies: tweet.conversation_count,
      reposts: tweet.retweet_count,
      views: null
    },
    text: getSyndicationText(tweet)
  })
}

export function normalizeSyndicationResponse(json) {
  return normalizeSyndicationTweet(json)
}

function normalizeVxMediaItem(item) {
  const type = item?.type === "gif" ? "gif" : item?.type === "video" ? "video" : "photo"

  return {
    height: toNumberOrNull(item?.size?.height),
    thumbnailUrl: toHttpsUrl(item?.thumbnail_url),
    type,
    url: toHttpsUrl(item?.url),
    width: toNumberOrNull(item?.size?.width)
  }
}

function normalizeVxTweet(tweet, depth = 0) {
  if (!tweet || typeof tweet !== "object" || !tweet.tweetID) {
    return null
  }

  return buildTweet({
    author: {
      avatarUrl: tweet.user_profile_image_url,
      handle: tweet.user_screen_name,
      name: tweet.user_name
    },
    createdAt: epochSecondsToIso(tweet.date_epoch) || tweet.date,
    id: tweet.tweetID,
    media: (tweet.media_extended ?? []).map(normalizeVxMediaItem),
    quote: depth === 0 ? normalizeVxTweet(tweet.qrt, depth + 1) : null,
    source: TWEET_SOURCES.VXTWITTER,
    stats: {
      likes: tweet.likes,
      replies: tweet.replies,
      reposts: tweet.retweets,
      views: null
    },
    text: tweet.text
  })
}

export function normalizeVxTwitterResponse(json) {
  return normalizeVxTweet(json)
}

const NORMALIZERS = {
  [TWEET_SOURCES.FXTWITTER]: normalizeFxTwitterResponse,
  [TWEET_SOURCES.SYNDICATION]: normalizeSyndicationResponse,
  [TWEET_SOURCES.VXTWITTER]: normalizeVxTwitterResponse
}

function describeError(error) {
  return String(error?.message ?? error ?? "unknown error").slice(0, 200)
}

// fetchJson(url) must resolve to parsed JSON or reject. Injected so the same
// logic runs in the extension, in Node, and in tests.
export async function fetchTweet(statusRef, fetchJson) {
  const attempts = []

  for (const { source, url } of getTweetSourceRequests(statusRef)) {
    try {
      const tweet = NORMALIZERS[source](await fetchJson(url))

      if (tweet) {
        attempts.push({ ok: true, source })
        return { attempts, tweet }
      }

      attempts.push({ error: "no post in response", ok: false, source })
    } catch (error) {
      attempts.push({ error: describeError(error), ok: false, source })
    }
  }

  return { attempts, tweet: null }
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// Escapes the text, then turns bare https links into anchors. Links to X stay
// plain links; the extension's redirect decides what happens when clicked.
export function renderTweetText(text) {
  const parts = String(text ?? "").split(/(https?:\/\/[^\s<>"']+)/g)

  return parts
    .map((part, index) => {
      if (index % 2 === 0) {
        return escapeHtml(part)
      }

      const display = part.replace(/^https?:\/\//, "")
      const shortened = display.length > 48 ? `${display.slice(0, 47)}…` : display
      return `<a href="${escapeHtml(part)}" rel="noreferrer noopener">${escapeHtml(shortened)}</a>`
    })
    .join("")
    .replace(/\n/g, "<br>")
}

function formatCount(value) {
  if (!Number.isFinite(value)) {
    return null
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  }

  if (value >= 10_000) {
    return `${Math.round(value / 1000)}K`
  }

  return String(value)
}

function formatDate(value) {
  const parsed = Date.parse(value)

  if (Number.isNaN(parsed)) {
    return value || ""
  }

  return new Date(parsed).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  })
}

function renderMedia(media) {
  if (!media.length) {
    return ""
  }

  const items = media
    .map((item) => {
      const url = escapeHtml(item.url)

      if (item.type === "photo") {
        return `<a class="media-item" href="${url}" rel="noreferrer noopener"><img src="${url}" alt="" loading="lazy"></a>`
      }

      const poster = item.thumbnailUrl ? ` poster="${escapeHtml(item.thumbnailUrl)}"` : ""
      const loopAttrs = item.type === "gif" ? " autoplay loop muted" : ""
      return `<div class="media-item"><video src="${url}"${poster} controls playsinline preload="metadata"${loopAttrs}></video></div>`
    })
    .join("")

  return `<div class="media media-${Math.min(media.length, 4)}">${items}</div>`
}

function renderStats(stats) {
  const entries = [
    ["replies", "Replies"],
    ["reposts", "Reposts"],
    ["likes", "Likes"],
    ["views", "Views"]
  ]
    .map(([key, label]) => {
      const count = formatCount(stats[key])
      return count === null ? "" : `<span><strong>${count}</strong> ${label}</span>`
    })
    .filter(Boolean)

  return entries.length ? `<div class="stats">${entries.join("")}</div>` : ""
}

function renderAuthor(author) {
  const avatar = author.avatarUrl
    ? `<img class="avatar" src="${escapeHtml(author.avatarUrl)}" alt="">`
    : `<div class="avatar"></div>`

  return `<header class="author">${avatar}<div><div class="name">${escapeHtml(author.name || author.handle)}</div><div class="handle">@${escapeHtml(author.handle)}</div></div></header>`
}

export function renderTweetArticle(tweet, { isQuote = false } = {}) {
  const quote = tweet.quote ? renderTweetArticle(tweet.quote, { isQuote: true }) : ""
  const time = tweet.createdAt
    ? `<time datetime="${escapeHtml(tweet.createdAt)}">${escapeHtml(formatDate(tweet.createdAt))}</time>`
    : ""

  return [
    `<article class="${isQuote ? "tweet quote" : "tweet"}">`,
    renderAuthor(tweet.author),
    tweet.text ? `<div class="text">${renderTweetText(tweet.text)}</div>` : "",
    renderMedia(tweet.media),
    quote,
    isQuote ? "" : `<footer>${time}${renderStats(tweet.stats)}</footer>`,
    "</article>"
  ].join("")
}
