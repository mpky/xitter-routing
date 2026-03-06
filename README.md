<p align="center">
  <img src="./xdoubt.png" alt="X Routing banner" width="420">
</p>

# X to xcancel Redirect

Redirect `x.com` and `twitter.com` links to `xcancel.com`.

## What’s Here

- Chromium extension for automatic browser-side redirects
- macOS Quick Action helper for manual opens
- iOS Scriptable + Shortcut fallback
- shared URL rewrite logic with tests

## Repo Map

- `extension/`: browser extension
- `scripts/open-via-xcancel.mjs`: macOS helper
- `scriptable/open-via-xcancel.js`: iOS Scriptable script
- `ios/scriptable-setup.md`: iPhone setup steps
- `tests/`: unit tests

## Commands

```bash
npm test
npm run test:quick-action
npm run validate:extension
```

## Behavior

- default mode rewrites only status-style URLs
- preserves path, query, and fragment
- leaves non-status X/Twitter URLs alone unless you explicitly use an all-mode path

Examples:

- `https://x.com/jack/status/20` -> `https://xcancel.com/jack/status/20`
- `https://twitter.com/jack/status/20?s=20#frag` -> `https://xcancel.com/jack/status/20?s=20#frag`
- `https://x.com/home` -> unchanged by default

## macOS

- Load `extension/` as an unpacked Chromium extension
- Or use `scripts/open-via-xcancel.mjs`

Quick check:

```bash
node scripts/open-via-xcancel.mjs --print-only "https://x.com/jack/status/20"
```

## iOS

Use:

- [scriptable/open-via-xcancel.js](./scriptable/open-via-xcancel.js)
- [ios/scriptable-setup.md](./ios/scriptable-setup.md)

The iOS flow is manual and Share Sheet driven.
