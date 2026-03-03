# X to xcancel Redirect

This repository currently contains the macOS browser-extension route described in `spec.md`.

## What is implemented

- Shared URL rewriter logic
- Unit tests for rewrite behavior
- A Manifest V3 WebExtension scaffold
- Background redirect handling for top-level browser navigations
- Early-page redirect via a content script on matching hosts
- Toolbar button support for rewriting the current page on demand
- Context menu items for opening a link or page via xcancel
- A minimal options page with enable/disable and redirect-mode controls

## Project layout

- `extension/manifest.json`: extension manifest
- `extension/src/background.js`: top-level navigation redirect logic
- `extension/src/content-redirect.js`: early page redirect logic
- `extension/src/shared/rewriter.js`: pure URL rewrite module
- `extension/src/storage.js`: settings helpers
- `extension/src/options.html`: options page
- `extension/src/options.js`: options page behavior
- `scripts/open-via-xcancel.mjs`: macOS helper entry point for Quick Actions
- `scripts/lib/open-via-xcancel.js`: Quick Action parsing and rewrite helpers
- `tests/rewriter.test.js`: Node-based unit tests
- `tests/open-via-xcancel.test.js`: Quick Action helper tests

## Local testing

Run the unit tests:

```bash
npm test
```

Load the extension in a Chromium-based browser for fast iteration:

1. Open the browser extension management page.
2. Enable developer mode.
3. Load the `extension/` directory as an unpacked extension.
4. Navigate to an X/Twitter status URL and confirm it rewrites to `xcancel.com`.

By default, the extension redirects only status links such as:

- `https://x.com/user/status/123`
- `https://twitter.com/user/status/123/photo/1`

It does not redirect general browsing URLs such as:

- `https://x.com/home`
- `https://x.com/explore`
- `https://twitter.com/someuser`

You can also test the manual browser controls:

1. Click the toolbar button while you are on an `x.com` or `twitter.com` page.
2. Right-click a matching link and choose `Open link via xcancel`.
3. Right-click an open X/Twitter page and choose `Open page via xcancel`.

## Safari on macOS

Safari packaging is expected to happen through Safari Web Extension tooling on a Mac with Xcode support installed.

The code here is organized so the redirect logic is browser-agnostic:

- the rewrite rules live in one pure module
- the background worker is a standard WebExtension entry point
- settings are stored through the extension storage API

If Safari-specific wrapper work is needed next, the likely follow-up is:

1. convert the `extension/` directory into a Safari Web Extension container
2. run the extension in Safari on macOS
3. verify whether any Safari API differences require a small compatibility pass

## macOS Quick Action

The repo now includes a helper script for the non-browser fallback path:

```bash
/Users/matthewpokorny/Desktop/projects/tools/xitter-routing/scripts/open-via-xcancel.mjs "https://x.com/jack/status/20"
```

By default it:

- accepts text or URLs from arguments, stdin, or the clipboard
- finds the first supported `x.com`, `twitter.com`, or `xcancel.com` URL
- rewrites X/Twitter URLs to `xcancel.com`
- opens the result in Google Chrome

Useful options:

```bash
/Users/matthewpokorny/Desktop/projects/tools/xitter-routing/scripts/open-via-xcancel.mjs --print-only "x.com/jack"
/Users/matthewpokorny/Desktop/projects/tools/xitter-routing/scripts/open-via-xcancel.mjs --browser default "x.com/jack/status/20"
```

### Automator Quick Action setup

1. Open `Automator`.
2. Create a new `Quick Action`.
3. Set `Workflow receives current` to `text` in `any application`.
4. Set `Input is` to `as arguments`.
5. Add `Run Shell Script`.
6. Use `/bin/zsh` as the shell.
7. Paste this command:

```zsh
/Users/matthewpokorny/Desktop/projects/tools/xitter-routing/scripts/open-via-xcancel.mjs "$@"
```

8. Save it as `Open via xcancel`.

That gives you a native macOS Quick Action you can run from selected text, Services, or a keyboard shortcut.
