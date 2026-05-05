# iPhone Share Sheet Redirect — Debug Status

Snapshot of the iOS path (Scriptable + Shortcuts wrapper) as of 2026-05-05. The iPhone share-sheet flow is now **working end-to-end** from Notes: sharing an X link runs the Shortcut, Scriptable rewrites it, and iOS opens the `xcancel.com` URL in the default browser.

## Codex follow-up

The repo-side fix now covers the likely rich-text/file handoff issue instead of relying only on Shortcut edits:

- `scriptable/open-via-xcancel.js` can read temporary `file://...BackgroundShortcutRunner...html` inputs and search the file contents for the first supported URL.
- `args.shortcutParameter` is searched recursively when Shortcuts passes a list or dictionary rather than a plain string.
- `args.fileURLs`, `args.urls`, `args.plainTexts`, and deprecated `args.all` are all considered as candidate sources.
- `SCRIPT_VERSION` is now `2026-05-05T22:00Z+files`.
- `ios/scriptable-setup.md` now documents the confirmed Shortcut shape: `Get Text from Input` -> `Run Script` -> `URL` -> `Open URLs`.

`npm test` passes with 112 tests, including new runtime coverage for rich-text HTML file inputs, file URL inputs, nested shortcut parameters, URL-like shortcut objects, and typed Texts in Shortcut context.

## Final working Shortcut shape

1. `Receive [Apps and 18 more] from Share Sheet`
2. `Get Text from Shortcut Input`
3. `Run Open via xcancel with Text`
   - the `Text` token must be the blue output from the previous action
   - expanded `Texts`, `URLs`, `Images`, and `Files` rows are left empty
   - `Run In App`: off
   - `Show When Run`: off
4. `URL` with the Scriptable `Output`
5. `Open URL`

The earlier `Get URLs from Input` attempt returned empty on iPhone Notes shares, even though `Get Text from Input` displayed the X link with `Show Result`. The successful path passes the `Get Text` output as Scriptable's main `Parameter`, which Scriptable receives as `args.shortcutParameter`.

## Current goal

When the user shares a tweet link from any iPhone app (Messages, Notes, Signal, etc.) via the Share Sheet, tapping `Open via xcancel` should open the URL rewritten to `xcancel.com` in their default browser, with no intermediate dialogs.

## What's accomplished

### Scriptable script (`scriptable/open-via-xcancel.js`)

- **Replaced `new URL()` with a regex-based `parseSupportedUrl()`.** Scriptable's JavaScriptCore does not expose the global `URL` constructor — every `new URL(...)` call was throwing `ReferenceError: Can't find variable: URL` and getting swallowed by the surrounding try/catch, returning `null` for every URL. Confirmed via macOS Scriptable + a custom probe script.
- **`SCRIPT_VERSION` constant** is surfaced in alerts, success notification body, and shortcut output failure message — lets us tell at-a-glance which version the device is running.
- **Direct-run path** (Scriptable home screen / clipboard fallback): calls `Safari.openInApp(url, false)` with `await`. On macOS Scriptable this opens the user's default browser; on iOS it should open the in-app SFSafariViewController.
- **Shortcut-context path** (when run via a Shortcut's Run Script action): calls `Script.setShortcutOutput(finalUrl)` and returns. The Shortcut's downstream `Open URLs` action handles navigation. We tried `Safari.openInApp()` in shortcut context — doesn't present UI from a headless Run Script.
- **Diagnostic dump on failure** (the `+diag` version): when the script can't find a URL in any input source, the failure message includes `Inputs: candidate1=value1 | candidate2=value2 | ...` so we can see exactly what reached the script. Truncated to 80 chars per value.
- **112 Node tests passing** in `tests/scriptable-runtime.test.js` covering pure rewrite logic, input source fallthrough, shortcut-context vs direct-run path differences, and version stamping.

### macOS Shortcuts setup

Built the `Open via xcancel` shortcut natively on this Mac via the Shortcuts.app GUI. iCloud syncs the shortcut to iPhone.

Action chain:
1. `Receive [Apps and 18 more] from Share Sheet` (continue if no input)
2. `Get text from Input`
3. `Run Open via xcancel with Text` (Run In App: off, Show When Run: off)
4. `URL` — coerces the script's text output to a URL value
5. `Open URLs` — opens the URL value in default browser

Shortcut details:
- **Show in Share Sheet**: ON
- **Provide Output**: OFF (suppresses the "Shortcut Ran" preview dialog)
- **Run In App** on Run Script: OFF
- **Show When Run** on Run Script: OFF (suppresses Scriptable's per-run preview)

### iPhone-side state (last known good)

- Scriptable script syncs from `~/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents/Open via xcancel .js` to the iPhone Scriptable app.
- Direct run from Scriptable's app (with URL on clipboard) **works on iPhone**: opens xcancel page in Scriptable's in-app browser.
- After delete-and-recreate of the iPhone shortcut + iCloud sync, the shortcut **appears in the Share Sheet** (after pinning via Edit Actions → green plus).

## What's left to do

- Optionally move `Open via xcancel` higher in the iOS Share Sheet by adding it to Favorites under `Edit Actions...`.
- Keep the iCloud Scriptable copy in sync with `scriptable/open-via-xcancel.js` when the repo script changes.

## Resolved troubleshooting notes

- `Get URLs from Shortcut Input` returned an empty value for the tested iPhone Notes share.
- `Get Text from Shortcut Input` did expose the X link when verified with `Show Result`.
- The Scriptable `Run Script` action must use the main `Parameter` field. Expanded `Texts` and `URLs` rows are optional typed inputs and should stay empty for this Shortcut.
- The `Text` token in `Run Open via xcancel with Text` must be the blue magic-variable output from `Get Text from Input`; a placeholder token yields `Inputs: no input`.

## Quick reference: how to test on Mac

```bash
# Run shortcut via URL scheme (clipboard fallback path; doesn't exercise Receive→GetText)
open "shortcuts://run-shortcut?name=Open%20via%20xcancel"

# Run shortcut via CLI with file input (currently fails: "input could not be processed")
echo -n "https://x.com/jack/status/20" > /tmp/test.txt
shortcuts run "Open via xcancel" --input-path /tmp/test.txt

# Direct script test (always works — exercises clipboard path):
# 1. Copy https://x.com/jack/status/20
# 2. Open Scriptable → tap "Open via xcancel" tile → opens Chrome to xcancel page
```

## Files of interest

- `scriptable/open-via-xcancel.js` — the script itself, includes `SCRIPT_VERSION` and diagnostic dump
- `tests/scriptable-runtime.test.js` — Node test harness (112 tests)
- `~/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents/Open via xcancel .js` — iCloud-synced copy that reaches both Mac and iPhone Scriptable
- `ios/scriptable-setup.md` — public-facing setup doc for the confirmed working Shortcut shape
