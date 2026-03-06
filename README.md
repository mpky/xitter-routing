<img src="./xdoubt.png" alt="X Routing banner" width="420">

# X to xcancel Redirect

This repository currently contains the macOS browser-extension route plus a Shortcut-first iOS fallback.

## What is implemented

- Shared URL rewriter logic
- Unit tests for rewrite behavior
- A Manifest V3 WebExtension scaffold
- Background redirect handling for top-level browser navigations
- Early-page redirect via a content script on matching hosts
- Toolbar button support for rewriting the current page on demand
- Context menu items for opening a link or page via xcancel
- A minimal options page with enable/disable and redirect-mode controls
- A repo-owned macOS Quick Action helper with CLI-level tests
- A documented iOS Share Sheet Shortcut recipe for manual `xcancel` opens

## Project layout

- `extension/manifest.json`: extension manifest
- `extension/src/background.js`: top-level navigation redirect logic
- `extension/src/content-redirect.js`: early page redirect logic
- `extension/src/shared/rewriter.js`: pure URL rewrite module
- `extension/src/storage.js`: settings helpers
- `extension/src/options.html`: options page
- `extension/src/options.js`: options page behavior
- `scripts/open-via-xcancel.mjs`: macOS helper entry point for Quick Actions
- `scripts/open-via-xcancel-quick-action.zsh`: Automator-friendly wrapper for the helper
- `scripts/lib/open-via-xcancel.js`: Quick Action parsing and rewrite helpers
- `scripts/lib/quick-action-cli.js`: Quick Action CLI behavior and input selection
- `shortcuts/ios-open-via-xcancel.md`: iOS Shortcut recipe and setup steps
- `tests/rewriter.test.js`: Node-based unit tests
- `tests/open-via-xcancel.test.js`: Quick Action helper tests
- `tests/open-via-xcancel-cli.test.js`: Quick Action CLI behavior tests

## Local testing

Run the unit tests:

```bash
npm test
```

Run only the Quick Action helper tests:

```bash
npm run test:quick-action
```

Refresh the extension build stamp shown in the options page:

```bash
npm run stamp:build
```

Run the Chrome extension validator:

```bash
npm run validate:extension
```

By default it:

- launches Playwright's bundled Chromium with a fresh temporary profile
- loads `extension/` as an unpacked extension
- opens `https://x.com/jack/status/20`
- waits for the redirect to `xcancel.com`
- prints a JSON result and exits non-zero if validation fails

Useful options:

```bash
node scripts/validate-extension.mjs --url "https://twitter.com/jack/status/20"
node scripts/validate-extension.mjs --url "https://x.com/home" --expect no-redirect
node scripts/validate-extension.mjs --timeout 20000
node scripts/validate-extension.mjs --extension-path extension
```

If `playwright` is not already installed locally, the validator bootstraps it into a temporary directory before launching Chrome.

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

## macOS Quick Action

The repo now includes a helper script for the non-browser fallback path:

```bash
/Users/matthewpokorny/Desktop/projects/tools/xitter-routing/scripts/open-via-xcancel.mjs "https://x.com/jack/status/20"
```

By default it:

- accepts text or URLs from arguments, stdin, or the clipboard
- prefers input sources in this order: arguments, stdin, clipboard
- finds the first supported `x.com`, `twitter.com`, or `xcancel.com` URL
- rewrites X/Twitter URLs to `xcancel.com`
- opens the result in Google Chrome
- exits non-zero on invalid options or when no supported URL is found

Useful options:

```bash
/Users/matthewpokorny/Desktop/projects/tools/xitter-routing/scripts/open-via-xcancel.mjs --print-only "x.com/jack"
/Users/matthewpokorny/Desktop/projects/tools/xitter-routing/scripts/open-via-xcancel.mjs --browser default "x.com/jack/status/20"
/Users/matthewpokorny/Desktop/projects/tools/xitter-routing/scripts/open-via-xcancel.mjs --help
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
/Users/matthewpokorny/Desktop/projects/tools/xitter-routing/scripts/open-via-xcancel-quick-action.zsh "$@"
```

8. Save it as `Open via xcancel`.

That gives you a native macOS Quick Action you can run from selected text, Services, or a keyboard shortcut.

## iOS Shortcut

The current iOS path is Shortcut-first rather than Safari-extension-first.

Use the Share Sheet Shortcut recipe in [shortcuts/ios-open-via-xcancel.md](/Users/matthewpokorny/Desktop/projects/tools/xitter-routing/shortcuts/ios-open-via-xcancel.md).

That route is meant for cases where:

- a link opens inside an app's in-app browser
- Safari extensions are not part of the current scope
- you want a manual `Open via xcancel` action from iPhone or iPad

The Shortcut recipe:

- accepts shared URLs or text
- rewrites supported `x.com` and `twitter.com` status links to `xcancel.com`
- preserves path, query, and fragment
- opens the rewritten URL in Safari

It is manual and share-sheet-driven, not a global tap interceptor. By default it leaves non-status X/Twitter URLs alone.
