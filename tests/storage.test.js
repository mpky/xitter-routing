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
