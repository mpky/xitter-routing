export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  redirectMode: "status-only"
})

export const FALLBACK_BYPASS_STORAGE_KEY = "fallbackBypasses"
export const FALLBACK_BYPASS_TTL_MS = 60_000
export const DIAGNOSTIC_LOG_STORAGE_KEY = "diagnosticLog"
export const MAX_DIAGNOSTIC_LOG_ENTRIES = 50

const browserApi = globalThis.browser ?? null
const chromeApi = globalThis.chrome ?? null

function getStorageArea() {
  return browserApi?.storage?.local ?? chromeApi?.storage?.local ?? null
}

async function getStorageItems(defaults = {}) {
  const storage = getStorageArea();

  if (!storage) {
    return { ...defaults }
  }

  if (browserApi?.storage?.local) {
    return browserApi.storage.local.get(defaults)
  }

  const result = await new Promise((resolve, reject) => {
    chromeApi.storage.local.get(defaults, (items) => {
      const error = chromeApi.runtime?.lastError

      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(items)
    })
  })

  return result
}

async function setStorageItems(nextItems) {
  const storage = getStorageArea();

  if (!storage) {
    return
  }

  if (browserApi?.storage?.local) {
    await browserApi.storage.local.set(nextItems)
    return
  }

  await new Promise((resolve, reject) => {
    chromeApi.storage.local.set(nextItems, () => {
      const error = chromeApi.runtime?.lastError

      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve()
    })
  })
}

function normalizeTrackedUrl(url) {
  if (typeof url !== "string" || url.trim() === "") {
    return null
  }

  try {
    const parsedUrl = new URL(url)
    parsedUrl.protocol = "https:"
    parsedUrl.port = ""
    return parsedUrl.toString()
  } catch {
    return null
  }
}

function normalizeDiagnosticValue(value) {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()

  if (trimmed === "") {
    return ""
  }

  return trimmed.slice(0, 400)
}

function normalizeDiagnosticEntry(entry, fallbackTimestamp = Date.now()) {
  if (!entry || typeof entry !== "object") {
    return null
  }

  const timestamp = Number.isFinite(entry.timestamp)
    ? entry.timestamp
    : fallbackTimestamp
  const source = normalizeDiagnosticValue(entry.source)
  const action = normalizeDiagnosticValue(entry.action)

  if (typeof source !== "string" || source === "") {
    return null
  }

  if (typeof action !== "string" || action === "") {
    return null
  }

  const normalizedEntry = {
    timestamp,
    source,
    action
  }

  for (const [key, value] of Object.entries(entry)) {
    if (key === "timestamp" || key === "source" || key === "action") {
      continue
    }

    const normalizedValue = normalizeDiagnosticValue(value)

    if (normalizedValue !== undefined) {
      normalizedEntry[key] = normalizedValue
    }
  }

  return normalizedEntry
}

function getStoredDiagnosticLog(records) {
  if (!Array.isArray(records)) {
    return []
  }

  return records
    .map((record) => normalizeDiagnosticEntry(record))
    .filter(Boolean)
    .slice(-MAX_DIAGNOSTIC_LOG_ENTRIES)
}

function getActiveFallbackBypasses(records, now = Date.now()) {
  if (!Array.isArray(records)) {
    return []
  }

  const dedupedRecords = new Map()

  for (const record of records) {
    const normalizedUrl = normalizeTrackedUrl(record?.url)
    const expiresAt = record?.expiresAt

    if (!normalizedUrl || !Number.isFinite(expiresAt) || expiresAt <= now) {
      continue
    }

    dedupedRecords.set(normalizedUrl, {
      expiresAt,
      url: normalizedUrl
    })
  }

  return [...dedupedRecords.values()]
}

async function storeActiveFallbackBypasses(records, now = Date.now()) {
  const activeBypasses = getActiveFallbackBypasses(records, now)
  await setStorageItems({
    [FALLBACK_BYPASS_STORAGE_KEY]: activeBypasses
  })
  return activeBypasses
}

export async function getSettings() {
  const result = await getStorageItems(DEFAULT_SETTINGS)

  return {
    enabled: result.enabled ?? DEFAULT_SETTINGS.enabled,
    redirectMode: result.redirectMode ?? DEFAULT_SETTINGS.redirectMode
  }
}

export async function setSettings(nextSettings) {
  const mergedSettings = {
    ...(await getSettings()),
    ...nextSettings
  }

  await setStorageItems(mergedSettings)
}

export async function registerFallbackBypass(url, now = Date.now()) {
  const normalizedUrl = normalizeTrackedUrl(url)

  if (!normalizedUrl) {
    return false
  }

  const storedItems = await getStorageItems({
    [FALLBACK_BYPASS_STORAGE_KEY]: []
  })
  const activeBypasses = getActiveFallbackBypasses(
    storedItems[FALLBACK_BYPASS_STORAGE_KEY],
    now
  ).filter((record) => record.url !== normalizedUrl)

  activeBypasses.push({
    expiresAt: now + FALLBACK_BYPASS_TTL_MS,
    url: normalizedUrl
  })

  await setStorageItems({
    [FALLBACK_BYPASS_STORAGE_KEY]: activeBypasses
  })
  return true
}

export async function hasFallbackBypass(url, now = Date.now()) {
  const normalizedUrl = normalizeTrackedUrl(url)

  if (!normalizedUrl) {
    return false
  }

  const storedItems = await getStorageItems({
    [FALLBACK_BYPASS_STORAGE_KEY]: []
  })
  const activeBypasses = await storeActiveFallbackBypasses(
    storedItems[FALLBACK_BYPASS_STORAGE_KEY],
    now
  )

  return activeBypasses.some((record) => record.url === normalizedUrl)
}

export async function clearFallbackBypass(url, now = Date.now()) {
  const normalizedUrl = normalizeTrackedUrl(url)
  const storedItems = await getStorageItems({
    [FALLBACK_BYPASS_STORAGE_KEY]: []
  })
  const remainingBypasses = getActiveFallbackBypasses(
    storedItems[FALLBACK_BYPASS_STORAGE_KEY],
    now
  ).filter((record) => record.url !== normalizedUrl)

  await setStorageItems({
    [FALLBACK_BYPASS_STORAGE_KEY]: remainingBypasses
  })

  return true
}

export async function getDiagnosticLog() {
  const storedItems = await getStorageItems({
    [DIAGNOSTIC_LOG_STORAGE_KEY]: []
  })

  return getStoredDiagnosticLog(storedItems[DIAGNOSTIC_LOG_STORAGE_KEY])
}

export async function appendDiagnosticLog(entry, now = Date.now()) {
  const normalizedEntry = normalizeDiagnosticEntry(entry, now)

  if (!normalizedEntry) {
    return false
  }

  const currentLog = await getDiagnosticLog()
  const nextLog = [...currentLog, normalizedEntry].slice(-MAX_DIAGNOSTIC_LOG_ENTRIES)

  await setStorageItems({
    [DIAGNOSTIC_LOG_STORAGE_KEY]: nextLog
  })

  return true
}

export async function clearDiagnosticLog() {
  await setStorageItems({
    [DIAGNOSTIC_LOG_STORAGE_KEY]: []
  })

  return true
}
