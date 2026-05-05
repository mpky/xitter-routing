# iOS Scriptable Setup Chat

## Context

We shifted the iOS plan away from Safari extensions and toward a manual iPhone flow using:

- `Scriptable` for the logic
- a thin `Shortcuts` launcher from the Share Sheet

The repo now includes:

- `scriptable/open-via-xcancel.js`
- `ios/scriptable-setup.md`

## What We Changed In The Repo

### Earlier repo work

- fixed settings persistence in the browser extension
- removed duplicated content-script rewrite logic
- added extension validation tooling with Playwright/Chromium
- merged the PR to `main`

### iOS direction change

- dropped the idea of a complex Shortcut-only iOS flow
- decided Scriptable would be easier to paste and maintain
- added `scriptable/open-via-xcancel.js`
- renamed the iOS setup doc to `ios/scriptable-setup.md`
- shortened the README and pointed iOS setup to the dedicated docs

### Scriptable fixes

We hit multiple iPhone/runtime issues and adjusted the script:

1. `Alert` failed in Siri/Shortcut context
   - fixed by avoiding `Alert.present()` when running from Shortcuts/Siri

2. Scriptable opening Safari directly from Shortcut context was unreliable
   - changed the script to return the final URL to Shortcuts
   - Shortcuts now opens the URL itself

3. `Open URLs` complained about rich text instead of URL
   - inserted a `URL` action between `Run Script` and `Open URLs`

4. Scriptable still could not find a supported URL
   - likely because Shortcuts was passing rich input/share metadata, not a clean URL
   - next recommended fix was to extract URLs inside Shortcuts before calling Scriptable

## Working Shortcut Shape We Reached

This was the last recommended Shortcut structure:

1. `Receive ... from Share Sheet`
2. `Get URLs from Shortcut Input`
3. `Get Item from List`
   - use `First Item`
4. `Run Open via xcancel`
   - pass the output of `Get Item from List`
5. `URL`
   - use `Output` from `Run Open via xcancel`
6. `Open URLs`
   - use the output of the `URL` action

## Why That Structure

- the Share Sheet may hand Shortcuts rich text or mixed share metadata
- `Get URLs from Input` normalizes that into actual URL values
- `Get Item from List` picks the first URL
- Scriptable receives a clean URL string
- Scriptable returns a string URL
- the `URL` action converts that string to a URL object
- `Open URLs` opens it reliably

## Scriptable Notes

The Scriptable script currently:

- accepts Shortcut input
- falls back to clipboard when needed
- rewrites status-style `x.com` / `twitter.com` URLs to `xcancel.com`
- leaves non-status URLs alone
- returns the final URL back to Shortcuts in Shortcut mode

## Errors We Saw

### Error 1

`alerts are not supported in siri`

Cause:
- Scriptable tried to show an alert while running from a Shortcut/Siri context

Fix:
- changed Scriptable to use `Script.setShortcutOutput(...)` instead

### Error 2

`Shortcuts couldn't convert from rich text to URL`

Cause:
- `Run Script` returned text, and `Open URLs` expected a URL object

Fix:
- added a `URL` action between `Run Script` and `Open URLs`

### Error 3

`No supported X, Twitter, or xcancel URL was found in the shared input or clipboard.`

Likely cause:
- Scriptable still received the wrong kind of input from Shortcuts

Recommended next fix:
- extract URLs in Shortcuts before passing anything into Scriptable

## Repo Files Mentioned

- `README.md`
- `ios/scriptable-setup.md`
- `scriptable/open-via-xcancel.js`
- `extension/src/storage.js`
- `extension/src/content-redirect.js`
- `extension/manifest.json`
- `scripts/validate-extension.mjs`

## Useful Git History Mentioned

- `a567e0d` Fix settings persistence and dedupe content redirects
- `59965a6` Add extension validation workflow
- `a68e7d5` Ignore Claude workspace files
- `fc4066a` Document iOS Shortcut fallback
- `95e1c31` Fix iOS Shortcut README link
- `de1f918` Add Scriptable iOS fallback
- `af2a95b` Handle Scriptable Shortcut errors safely
- `3ac7b0b` Return URLs to Shortcuts on iOS
- `1248b38` Accept non-string Shortcut input in Scriptable

## Best Next Step

On the iPhone, rebuild the Shortcut to this exact flow:

1. `Get URLs from Shortcut Input`
2. `Get First Item`
3. `Run Open via xcancel`
4. `URL`
5. `Open URLs`

If that still fails, the next debugging move should be:

- temporarily return the raw incoming Shortcut parameter from Scriptable
- verify exactly what Shortcuts is sending into the script
