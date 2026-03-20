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
    redirectMode: "all"
  })
  const { getSettings, setSettings } = await importStorageModule()

  await setSettings({ enabled: true })

  assert.deepEqual(state, {
    enabled: true,
    redirectMode: "all"
  })
  assert.deepEqual(await getSettings(), {
    enabled: true,
    redirectMode: "all"
  })
})

test("setSettings preserves existing chrome storage values on partial updates", async () => {
  const state = withChromeStorage({
    enabled: false,
    redirectMode: "all"
  })
  const { getSettings, setSettings } = await importStorageModule()

  await setSettings({ redirectMode: "status-only" })

  assert.deepEqual(state, {
    enabled: false,
    redirectMode: "status-only"
  })
  assert.deepEqual(await getSettings(), {
    enabled: false,
    redirectMode: "status-only"
  })
})

test("setSettings fills in defaults when storage starts empty", async () => {
  const state = withBrowserStorage()
  const { getSettings, setSettings } = await importStorageModule()

  await setSettings({ enabled: false })

  assert.deepEqual(state, {
    enabled: false,
    redirectMode: "status-only"
  })
  assert.deepEqual(await getSettings(), {
    enabled: false,
    redirectMode: "status-only"
  })
})

test("getSettings ignores internal fallback bypass state", async () => {
  withBrowserStorage({
    enabled: false,
    redirectMode: "all",
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
    redirectMode: "all"
  })
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
