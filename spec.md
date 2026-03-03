# spec.md - X/Twitter to xcancel Redirect Tools

## 0. Goal

When the user encounters an `x.com` or `twitter.com` link, open the equivalent URL on `xcancel.com` in a browser instead of sending the user into the X app.

The user still wants to keep the X app installed and usable for intentional app launches.

Examples:
- `https://x.com/user/status/123` -> `https://xcancel.com/user/status/123`
- `https://twitter.com/user/status/123?s=20&t=abc#frag` -> `https://xcancel.com/user/status/123?s=20&t=abc#frag`

Non-goals:
- Modifying behavior inside the X app.
- Forcing a guaranteed system-wide redirect for every tap on iOS.
- Bypassing auth, rate limits, or paywalls.

---

## 1. Product Split

These should be treated as two different tools with shared URL rewrite logic:

1. `Tool iOS`: best-effort redirect when links are opened through Safari, with a manual fallback when source apps keep links inside in-app browsers.
2. `Tool macOS`: browser redirect for normal link opens, with an optional native helper for cases where a browser extension is not enough.

Both tools should share the same pure URL rewriter module and test cases.

---

## 2. Shared Rewrite Rules

### 2.1 Supported Input Hosts

- `x.com`
- `www.x.com`
- `mobile.x.com`
- `twitter.com`
- `www.twitter.com`
- `mobile.twitter.com`

### 2.2 Rewrite Output

- Force scheme to `https`
- Replace hostname with `xcancel.com`
- Preserve path
- Preserve query string
- Preserve fragment

### 2.3 Safety Rules

- If hostname is already `xcancel.com`, do nothing.
- If URL parsing fails, do nothing.
- If hostname is not in the supported input set, do nothing.

### 2.4 Reference Behavior

Input:
`http://mobile.twitter.com/user/status/123?s=20#frag`

Output:
`https://xcancel.com/user/status/123?s=20#frag`

---

## 3. Tool iOS

## 3.1 User Goal

When the user taps an X/Twitter link in apps like iMessage, Signal, or WhatsApp on iPhone, the preferred outcome is:

1. the link opens in Safari, and
2. Safari loads the `xcancel.com` version.

The user still wants to be able to open the X app directly when they choose to.

## 3.2 Platform Constraint

iOS does not provide a reliable global "intercept all `https://x.com/...` taps and rewrite them before any app handles them" hook for third-party apps.

That means this tool can be "best effort automatic", not "guaranteed system-wide automatic".

## 3.3 Recommended Architecture

Primary path:
- Safari Web Extension on iOS
- Shared URL rewriter
- Safari-side redirect when navigation reaches Safari

Fallback path:
- Share Sheet Shortcut named `Open via xcancel`

The extension is the automatic layer. The shortcut is the escape hatch for apps that keep links inside their own in-app browser or hand links directly to the X app.

## 3.4 Functional Requirements

FR-iOS-1. Redirect Safari navigations from supported X/Twitter hosts to `xcancel.com`.

FR-iOS-2. Preserve path, query, and fragment.

FR-iOS-3. Do not redirect if the URL is already on `xcancel.com`.

FR-iOS-4. Provide a simple enable/disable setting.

FR-iOS-5. Fail safely if parsing fails.

FR-iOS-6. Do not interfere with direct launches of the X app by icon tap, Spotlight, or other explicit app-open flows.

FR-iOS-7. Provide a manual fallback path when the source app does not hand the link to Safari.

## 3.5 Handoff Strategy

HS-iOS-1. Safari should be the default browser.

HS-iOS-2. If iMessage, Signal, or WhatsApp offers `Open in Safari` or a similar action on long-press, that route should trigger the Safari extension.

HS-iOS-3. If the source app opens the link in an embedded browser where Safari extensions do not run, the user can use the Share Sheet shortcut instead.

HS-iOS-4. The existence of the X app must not be treated as an error condition. The product goal is "prefer xcancel when opening links", not "disable the X app".

## 3.6 Components

### 3.6.1 Shared URL Rewriter

- Pure function
- Input: URL string
- Output: rewritten URL string or `null`
- Fully unit-testable

### 3.6.2 Safari Extension Redirect Layer

- Runs when navigation reaches Safari
- Calls shared rewriter
- Replaces navigation target with rewritten URL

### 3.6.3 Settings Store

- Boolean: enabled
- Optional future mapping table for alternate frontends

### 3.6.4 Shortcut Fallback

- Accept URL or text
- Extract first URL
- Rewrite if supported
- Open result in Safari

## 3.7 UX Flows

### 3.7.1 Preferred Flow

1. User taps an X link in iMessage, Signal, or WhatsApp
2. The app hands the link to Safari
3. Safari extension rewrites to `xcancel.com`
4. Safari loads rewritten page

### 3.7.2 Fallback Flow

1. User long-presses or shares the link
2. User runs `Open via xcancel`
3. Shortcut rewrites URL
4. Shortcut opens Safari on `xcancel.com`

### 3.7.3 Explicit X App Flow

1. User intentionally opens the X app directly
2. No redirect logic runs

## 3.8 Non-Functional Requirements

NFR-iOS-1. Redirect decision should be effectively instant once Safari starts navigation.

NFR-iOS-2. No network calls are required for rewrite logic.

NFR-iOS-3. No analytics or off-device URL logging by default.

NFR-iOS-4. Settings surface should be minimal.

## 3.9 Limitations

- Not all source apps will hand links to Safari.
- Safari extensions do not reliably run inside third-party in-app browsers.
- Keeping the X app installed means some app or OS behaviors may still prefer the app in some situations.
- The manual shortcut fallback is part of the product, not a bug workaround.

## 3.10 Deliverables

