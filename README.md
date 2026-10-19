<p align="center">
  <img src="./xdoubt.png" alt="X Routing banner" width="420">
</p>

# X Routing

Open `x.com` and `twitter.com` posts without the X app or an X login.

This used to redirect to `xcancel.com`. X shut down xcancel and Nitter with cease-and-desist letters in September 2026, so the tools now use viewers that don't depend on a single mirror site:

| Viewer | Where | What it is |
| --- | --- | --- |
| Built-in reader | Chrome extension (default) | An extension page that loads the post as JSON from [FxTwitter](https://github.com/FxEmbed/FxEmbed), then X's own embed backend (`cdn.syndication.twimg.com`), then [vxTwitter](https://github.com/dylanpdx/BetterTwitFix), and renders text, media, quote, and counts. If all three fail it says so and offers **Open on X**. |
| X embed page | iOS, macOS helper, extension option | `platform.twitter.com/embed/Tweet.html?id=…`: X's official, login-free embed. It's a plain web page, so it works from a Shortcut, and the X app doesn't claim it as a universal link. |
| Custom frontend host | all three tools (opt-in) | A domain swap onto any Nitter-style mirror you name, in case one comes back. |

Old `xcancel.com` and `nitter.net` links are routed the same way as X links.

## What’s Here

- Chromium extension for automatic browser-side redirects
- macOS Quick Action helper for manual opens
- iOS Scriptable + Shortcut fallback
- shared URL routing and post-reader logic with tests

## Repo Map

- `extension/`: browser extension (`src/reader.html` is the built-in reader)
- `extension/src/shared/rewriter.js`: URL → viewer routing
- `extension/src/shared/tweet-reader.js`: post sources, normalizers, renderer
- `scripts/open-tweet.mjs`: macOS helper
- `scriptable/open-tweet.js`: iOS Scriptable script
- `ios/scriptable-setup.md`: iPhone setup steps
- `tests/`: unit tests

## Commands

```bash
npm test
npm run test:quick-action
npm run validate:extension
npm run validate:feed-fanout
```

## Behavior

- Only post (status) URLs go to the reader or embed page, since neither can show profiles or timelines.
- With a custom frontend host, the extension's redirect mode applies: status links only, or all X/Twitter URLs. The path, query, and fragment are kept.
- `x.com/home` is unchanged unless feed fan-out is on.

Examples (extension, default reader):

- `https://x.com/jack/status/20` → `chrome-extension://…/src/reader.html?url=https%3A%2F%2Fx.com%2Fjack%2Fstatus%2F20`
- `https://xcancel.com/jack/status/20` → same reader page
- `https://x.com/home` → unchanged

Examples (iOS / macOS helper):

- `https://twitter.com/jack/status/20?s=20` → `https://platform.twitter.com/embed/Tweet.html?id=20&dnt=true`

## Privacy

The reader makes requests to FxTwitter, X's syndication CDN, or vxTwitter, and only until one of them answers. The embed page is served by X. Neither needs an X account or sends X cookies, because the reader fetches with `credentials: "omit"`. They are still network requests to third parties (and to X) for the post you open.

## macOS

- Load `extension/` as an unpacked Chromium extension. Pick the viewer on its options page.
- Or use `scripts/open-tweet.mjs`. Point existing Automator Quick Actions at `scripts/open-tweet-quick-action.zsh`, which replaces `open-via-xcancel-quick-action.zsh`.

```bash
node scripts/open-tweet.mjs --print-only "https://x.com/jack/status/20"
node scripts/open-tweet.mjs --host nitter.example.com "https://x.com/jack/status/20"
XITTER_FRONTEND_HOST=nitter.example.com node scripts/open-tweet.mjs "https://x.com/jack"
```

## iOS

Use:

- [scriptable/open-tweet.js](./scriptable/open-tweet.js)
- [ios/scriptable-setup.md](./ios/scriptable-setup.md)

To upgrade an existing setup, paste the new script into your existing `Open via xcancel` Scriptable script. The Shortcut doesn't change.

The iOS flow is manual and Share Sheet driven.
