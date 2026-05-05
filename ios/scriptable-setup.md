# iOS Setup: Scriptable + Shortcut

This is the recommended iOS setup.

Instead of building the rewrite logic inside Shortcuts, keep the logic in one Scriptable script and use a thin Share Sheet Shortcut to launch it.

That is easier to set up, easier to edit later, and easier to keep in sync with the repo.

## What You Need

- the `Scriptable` app installed on your iPhone
- the script in [scriptable/open-via-xcancel.js](../scriptable/open-via-xcancel.js)
- an optional Shortcut launcher for the Share Sheet

## Behavior

- accepts shared URLs or text
- falls back to the clipboard if no input is passed
- rewrites supported X/Twitter status URLs to `xcancel.com`
- preserves path, query string, and fragment
- leaves existing `xcancel.com` URLs alone
- leaves non-status X/Twitter URLs alone
- returns the final URL to Shortcuts when run from the Share Sheet
- opens the final URL directly when run inside Scriptable

## Step 1: Add the Scriptable Script

1. Open `Scriptable` on your iPhone.
2. Create a new script named `Open via xcancel`.
3. Copy the contents of [scriptable/open-via-xcancel.js](../scriptable/open-via-xcancel.js) into it.
4. Save the script.

You can test it immediately in Scriptable by copying a URL like `https://x.com/jack/status/20` to the clipboard and running the script.

## Step 2: Create the Shortcut Launcher

Create a new Shortcut named `Open via xcancel` with these settings:

1. In `Shortcuts`, tap `+`.
2. Name it `Open via xcancel`.
3. Open the shortcut details.
4. Enable `Show in Share Sheet`.
5. Set `Accepted Types` to at least `URLs`, `Text`, `Rich Text`, and `Safari Web Pages`.
6. Turn `Provide Output` off.

Add these actions:

1. `Get Text from Input`
   Use `Shortcut Input`.
2. `Run Script`
   Configure:
   - `Script`: `Open via xcancel`
   - `Parameter`: the output of step 1
   - `Run In App`: off
   - `Show When Run`: off
   - leave the expanded `Texts`, `URLs`, `Images`, and `Files` rows empty
3. `URL`
   Use the output of step 2.
4. `Open URLs`
   Use the output of step 3.

That is the whole Shortcut. `Get Text from Input` is the important normalizer: it exposes the shared note/message/page text to Scriptable, and the script extracts the first supported URL from that text. Scriptable returns text, so the `URL` action converts that text into a URL value before `Open URLs` opens it.

The expanded `Texts` and `URLs` rows inside Scriptable's `Run Script` action are optional typed inputs. For this Shortcut, leave them empty and use the main `Parameter` field only. The `Parameter` token should be the blue output from `Get Text from Input`, not a placeholder.

## Optional: Direct Scriptable Share Sheet

You can also make the Scriptable script appear directly in the iOS Share Sheet:

1. Open the script in `Scriptable`.
2. Open the script settings.
3. Enable Share Sheet input types for `URLs`, `Text`, and `File URLs`.

The Shortcut launcher is still recommended because it can normalize rich text before Scriptable runs.

## Troubleshooting

### `No supported X, Twitter, or xcancel URL was found`

Update the script on your iPhone to the latest repo copy, then run the Shortcut again. The failure text includes the script version and a short dump of what Scriptable received.

Most failures come from one of these:

- the `Run Script` action's main `Parameter` is empty
- the `Run Script` parameter is a placeholder instead of the `Get Text from Input` output
- the iPhone has an older iCloud-synced copy of the Scriptable script
- the app sharing the link did not expose a URL to Shortcuts

If you need to debug the Shortcut input, temporarily insert `Show Result` after `Get Text from Input`. If `Show Result` displays the X/Twitter link, wire that same `Text` output into the Scriptable `Parameter`.

## Recommended Checks

After setup, test:

1. Share `https://x.com/jack/status/20` and confirm Safari opens `https://xcancel.com/jack/status/20`
2. Share `https://twitter.com/jack/status/20?s=20#frag` and confirm query and fragment survive
3. Share `https://x.com/home` and confirm it stays on X
4. Share `https://xcancel.com/jack/status/20` and confirm it still opens normally
5. Copy a supported URL to the clipboard and run the script directly in Scriptable to confirm the clipboard fallback works

## Notes

- This is manual and Share Sheet driven. It does not globally intercept taps across iOS.
- The Scriptable script is the source of truth. The Shortcut should stay thin.
- If you want to change the rewrite behavior later, edit the Scriptable script rather than expanding the Shortcut graph.
