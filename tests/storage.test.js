import test from "node:test"
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"

const storageModuleUrl = pathToFileURL(new URL("../extension/src/storage.js", import.meta.url).pathname).href

async function importStorageModule() {
  return import(`${storageModuleUrl}?t=${Date.now()}-${Math.random()}`)
}

function withBrowserStorage(initialState = {}) {
  const state = { ...initialState }

  globalThis.browser = {
    storage: {
      local: {
        async get(defaults) {
          return { ...defaults, ...state }
        },
        async set(nextSettings) {
          Object.assign(state, nextSettings)
        }
      }
    }
  }

  delete globalThis.chrome

  return state
}

function withChromeStorage(initialState = {}) {
  const state = { ...initialState }

  globalThis.chrome = {
    runtime: {
      lastError: null
    },
    storage: {
      local: {
        get(defaults, callback) {
          callback({ ...defaults, ...state })
        },
        set(nextSettings, callback) {
          Object.assign(state, nextSettings)
          callback()
        }
      }
    }
  }

  delete globalThis.browser

  return state
}

test.afterEach(() => {
  delete globalThis.browser
  delete globalThis.chrome
})

test("setSettings preserves existing browser storage values on partial updates", async () => {
  const state = withBrowserStorage({
    enabled: false,
    redirectMode: "all",
    feedFanOut: false,
    feedFanOutCount: 5
  })
  const { getSettings, setSettings } = await importStorageModule()

  await setSettings({ enabled: true })

  assert.deepEqual(state, {
    enabled: true,
    redirectMode: "all",
    feedFanOut: false,
    feedFanOutCount: 5
  })
  assert.deepEqual(await getSettings(), {
    enabled: true,
    redirectMode: "all",
    feedFanOut: false,
    feedFanOutCount: 5
  })
})

test("setSettings preserves existing chrome storage values on partial updates", async () => {
  const state = withChromeStorage({
    enabled: false,
    redirectMode: "all",
    feedFanOut: true,
    feedFanOutCount: 7
  })
  const { getSettings, setSettings } = await importStorageModule()

  await setSettings({ redirectMode: "status-only" })

  assert.deepEqual(state, {
    enabled: false,
    redirectMode: "status-only",
    feedFanOut: true,
    feedFanOutCount: 7
  })
  assert.deepEqual(await getSettings(), {
    enabled: false,
    redirectMode: "status-only",
    feedFanOut: true,
    feedFanOutCount: 7
  })
})

test("setSettings fills in defaults when storage starts empty", async () => {
  const state = withBrowserStorage()
  const { getSettings, setSettings } = await importStorageModule()

  await setSettings({ enabled: false })

  assert.deepEqual(state, {
    enabled: false,
    redirectMode: "status-only",
    feedFanOut: false,
    feedFanOutCount: 5
  })
  assert.deepEqual(await getSettings(), {
    enabled: false,
    redirectMode: "status-only",
    feedFanOut: false,
    feedFanOutCount: 5
  })
})

test("getSettings ignores internal fallback bypass state", async () => {
  withBrowserStorage({
    enabled: false,
    redirectMode: "all",
    feedFanOut: false,
    feedFanOutCount: 5,
    fallbackBypasses: [
      {
        expiresAt: Date.now() + 1_000,
        url: "https://x.com/someone/status/123"
      }
    ]
  })
  const { getSettings } = await importStorageModule()

  assert.deepEqual(await getSettings(), {
    enabled: false,
    redirectMode: "all",
    feedFanOut: false,
    feedFanOutCount: 5
  })
})

test("getSettings clamps feedFanOutCount into the supported range", async () => {
  withBrowserStorage({
    enabled: true,
    redirectMode: "status-only",
    feedFanOut: true,
    feedFanOutCount: 99
  })
  const { getSettings } = await importStorageModule()

  assert.deepEqual(await getSettings(), {
    enabled: true,
    redirectMode: "status-only",
    feedFanOut: true,
    feedFanOutCount: 20
  })
})

