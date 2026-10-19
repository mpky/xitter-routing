import test from "node:test"
import assert from "node:assert/strict"

import {
  TWEET_SOURCES,
  fetchTweet,
  getSyndicationToken,
  getTweetSourceRequests,
  normalizeFxTwitterResponse,
  normalizeSyndicationResponse,
  normalizeVxTwitterResponse,
  renderTweetArticle,
  renderTweetText
} from "../extension/src/shared/tweet-reader.js"

const FX_RESPONSE = {
  code: 200,
  message: "OK",
  tweet: {
    id: "20",
    text: "just setting up my twttr",
    author: {
      name: "jack",
      screen_name: "jack",
      avatar_url: "https://pbs.twimg.com/profile_images/jack.jpg"
    },
    created_timestamp: 1142974214,
    likes: 300000,
    retweets: 120000,
    replies: 15000,
    views: null,
    media: {
      all: [
        { type: "photo", url: "https://pbs.twimg.com/media/a.jpg", width: 1200, height: 800 },
        {
          type: "video",
          url: "https://video.twimg.com/b.mp4",
          thumbnail_url: "https://pbs.twimg.com/b.jpg"
        }
      ]
    },
    quote: {
      id: "19",
      text: "quoted",
      author: { name: "Quoted", screen_name: "q", avatar_url: "https://pbs.twimg.com/q.jpg" }
    }
  }
}

const SYNDICATION_RESPONSE = {
  __typename: "Tweet",
  id_str: "20",
  text: "@biz just setting up my twttr &amp; more https://t.co/abc https://t.co/media",
  display_text_range: [5, 57],
  created_at: "2006-03-21T20:50:14.000Z",
  favorite_count: 300000,
  conversation_count: 15000,
  user: {
    name: "jack",
    screen_name: "jack",
    profile_image_url_https: "https://pbs.twimg.com/profile_images/jack.jpg"
  },
  entities: {
    urls: [{ url: "https://t.co/abc", expanded_url: "https://example.com/post" }],
    media: [{ url: "https://t.co/media" }]
  },
  mediaDetails: [
    {
      type: "video",
      media_url_https: "https://pbs.twimg.com/thumb.jpg",
      original_info: { width: 1280, height: 720 },
      video_info: {
        variants: [
          { content_type: "application/x-mpegURL", url: "https://video.twimg.com/v.m3u8" },
          { content_type: "video/mp4", bitrate: 832000, url: "https://video.twimg.com/low.mp4" },
          { content_type: "video/mp4", bitrate: 2176000, url: "https://video.twimg.com/high.mp4" }
        ]
      }
    }
  ]
}

const VX_RESPONSE = {
  tweetID: "20",
  text: "just setting up my twttr",
  user_name: "jack",
  user_screen_name: "jack",
  user_profile_image_url: "https://pbs.twimg.com/profile_images/jack.jpg",
  date_epoch: 1142974214,
  likes: 300000,
  retweets: 120000,
  replies: 15000,
  media_extended: [
    { type: "gif", url: "https://video.twimg.com/c.mp4", thumbnail_url: "https://pbs.twimg.com/c.jpg" }
  ]
}

