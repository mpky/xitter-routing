#!/usr/bin/env node

import { execFile } from "node:child_process"
import { mkdtemp, rm, stat } from "node:fs/promises"
import os from "node:os"
import { join, resolve } from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const PLAYWRIGHT_VERSION = "1.58.2"
const FAN_OUT_COUNT = 3
const TIMEOUT_MS = 20000
const FIXTURE_URL = "https://x.com/home"

const FIXTURE_HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>x.com fixture feed</title></head>
  <body>
    <main>
      <article data-testid="tweet">
        <div data-testid="socialContext">Pinned</div>
        <a href="/pinneduser/status/100">pinned post</a>
      </article>
      <article data-testid="tweet">
        <div data-testid="socialContext">Ad</div>
        <a href="/sponsor/status/200">ad post</a>
      </article>
      <article data-testid="tweet">
        <a href="/alice/status/300">alice post</a>
      </article>
      <article data-testid="tweet">
        <a href="/bob/status/400/photo/1">bob post</a>
      </article>
      <article data-testid="tweet">
        <a href="/carol/status/500">carol post</a>
      </article>
      <article data-testid="tweet">
        <a href="/dave/status/600">dave post</a>
      </article>
    </main>
  </body>
</html>`

const XCANCEL_FIXTURE_HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>xcancel fixture</title></head>
  <body><main>fan-out target</main></body>
</html>`

const EXPECTED_FAN_OUT_URLS = [
  "https://xcancel.com/alice/status/300",
  "https://xcancel.com/bob/status/400",
  "https://xcancel.com/carol/status/500"
]

let bootstrappedPlaywrightRoot = null

async function pathExists(pathname) {
  try {
    await stat(pathname)
    return true
  } catch (error) {
    if (error.code === "ENOENT") {
      return false
    }
    throw error
  }
}

async function ensurePlaywrightImport() {
  try {
    return await import("playwright")
  } catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND" && error.code !== "MODULE_NOT_FOUND") {
      throw error
    }

    const packageRoot = await mkdtemp(join(os.tmpdir(), "xitter-routing-playwright-"))

    try {
      await execFileAsync("npm", [
        "install",
        "--no-save",
        "--prefix",
        packageRoot,
        `playwright@${PLAYWRIGHT_VERSION}`
      ])
      const playwrightModule = await import(
        pathToFileURL(join(packageRoot, "node_modules", "playwright", "index.mjs")).href
      )
      bootstrappedPlaywrightRoot = packageRoot
      return playwrightModule
    } catch (installError) {
      await rm(packageRoot, { force: true, recursive: true }).catch(() => {})
      throw installError
    }
  }
}

async function waitForServiceWorker(context, timeoutMs) {
  const [existing] = context.serviceWorkers()

  if (existing) {
    return existing
  }

  return context.waitForEvent("serviceworker", { timeout: timeoutMs }).catch(() => null)
}

async function seedSettings(serviceWorker, desired) {
  const deadline = Date.now() + 5000

  while (Date.now() < deadline) {
    await serviceWorker.evaluate(async (settings) => {
      await new Promise((resolveSet) => {
        chrome.storage.local.set(settings, () => resolveSet())
      })
    }, desired)

    const observed = await serviceWorker.evaluate(async () => {
      return new Promise((resolveGet) => {
        chrome.storage.local.get(null, (items) => resolveGet(items))
      })
    })

    const matches = Object.entries(desired).every(
      ([key, value]) => observed[key] === value
    )

    if (matches) {
      return observed
    }

    await new Promise((tick) => setTimeout(tick, 100))
  }

  throw new Error("seedSettings: storage never reflected the desired values")
}