test("getSettings falls back to the default count for invalid values", async () => {
  withBrowserStorage({
    enabled: true,
    redirectMode: "status-only",
    feedFanOut: true,
    feedFanOutCount: "not-a-number"
  })
  const { getSettings } = await importStorageModule()

  assert.deepEqual(await getSettings(), {
    enabled: true,
    redirectMode: "status-only",
    feedFanOut: true,
    feedFanOutCount: 5
  })
})

test("evaluateFeedFanOutCount classifies and clamps values", async () => {
  withBrowserStorage()
  const { evaluateFeedFanOutCount } = await importStorageModule()

  assert.deepEqual(evaluateFeedFanOutCount(7), { value: 7, reason: "ok" })
  assert.deepEqual(evaluateFeedFanOutCount("3.7"), { value: 3, reason: "ok" })
  assert.deepEqual(evaluateFeedFanOutCount(0), { value: 1, reason: "below" })
  assert.deepEqual(evaluateFeedFanOutCount("-2"), { value: 1, reason: "below" })
  assert.deepEqual(evaluateFeedFanOutCount(99), { value: 20, reason: "above" })
  assert.deepEqual(evaluateFeedFanOutCount("abc"), { value: 5, reason: "invalid" })
  assert.deepEqual(evaluateFeedFanOutCount(""), { value: 5, reason: "invalid" })
  assert.deepEqual(evaluateFeedFanOutCount(undefined), { value: 5, reason: "invalid" })
})

test("registerFallbackBypass stores a short-lived bypass that can be cleared", async () => {
  const state = withBrowserStorage()
  const {
    clearFallbackBypass,
    hasFallbackBypass,
    registerFallbackBypass
  } = await importStorageModule()
  const trackedUrl = "https://x.com/someone/status/123?s=20"
  const now = 10_000

  await registerFallbackBypass(trackedUrl, now)

  assert.equal(await hasFallbackBypass(trackedUrl, now + 100), true)
  assert.equal(Array.isArray(state.fallbackBypasses), true)

  await clearFallbackBypass(trackedUrl, now + 200)

  assert.equal(await hasFallbackBypass(trackedUrl, now + 300), false)
  assert.deepEqual(state.fallbackBypasses, [])
})

test("hasFallbackBypass drops expired entries", async () => {
  const state = withBrowserStorage({
    fallbackBypasses: [
      {
        expiresAt: 5_000,
        url: "https://x.com/someone/status/123"
      }
    ]
  })
  const { hasFallbackBypass } = await importStorageModule()

  assert.equal(await hasFallbackBypass("https://x.com/someone/status/123", 6_000), false)
  assert.deepEqual(state.fallbackBypasses, [])
})

test("appendDiagnosticLog stores recent normalized diagnostic entries", async () => {
  const state = withBrowserStorage()
  const { appendDiagnosticLog, getDiagnosticLog } = await importStorageModule()

  await appendDiagnosticLog({
    action: "fallback",
    source: "xcancel-fallback",
    textSnippet: "   403 Forbidden openresty   ",
    timestamp: 123
  })

  assert.deepEqual(await getDiagnosticLog(), [
    {
      action: "fallback",
      source: "xcancel-fallback",
      textSnippet: "403 Forbidden openresty",
      timestamp: 123
    }
  ])
  assert.equal(Array.isArray(state.diagnosticLog), true)
})

test("clearDiagnosticLog removes persisted diagnostics", async () => {
  const state = withBrowserStorage({
    diagnosticLog: [
      {
        action: "observe",
        source: "xcancel-fallback",
        timestamp: 123
      }
    ]
  })
  const { clearDiagnosticLog, getDiagnosticLog } = await importStorageModule()

  await clearDiagnosticLog()

  assert.deepEqual(await getDiagnosticLog(), [])
  assert.deepEqual(state.diagnosticLog, [])
})
