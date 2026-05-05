import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const scriptSource = readFileSync(
  new URL("../scriptable/open-via-xcancel.js", import.meta.url),
  "utf-8"
)

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

async function runScriptable({
  shortcutParameter = null,
  urls = [],
  plainTexts = [],
  fileURLs = [],
  all = [],
  queryParameters = {},
  clipboard = null,
  runsWithSiri = false,
  failOpenInApp = false,
  fileContents = {}
} = {}) {
  const captured = {
    safariOpened: null,
    safariInAppOpened: null,
    alertShown: null,
    shortcutOutput: null,
    scriptCompleted: false
  }

  const args = {
    shortcutParameter,
    urls,
    plainTexts,
    fileURLs,
    all,
    queryParameters
  }
  const config = { runsWithSiri }
  const Pasteboard = { pasteString: () => clipboard }
  const Safari = {
    open(url) {
      captured.safariOpened = url
    },
    openInApp(url) {
      if (failOpenInApp) {
        throw new Error("simulated openInApp failure")
      }
      captured.safariInAppOpened = url
    }
  }

  class Alert {
    constructor() {
      this.title = ""
      this.message = ""
      this.actions = []
    }
    addAction(action) {
      this.actions.push(action)
    }
    async present() {
      captured.alertShown = { title: this.title, message: this.message }
    }
  }

  const Script = {
    setShortcutOutput(value) {
      captured.shortcutOutput = value
    },
    complete() {
      captured.scriptCompleted = true
    }
  }

  const FileManager = {
    local() {
      return {
        fileExists: (path) => Object.hasOwn(fileContents, path),
        readString: (path) => fileContents[path]
      }
    },
    iCloud() {
      return {
        joinPath: (a, b) => `${a}/${b}`,
        documentsDirectory: () => "/tmp",
        writeString: () => {}
      }
    }
  }

  captured.notifications = []
  class Notification {
    constructor() {
      this.title = ""
      this.body = ""
    }
    schedule() {
      captured.notifications.push({ title: this.title, body: this.body })
    }
  }

  const fn = new AsyncFunction(
    "args",
    "config",
    "Pasteboard",
    "Safari",
    "Alert",
    "Script",
    "FileManager",
    "Notification",
    scriptSource
  )

  await fn(args, config, Pasteboard, Safari, Alert, Script, FileManager, Notification)

  return captured
}

test("Share Sheet: x.com status URL via shortcutParameter -> emits xcancel URL as shortcut output", async () => {
  const result = await runScriptable({
    shortcutParameter: "https://x.com/jack/status/20"
  })

  assert.equal(result.shortcutOutput, "https://xcancel.com/jack/status/20")
  assert.equal(result.safariInAppOpened, null)
  assert.equal(result.safariOpened, null)
  assert.equal(result.alertShown, null)
})

test("Share Sheet: twitter.com status URL with query+fragment preserves both", async () => {
  const result = await runScriptable({
    shortcutParameter: "https://twitter.com/jack/status/20?s=20#frag"
  })

  assert.equal(result.shortcutOutput, "https://xcancel.com/jack/status/20?s=20#frag")
})

test("Share Sheet: x.com/home stays on X (returned unchanged)", async () => {
  const result = await runScriptable({
    shortcutParameter: "https://x.com/home"
  })

  assert.equal(result.shortcutOutput, "https://x.com/home")
})

test("Share Sheet: existing xcancel.com URL stays as xcancel", async () => {
  const result = await runScriptable({
    shortcutParameter: "https://xcancel.com/jack/status/20"
  })

  assert.equal(result.shortcutOutput, "https://xcancel.com/jack/status/20")
})

test("Share Sheet: status URL embedded in surrounding text gets extracted", async () => {
  const result = await runScriptable({
    shortcutParameter: "Check this out https://x.com/jack/status/20 wow"
  })

  assert.equal(result.shortcutOutput, "https://xcancel.com/jack/status/20")
})

test("Share Sheet: file:// from BackgroundShortcutRunner falls through to next candidate", async () => {
  const result = await runScriptable({
    shortcutParameter:
      "file:///var/mobile/tmp/com.apple.WorkflowKit.BackgroundShortcutRunner/2029875750644461726.html",
    plainTexts: ["https://x.com/jack/status/20"]
  })

  assert.equal(result.shortcutOutput, "https://xcancel.com/jack/status/20")
})

test("Share Sheet: reads URL from temporary rich-text HTML file parameter", async () => {
  const tempPath =
    "/var/mobile/tmp/com.apple.WorkflowKit.BackgroundShortcutRunner/2029875750644461726.html"
  const result = await runScriptable({
    shortcutParameter: `file://${tempPath}`,
    fileContents: {
      [tempPath]: '<html><body><a href="https://x.com/jack/status/20">link</a></body></html>'
    }
  })

  assert.equal(result.shortcutOutput, "https://xcancel.com/jack/status/20")
})

