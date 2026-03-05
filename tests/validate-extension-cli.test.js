import test from "node:test"
import assert from "node:assert/strict"

import {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_VALIDATION_URL,
  EXPECTED_BEHAVIORS,
  getDefaultExtensionPath,
  getUsageText,
  parseCliArgs
} from "../scripts/lib/validate-extension-cli.js"

test("parseCliArgs returns help for help flags", () => {
  assert.deepEqual(parseCliArgs(["--help"]), { help: true })
  assert.deepEqual(parseCliArgs(["-h"]), { help: true })
})

test("parseCliArgs applies defaults", () => {
  assert.deepEqual(parseCliArgs([], "/tmp/project"), {
    options: {
      expect: EXPECTED_BEHAVIORS.REDIRECT,
      extensionPath: getDefaultExtensionPath("/tmp/project"),
      timeoutMs: DEFAULT_TIMEOUT_MS,
      url: DEFAULT_VALIDATION_URL
    }
  })
})

test("parseCliArgs accepts explicit values", () => {
  assert.deepEqual(
    parseCliArgs(
      ["--url", "https://twitter.com/jack/status/20", "--extension-path", "extension-dev", "--timeout", "9000"],
      "/tmp/project"
    ),
    {
      options: {
        expect: EXPECTED_BEHAVIORS.REDIRECT,
        extensionPath: "/tmp/project/extension-dev",
        timeoutMs: 9000,
        url: "https://twitter.com/jack/status/20"
      }
    }
  )
})

test("parseCliArgs accepts explicit expected behavior", () => {
  assert.deepEqual(
    parseCliArgs(["--expect", EXPECTED_BEHAVIORS.NO_REDIRECT], "/tmp/project"),
    {
      options: {
        expect: EXPECTED_BEHAVIORS.NO_REDIRECT,
        extensionPath: getDefaultExtensionPath("/tmp/project"),
        timeoutMs: DEFAULT_TIMEOUT_MS,
        url: DEFAULT_VALIDATION_URL
      }
    }
  )
})

test("parseCliArgs rejects invalid or missing values", () => {
  assert.deepEqual(parseCliArgs(["--url"]), {
    error: "Missing value for --url."
  })
  assert.deepEqual(parseCliArgs(["--extension-path"]), {
    error: "Missing value for --extension-path."
  })
  assert.deepEqual(parseCliArgs(["--timeout"]), {
    error: "Missing value for --timeout."
  })
  assert.deepEqual(parseCliArgs(["--timeout", "0"]), {
    error: "Timeout must be a positive integer."
  })
  assert.deepEqual(parseCliArgs(["--expect"]), {
    error: "Missing value for --expect."
  })
  assert.deepEqual(parseCliArgs(["--expect", "maybe"]), {
    error: "Expected behavior must be 'redirect' or 'no-redirect'."
  })
  assert.deepEqual(parseCliArgs(["--nope"]), {
    error: "Unknown option: --nope"
  })
})

test("getUsageText documents the validator", () => {
  assert.match(getUsageText(), /validate-extension\.mjs/)
  assert.match(getUsageText(), /--extension-path/)
  assert.match(getUsageText(), /--expect/)
})
