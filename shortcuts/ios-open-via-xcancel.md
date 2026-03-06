# iOS Shortcut: Open via xcancel

This is a Shortcut-first iOS fallback for opening shared `x.com` and `twitter.com` links via `xcancel.com`.

It is manual by design:

- run it from the Share Sheet in apps like Messages, Signal, WhatsApp, or Safari
- pass in a URL or selected text
- rewrite supported X/Twitter status links to `xcancel.com`
- open the result in Safari

It does not automatically intercept taps across iOS.

## Behavior

- rewrites status URLs on `x.com`, `www.x.com`, and `mobile.x.com`
- rewrites status URLs on `twitter.com`, `www.twitter.com`, and `mobile.twitter.com`
- preserves path, query string, and fragment
- leaves existing `xcancel.com` links alone
- leaves non-status X/Twitter URLs alone
- opens the final URL in Safari

Examples:

- `https://x.com/jack/status/20` -> `https://xcancel.com/jack/status/20`
- `https://twitter.com/jack/status/20?s=20#frag` -> `https://xcancel.com/jack/status/20?s=20#frag`

## Shortcut Setup

Create a new Shortcut named `Open via xcancel` with these settings:

1. In `Shortcuts`, tap `+` to create a new shortcut.
2. Name it `Open via xcancel`.
3. Open the shortcut details.
4. Enable `Show in Share Sheet`.
5. Set `Accepted Types` to at least `URLs` and `Text`.
6. Optionally pin it to the Action button, Back Tap, or Home Screen.

Add these actions in order:

1. `Get URLs from Input`
2. `If` `URLs` `has any value`
3. `Get Item from List`
   Configure it to use the `First Item` from `URLs`.
4. `Otherwise`
5. `Show Alert`
   Use a message like `No URL found in the shared input.`
6. `Stop This Shortcut`
7. `End If`
8. `Text`
   Use `Provided Input`
9. `Replace Text`
   Configure:
   - `Text`: `Provided Input`
   - `Find`: `^https?://(?:www\\.|mobile\\.)?x\\.com/((?:i/status/\\d+|[^/]+/status/\\d+)(?:[/?#].*)?)$`
   - `Replace With`: `https://xcancel.com/`
   - `Regular Expression`: On
   - `Case Sensitive`: Off
10. `Replace Text`
    Configure:
    - `Text`: output of the previous replace
    - `Find`: `^https?://(?:www\\.|mobile\\.)?twitter\\.com/((?:i/status/\\d+|[^/]+/status/\\d+)(?:[/?#].*)?)$`
    - `Replace With`: `https://xcancel.com/`
    - `Regular Expression`: On
    - `Case Sensitive`: Off
11. `Open URLs`
    Configure it to open the result of the second replace.

## Recommended Checks

After creating the shortcut, test:

1. Share `https://x.com/jack/status/20` and confirm Safari opens `https://xcancel.com/jack/status/20`
2. Share `https://twitter.com/jack/status/20?s=20#frag` and confirm query and fragment survive
3. Share `https://xcancel.com/jack/status/20` and confirm it still opens normally
4. Share `https://x.com/home` and confirm it stays on X rather than rewriting
5. Share text with no URL and confirm the alert appears

## Notes

- This Shortcut rewrites only status-style X/Twitter URLs by default.
- Some apps may keep links inside their own in-app browser; the Share Sheet remains the escape hatch for those flows.