- iOS Safari Web Extension project
- Shared rewriter module
- Unit tests for rewrite logic
- Share Sheet shortcut export
- README with setup instructions and realistic limitations

---

## 4. Tool macOS

## 4.1 User Goal

When the user clicks an X/Twitter link on macOS, it should open in a browser as the `xcancel.com` equivalent instead of going to the X app when possible.

## 4.2 Architectural Position

The macOS tool should not be defined as "the same thing as iOS, but on desktop".

On macOS, there are two distinct layers worth designing:

1. Browser-layer redirect for normal web navigation
2. Optional native helper for non-browser entry points

This is different from iOS because macOS gives more room for helper-app UX, Services, and clipboard-driven flows.

## 4.3 Recommended Architecture

Primary path:
- Safari Web Extension first
- Optional Chrome/Firefox ports later

Optional helper path:
- Small native macOS app or menu bar utility
- Provides `Open via xcancel` service / quick action
- Can rewrite a copied URL and open the browser explicitly

The browser extension is the core product. The native helper exists to cover workflows where a browser extension never gets a chance to inspect the URL.

## 4.4 Functional Requirements

FR-mac-1. Redirect browser navigations from supported X/Twitter hosts to `xcancel.com`.

FR-mac-2. Preserve path, query, and fragment.

FR-mac-3. Do not redirect if the URL is already on `xcancel.com`.

FR-mac-4. Provide a simple enable/disable setting.

FR-mac-5. Fail safely on malformed URLs.

FR-mac-6. Optional helper app can accept a URL from Services, clipboard, or manual paste and open the rewritten URL in the browser.

## 4.5 Components

### 4.5.1 Shared URL Rewriter

- Same logic and tests as iOS

### 4.5.2 Browser Navigation Interceptor

- Safari extension first
- Later ports to Chromium/Firefox if needed
- Responsible for top-level redirects once a browser receives the URL

### 4.5.3 Config Store

- Enabled flag
- Optional future domain mapping

### 4.5.4 Native Helper (Optional)

- Menu bar or lightweight app
- Quick Action / Service entry point
- Accepts URL text or clipboard contents
- Rewrites URL using shared rewriter
- Opens rewritten URL in default browser

### 4.5.5 Quick Action Helper Implementation

- Repo-owned helper script: `scripts/open-via-xcancel.mjs`
- Automator-friendly wrapper script: `scripts/open-via-xcancel-quick-action.zsh`
- Input sources:
  - selected text passed as arguments from Automator
  - stdin
  - clipboard fallback
- Input precedence:
  - arguments
  - stdin
  - clipboard
- Rewrite behavior:
  - explicit Quick Action invocation uses "rewrite all supported X/Twitter URLs"
  - existing `xcancel.com` URLs are passed through unchanged
- CLI behavior:
  - invalid options fail with a non-zero exit code
  - missing or unsupported URLs fail safely with a non-zero exit code
- Browser target:
  - Google Chrome by default
  - optional override to use the system default browser
- Test coverage:
  - pure URL extraction and rewrite helpers
  - CLI argument parsing, input-source selection, and browser-open behavior

## 4.6 UX Flows

### 4.6.1 Standard Flow

1. User clicks X/Twitter link in Mail, Messages, Slack, or another app
2. Link opens in browser
3. Browser extension rewrites to `xcancel.com`
4. Browser loads rewritten page

### 4.6.2 Helper Flow

1. User right-clicks or copies a link
2. User invokes `Open via xcancel`
3. Helper rewrites URL
4. Helper opens browser on `xcancel.com`

## 4.7 Limitations

- If an app sends the link straight into the X app, a browser extension cannot intercept that event.
- A native helper improves ergonomics but does not create a true system-wide domain override.
- Network-layer rewriting is explicitly out of scope because it is too invasive for this use case.

## 4.8 Non-Functional Requirements

NFR-mac-1. Redirect decision should be near-instant.

NFR-mac-2. No analytics or remote logging by default.

NFR-mac-3. Minimal permissions.

NFR-mac-4. Optional native helper should be lightweight and not run privileged background services.

## 4.9 Deliverables

- macOS Safari Web Extension project
- Shared rewriter module
- Unit tests for rewrite logic
- Repo-owned Quick Action helper and wrapper
- README with install and usage instructions

---

## 5. Shared Test Plan

Unit tests:
- `x.com` rewrites to `xcancel.com`
- `twitter.com` rewrites to `xcancel.com`
- `www.` and `mobile.` variants rewrite correctly
- Query and fragment are preserved
- `xcancel.com` does not rewrite
- Non-target domains do not rewrite
- Malformed URLs do not rewrite

Manual tests:
- iOS: tap link that opens in Safari and confirm redirect
- iOS: run Share Sheet shortcut from Messages/Signal/WhatsApp and confirm redirect
- macOS: click link from Mail/Messages and confirm browser redirect
- macOS: invoke helper flow and confirm browser opens rewritten URL

---

## 6. Milestones

### Shared

M1. Define and implement pure URL rewriter

M2. Add unit tests for all rewrite cases

### iOS

M3. Build Safari Web Extension redirect

M4. Build and export Share Sheet shortcut fallback

M5. Write setup notes covering Safari default browser and extension enablement

### macOS

M6. Build Safari browser extension

M7. Evaluate optional native helper or Quick Action prototype

M8. Write installation and usage notes

---

## 7. Product Decisions Captured Here

- iOS and macOS are separate tools, not one shared architecture.
- iOS cannot promise fully transparent interception from iMessage, Signal, or WhatsApp while the X app remains installed.
- The iOS product therefore includes a first-class manual fallback.
- macOS should keep the browser extension as the default architecture, but it may add a native helper because desktop entry points are more flexible.
