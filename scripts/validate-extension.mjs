#!/usr/bin/env node

import { execFile } from "node:child_process"
import { mkdtemp, rm, stat } from "node:fs/promises"
import os from "node:os"
import { join } from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"

import {
  EXPECTED_BEHAVIORS,
  getUsageText,
  parseCliArgs
} from "./lib/validate-extension-cli.js"

const execFileAsync = promisify(execFile)
const PLAYWRIGHT_VERSION = "1.58.2"

async function pathExists(pathname) {
  try {
    await stat(pathname)
    return true
  } catch {
    return false
  }
}

async function ensurePlaywrightImport() {
  try {
    return await import("playwright")
  } catch {
    const packageRoot = await mkdtemp(join(os.tmpdir(), "xitter-routing-playwright-"))

    try {
      await execFileAsync("npm", [
        "install",
        "--no-save",
        "--prefix",
        packageRoot,
        `playwright@${PLAYWRIGHT_VERSION}`
      ])
      return await import(
        pathToFileURL(join(packageRoot, "node_modules", "playwright", "index.mjs")).href
      )
    } catch (error) {
      await rm(packageRoot, { force: true, recursive: true }).catch(() => {})
      throw error
    }
  }
}

async function waitForRedirect(page, timeoutMs) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const currentUrl = page.url()

    if (currentUrl.startsWith("https://xcancel.com/")) {
      return currentUrl
    }

    await page.waitForTimeout(250)
  }

  return page.url()
}

function getValidationOutcome(finalUrl, expectedBehavior) {
  const redirected = finalUrl.startsWith("https://xcancel.com/")

  if (expectedBehavior === EXPECTED_BEHAVIORS.NO_REDIRECT) {
    return {
      passed: !redirected,
      redirected
    }
  }

  return {
    passed: redirected,
    redirected
  }
}

async function validateExtension({ expect, extensionPath, timeoutMs, url }) {
  if (!(await pathExists(extensionPath))) {
    throw new Error(`Extension path does not exist: ${extensionPath}`)
  }

  const { chromium } = await ensurePlaywrightImport()
  const profileDir = await mkdtemp(join(os.tmpdir(), "xitter-routing-validation-profile-"))
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

    let [extensionServiceWorker] = context.serviceWorkers()

    if (!extensionServiceWorker) {
      extensionServiceWorker = await context.waitForEvent("serviceworker", {
        timeout: timeoutMs
      }).catch(() => null)
    }

    const page = await context.newPage()
    await page.goto(url, {
      timeout: timeoutMs,
      waitUntil: "domcontentloaded"
    })

    const finalUrl = await waitForRedirect(page, timeoutMs)
    const loadedExtensionId = extensionServiceWorker?.url()?.match(/^chrome-extension:\/\/([^/]+)/)?.[1] ?? null
    const { passed, redirected } = getValidationOutcome(finalUrl, expect)

    return {
      expectedBehavior: expect,
      extensionLoaded: loadedExtensionId !== null,
      extensionId: loadedExtensionId,
      finalUrl,
      passed,
      redirected,
      title: await page.title(),
      url
    }
  } finally {
    await context?.close().catch(() => {})
    await rm(profileDir, { force: true, recursive: true }).catch(() => {})
  }
}

async function main() {
  const parsedArgs = parseCliArgs(process.argv.slice(2))

  if (parsedArgs.help) {
    process.stdout.write(`${getUsageText()}\n`)
    return
  }

  if (parsedArgs.error) {
    process.stderr.write(`${parsedArgs.error}\n`)
    process.stderr.write(`${getUsageText()}\n`)
    process.exit(1)
  }

  try {
    const result = await validateExtension(parsedArgs.options)
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)

    if (!result.passed) {
      process.exit(1)
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exit(1)
  }
}

main()
