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
- opens the final URL in Safari

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
5. Set `Accepted Types` to at least `URLs` and `Text`.

Add one action:

1. `Run Script`
   Configure:
   - `Script`: `Open via xcancel`
   - `Parameter`: `Shortcut Input`

That is the whole Shortcut. The Scriptable script handles URL extraction and opens Safari directly.

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