test("Share Sheet: reads URL from args.fileURLs when Shortcut passes a file input", async () => {
  const tempPath = "/private/var/mobile/Library/Caches/shared note.html"
  const result = await runScriptable({
    runsWithSiri: true,
    fileURLs: [`file://${tempPath.replace(" ", "%20")}`],
    fileContents: {
      [tempPath]: "Shared link: https://twitter.com/jack/status/20?s=20"
    }
  })

  assert.equal(result.shortcutOutput, "https://xcancel.com/jack/status/20?s=20")
  assert.equal(result.safariInAppOpened, null)
  assert.equal(result.safariOpened, null)
})

test("Share Sheet: args.urls is consulted when shortcutParameter has no usable URL", async () => {
  const result = await runScriptable({
    shortcutParameter: "ignore me",
    urls: ["https://x.com/alice/status/123"]
  })

  assert.equal(result.shortcutOutput, "https://xcancel.com/alice/status/123")
})

test("Share Sheet: structured shortcutParameter values are searched recursively", async () => {
  const result = await runScriptable({
    shortcutParameter: {
      sharedItems: [
        { title: "ignore" },
        { url: "https://x.com/listed/status/789" }
      ]
    }
  })

  assert.equal(result.shortcutOutput, "https://xcancel.com/listed/status/789")
})

test("Share Sheet: URL-like shortcutParameter objects are stringified", async () => {
  const result = await runScriptable({
    shortcutParameter: {
      toString() {
        return "https://x.com/object/status/777"
      }
    }
  })

  assert.equal(result.shortcutOutput, "https://xcancel.com/object/status/777")
})

test("Shortcut action with typed Texts but no main parameter returns shortcut output", async () => {
  const result = await runScriptable({
    runsWithSiri: true,
    plainTexts: ["https://x.com/texts/status/321"]
  })

  assert.equal(result.shortcutOutput, "https://xcancel.com/texts/status/321")
  assert.equal(result.safariInAppOpened, null)
  assert.equal(result.safariOpened, null)
})

test("URL-scheme launch: queryParameters fallback works (direct run path opens in-app)", async () => {
  const result = await runScriptable({
    queryParameters: { url: "https://x.com/bob/status/456" }
  })

  assert.equal(result.safariInAppOpened, "https://xcancel.com/bob/status/456")
  assert.equal(result.safariOpened, null)
})

test("Direct Scriptable run: clipboard fallback rewrites and opens in Scriptable in-app browser", async () => {
  const result = await runScriptable({
    clipboard: "https://x.com/jack/status/20"
  })

  assert.equal(result.safariInAppOpened, "https://xcancel.com/jack/status/20")
  assert.equal(result.safariOpened, null)
  assert.equal(result.notifications.length, 1)
  assert.match(result.notifications[0].title, /^Open via xcancel v/)
  assert.match(result.notifications[0].body, /Opening https:\/\/xcancel\.com\/jack\/status\/20/)
})

test("Direct Scriptable run: falls back to external Safari if openInApp throws", async () => {
  const result = await runScriptable({
    clipboard: "https://x.com/jack/status/20",
    failOpenInApp: true
  })

  assert.equal(result.safariOpened, "https://xcancel.com/jack/status/20")
  assert.equal(result.safariInAppOpened, null)
})

test("Shortcut context with no usable input writes failure to shortcut output", async () => {
  const result = await runScriptable({
    shortcutParameter: "no urls here just text"
  })

  assert.equal(result.safariInAppOpened, null)
  assert.equal(result.safariOpened, null)
  assert.match(
    result.shortcutOutput ?? "",
    /No supported X, Twitter, or xcancel URL/
  )
})

test("Direct run with no usable input shows version-stamped alert", async () => {
  const result = await runScriptable({
    clipboard: "no urls here either"
  })

  assert.equal(result.safariInAppOpened, null)
  assert.equal(result.safariOpened, null)
  assert.match(result.alertShown?.title ?? "", /^Open via xcancel v/)
  assert.match(
    result.alertShown?.message ?? "",
    /No supported X, Twitter, or xcancel URL/
  )
})

test("Shortcut failure output includes version stamp and input dump", async () => {
  const result = await runScriptable({
    shortcutParameter: "no urls here just text"
  })

  assert.match(result.shortcutOutput ?? "", /v[0-9TZ:+\-a-z]+/)
  assert.match(result.shortcutOutput ?? "", /Inputs: shortcutParameter=/)
})

test("First valid candidate wins: shortcutParameter beats clipboard", async () => {
  const result = await runScriptable({
    shortcutParameter: "https://x.com/first/status/1",
    clipboard: "https://x.com/second/status/2"
  })

  assert.equal(result.shortcutOutput, "https://xcancel.com/first/status/1")
})

test("Schemeless URL in shortcutParameter still gets rewritten", async () => {
  const result = await runScriptable({
    shortcutParameter: "x.com/jack/status/20"
  })

  assert.equal(result.shortcutOutput, "https://xcancel.com/jack/status/20")
})