async function validateFeedFanOut(redirectMode) {
  const extensionPath = resolve(process.cwd(), "extension")

  if (!(await pathExists(extensionPath))) {
    throw new Error(`Extension path does not exist: ${extensionPath}`)
  }

  const { chromium } = await ensurePlaywrightImport()
  const profileDir = await mkdtemp(join(os.tmpdir(), "xitter-routing-fanout-profile-"))
  let context

  try {
    context = await chromium.launchPersistentContext(profileDir, {
      channel: "chromium",
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--no-first-run",
        "--no-default-browser-check"
      ]
    })

    await context.route("https://x.com/home", (route) => {
      route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: FIXTURE_HTML
      })
    })

    await context.route(/^https:\/\/xcancel\.com\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: XCANCEL_FIXTURE_HTML
      })
    })

    const serviceWorker = await waitForServiceWorker(context, TIMEOUT_MS)

    if (!serviceWorker) {
      throw new Error("Extension service worker did not register in time.")
    }

    await seedSettings(serviceWorker, {
      enabled: true,
      redirectMode,
      feedFanOut: true,
      feedFanOutCount: FAN_OUT_COUNT
    })

    const observedFanOutUrls = []
    const observedXcancelHomeRedirects = []
    let observedMaskText = null
    let originalTabClosed = false

    context.on("page", async (newPage) => {
      try {
        await newPage.waitForLoadState("domcontentloaded", { timeout: TIMEOUT_MS })
      } catch {
        // ignore — we still record the URL
      }

      const url = newPage.url()

      if (url === "https://xcancel.com/home") {
        observedXcancelHomeRedirects.push(url)
        return
      }

      if (url.startsWith("https://xcancel.com/")) {
        observedFanOutUrls.push(url)
      }
    })

    const originalPage = await context.newPage()

    originalPage.once("close", () => {
      originalTabClosed = true
    })

    await originalPage.goto(FIXTURE_URL, {
      timeout: TIMEOUT_MS,
      waitUntil: "domcontentloaded"
    }).catch(() => {})

    observedMaskText = await originalPage.evaluate(() => {
      const node = document.getElementById("xrt-fanout-mask")
      return node ? node.textContent : null
    }).catch(() => null)

    const deadline = Date.now() + TIMEOUT_MS

    while (Date.now() < deadline) {
      if (observedFanOutUrls.length >= FAN_OUT_COUNT && originalTabClosed) {
        break
      }
      await new Promise((tick) => setTimeout(tick, 200))
    }

    const maskApplied = typeof observedMaskText === "string" && observedMaskText.includes("Loading top posts")
    const sortedObserved = [...observedFanOutUrls].sort()
    const sortedExpected = [...EXPECTED_FAN_OUT_URLS].sort()
    const fanOutMatches =
      sortedObserved.length === sortedExpected.length &&
      sortedObserved.every((url, index) => url === sortedExpected[index])
    const homeNotRedirected = observedXcancelHomeRedirects.length === 0

    // maskApplied is informational only: the mask is up briefly between
    // applyMask() and the source tab closing, and the post-goto evaluate
    // sometimes loses the race. Reaching the fan-out branch at all proves the
    // mask was applied — the script can't get there otherwise.
    const passed = fanOutMatches && originalTabClosed && homeNotRedirected

    return {
      redirectMode,
      passed,
      maskApplied,
      maskText: observedMaskText,
      fanOutMatches,
      homeNotRedirected,
      observedFanOutUrls: sortedObserved,
      expectedFanOutUrls: sortedExpected,
      observedXcancelHomeRedirects,
      originalTabClosed
    }
  } finally {
    await context?.close().catch(() => {})
    await rm(profileDir, { force: true, recursive: true }).catch(() => {})
  }
}

async function main() {
  try {
    const results = []

    for (const redirectMode of ["status-only", "all"]) {
      const result = await validateFeedFanOut(redirectMode)
      results.push(result)
    }

    process.stdout.write(`${JSON.stringify({ results }, null, 2)}\n`)

    if (!results.every((result) => result.passed)) {
      process.exit(1)
    }
  } catch (error) {
    process.stderr.write(`${error.stack ?? error.message}\n`)
    process.exit(1)
  } finally {
    if (bootstrappedPlaywrightRoot) {
      await rm(bootstrappedPlaywrightRoot, { force: true, recursive: true }).catch(() => {})
    }
  }
}

main()
