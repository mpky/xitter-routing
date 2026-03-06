import { resolve } from "node:path"

export const DEFAULT_VALIDATION_URL = "https://x.com/jack/status/20"
export const DEFAULT_TIMEOUT_MS = 15000
export const EXPECTED_BEHAVIORS = Object.freeze({
  REDIRECT: "redirect",
  NO_REDIRECT: "no-redirect"
})

export function getDefaultExtensionPath(cwd = process.cwd()) {
  return resolve(cwd, "extension")
}

export function getUsageText() {
  return [
    "Usage: node scripts/validate-extension.mjs [options]",
    "",
    "Validates that the unpacked extension rewrites an X/Twitter URL to xcancel.com in Chromium.",
    "",
    "Options:",
    "  --url <url>               URL to open for validation",
    "  --extension-path <path>   path to the unpacked extension directory",
    "  --expect <behavior>       one of: redirect, no-redirect",
    "  --timeout <ms>            redirect timeout in milliseconds",
    "  -h, --help                show this help text"
  ].join("\n")
}

export function parseCliArgs(argv, cwd = process.cwd()) {
  const options = {
    expect: EXPECTED_BEHAVIORS.REDIRECT,
    extensionPath: getDefaultExtensionPath(cwd),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    url: DEFAULT_VALIDATION_URL
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === "--help" || argument === "-h") {
      return { help: true }
    }

    if (argument === "--url") {
      const value = argv[index + 1]

      if (!value || value.startsWith("--")) {
        return { error: "Missing value for --url." }
      }

      options.url = value
      index += 1
      continue
    }

    if (argument === "--extension-path") {
      const value = argv[index + 1]

      if (!value || value.startsWith("--")) {
        return { error: "Missing value for --extension-path." }
      }

      options.extensionPath = resolve(cwd, value)
      index += 1
      continue
    }

    if (argument === "--timeout") {
      const value = argv[index + 1]

      if (!value || value.startsWith("--")) {
        return { error: "Missing value for --timeout." }
      }

      const parsedTimeout = Number.parseInt(value, 10)

      if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
        return { error: "Timeout must be a positive integer." }
      }

      options.timeoutMs = parsedTimeout
      index += 1
      continue
    }

    if (argument === "--expect") {
      const value = argv[index + 1]

      if (!value || value.startsWith("--")) {
        return { error: "Missing value for --expect." }
      }

      if (!Object.values(EXPECTED_BEHAVIORS).includes(value)) {
        return { error: "Expected behavior must be 'redirect' or 'no-redirect'." }
      }

      options.expect = value
      index += 1
      continue
    }

    return { error: `Unknown option: ${argument}` }
  }

  return { options }
}