test("getSyndicationToken matches react-tweet's derivation", () => {
  assert.equal(
    getSyndicationToken("20"),
    ((20 / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "")
  )
  assert.match(getSyndicationToken("1790000000000000000"), /^[0-9a-z]+$/)
})

test("getTweetSourceRequests lists sources in fallback order", () => {
  const requests = getTweetSourceRequests({ handle: "jack", id: "20" })

  assert.deepEqual(
    requests.map((request) => request.source),
    [TWEET_SOURCES.FXTWITTER, TWEET_SOURCES.SYNDICATION, TWEET_SOURCES.VXTWITTER]
  )
  assert.equal(requests[0].url, "https://api.fxtwitter.com/jack/status/20")
  assert.match(requests[1].url, /^https:\/\/cdn\.syndication\.twimg\.com\/tweet-result\?id=20&lang=en&token=/)
  assert.equal(requests[2].url, "https://api.vxtwitter.com/jack/status/20")
})

test("normalizes FxTwitter responses including media and quote", () => {
  const tweet = normalizeFxTwitterResponse(FX_RESPONSE)

  assert.equal(tweet.source, "fxtwitter")
  assert.equal(tweet.id, "20")
  assert.equal(tweet.author.handle, "jack")
  assert.equal(tweet.createdAt, "2006-03-21T20:50:14.000Z")
  assert.deepEqual(tweet.stats, { likes: 300000, replies: 15000, reposts: 120000, views: null })
  assert.deepEqual(tweet.media.map((item) => item.type), ["photo", "video"])
  assert.equal(tweet.media[1].thumbnailUrl, "https://pbs.twimg.com/b.jpg")
  assert.equal(tweet.quote.author.handle, "q")
  assert.equal(tweet.quote.quote, null)
})

test("rejects FxTwitter error responses", () => {
  assert.equal(normalizeFxTwitterResponse({ code: 404, message: "NOT_FOUND" }), null)
  assert.equal(normalizeFxTwitterResponse(null), null)
})

test("normalizes syndication responses: text range, links, entities, best mp4", () => {
  const tweet = normalizeSyndicationResponse(SYNDICATION_RESPONSE)

  assert.equal(tweet.source, "syndication")
  assert.equal(tweet.text, "just setting up my twttr & more https://example.com/post")
  assert.equal(tweet.stats.likes, 300000)
  assert.equal(tweet.media.length, 1)
  assert.equal(tweet.media[0].type, "video")
  assert.equal(tweet.media[0].url, "https://video.twimg.com/high.mp4")
  assert.equal(tweet.media[0].thumbnailUrl, "https://pbs.twimg.com/thumb.jpg")
})

test("rejects syndication tombstones and empty bodies", () => {
  assert.equal(
    normalizeSyndicationResponse({ __typename: "TweetTombstone", tombstone: { text: { text: "Protected" } } }),
    null
  )
  assert.equal(normalizeSyndicationResponse({}), null)
})

test("normalizes vxTwitter responses", () => {
  const tweet = normalizeVxTwitterResponse(VX_RESPONSE)

  assert.equal(tweet.source, "vxtwitter")
  assert.equal(tweet.author.name, "jack")
  assert.equal(tweet.media[0].type, "gif")
  assert.equal(tweet.createdAt, "2006-03-21T20:50:14.000Z")
})

test("drops non-https media URLs", () => {
  const tweet = normalizeVxTwitterResponse({
    ...VX_RESPONSE,
    media_extended: [{ type: "image", url: "javascript:alert(1)" }]
  })

  assert.deepEqual(tweet.media, [])
})

test("fetchTweet falls through failing sources and records attempts", async () => {
  const seen = []
  const { attempts, tweet } = await fetchTweet({ handle: "jack", id: "20" }, async (url) => {
    seen.push(url)

    if (url.includes("fxtwitter")) {
      throw new Error("HTTP 503")
    }

    if (url.includes("syndication")) {
      return {}
    }

    return VX_RESPONSE
  })

  assert.equal(seen.length, 3)
  assert.equal(tweet.source, "vxtwitter")
  assert.deepEqual(attempts, [
    { error: "HTTP 503", ok: false, source: "fxtwitter" },
    { error: "no post in response", ok: false, source: "syndication" },
    { ok: true, source: "vxtwitter" }
  ])
})

test("fetchTweet stops at the first source that answers", async () => {
  let calls = 0
  const { tweet } = await fetchTweet({ handle: "jack", id: "20" }, async () => {
    calls += 1
    return FX_RESPONSE
  })

  assert.equal(calls, 1)
  assert.equal(tweet.source, "fxtwitter")
})

test("fetchTweet returns null when every source fails", async () => {
  const { attempts, tweet } = await fetchTweet({ handle: "jack", id: "20" }, async () => {
    throw new Error("offline")
  })

  assert.equal(tweet, null)
  assert.equal(attempts.length, 3)
  assert.ok(attempts.every((attempt) => !attempt.ok))
})

test("renderTweetText escapes HTML and links URLs", () => {
  assert.equal(
    renderTweetText("<b>hi</b> & see https://example.com/a?b=1\nbye"),
    '&lt;b&gt;hi&lt;/b&gt; &amp; see <a href="https://example.com/a?b=1" rel="noreferrer noopener">example.com/a?b=1</a><br>bye'
  )
})

test("renderTweetArticle escapes author fields and includes media and quote", () => {
  const tweet = normalizeFxTwitterResponse({
    ...FX_RESPONSE,
    tweet: {
      ...FX_RESPONSE.tweet,
      author: { ...FX_RESPONSE.tweet.author, name: '<img src=x onerror="alert(1)">' }
    }
  })
  const html = renderTweetArticle(tweet)

  assert.ok(!html.includes("<img src=x"))
  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"))
  assert.ok(html.includes('<img src="https://pbs.twimg.com/media/a.jpg"'))
  assert.ok(html.includes('<video src="https://video.twimg.com/b.mp4"'))
  assert.ok(html.includes('class="tweet quote"'))
  assert.ok(html.includes("<strong>300K</strong> Likes"))
})
