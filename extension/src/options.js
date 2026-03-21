import {
  clearDiagnosticLog,
  getDiagnosticLog,
  getSettings,
  setSettings
} from "./storage.js"
import { BUILD_INFO } from "./build-info.js"

const enabledInput = document.querySelector("#enabled")
const redirectModeInput = document.querySelector("#redirect-mode")
const statusNode = document.querySelector("#status")
const buildStampNode = document.querySelector("#build-stamp")
const diagnosticLogNode = document.querySelector("#diagnostic-log")
const refreshDiagnosticsButton = document.querySelector("#refresh-diagnostics")
const clearDiagnosticsButton = document.querySelector("#clear-diagnostics")

function setStatus(message) {
  statusNode.textContent = message
}

function renderBuildStamp() {
  if (!buildStampNode) {
    return
  }

  const manifestVersion = globalThis.chrome?.runtime?.getManifest?.().version ?? "unknown"
  const parsedGeneratedAt = Date.parse(BUILD_INFO.generatedAt)
  const generatedAtLabel = Number.isNaN(parsedGeneratedAt)
    ? BUILD_INFO.generatedAt
    : new Date(parsedGeneratedAt).toLocaleString()
  const dirtySuffix = BUILD_INFO.dirty ? " (uncommitted changes)" : ""

  buildStampNode.textContent = `Build ${manifestVersion} | commit ${BUILD_INFO.commit} on ${BUILD_INFO.branch}${dirtySuffix} | stamped ${generatedAtLabel}`
}

function formatDiagnosticEntry(entry) {
  const timestamp = Number.isFinite(entry.timestamp)
    ? new Date(entry.timestamp).toLocaleString()
    : "unknown time"
  const detailPairs = Object.entries(entry)
    .filter(([key]) => !["timestamp", "source", "action"].includes(key))
    .filter(([, value]) => value !== "" && value !== null && value !== undefined)
    .map(([key, value]) => `${key}: ${String(value)}`)

  return [
    `[${timestamp}] ${entry.source} -> ${entry.action}`,
    ...detailPairs
  ].join("\n")
}

async function renderDiagnosticLog() {
  if (!diagnosticLogNode) {
    return
  }

  const entries = await getDiagnosticLog()

  if (entries.length === 0) {
    diagnosticLogNode.textContent = "No diagnostic events yet."
    return
  }

  diagnosticLogNode.textContent = entries
    .slice()
    .reverse()
    .map((entry) => formatDiagnosticEntry(entry))
    .join("\n\n")
}

async function initialize() {
  renderBuildStamp()
  const settings = await getSettings()
  enabledInput.checked = settings.enabled
  redirectModeInput.value = settings.redirectMode
  await renderDiagnosticLog()
  setStatus("")
}

enabledInput.addEventListener("change", async (event) => {
  const enabled = event.currentTarget.checked
  await setSettings({ enabled })
  setStatus(enabled ? "Redirect enabled." : "Redirect disabled.")
})

redirectModeInput.addEventListener("change", async (event) => {
  const redirectMode = event.currentTarget.value
  await setSettings({ redirectMode })
  setStatus(
    redirectMode === "all"
      ? "Redirecting all X/Twitter URLs."
      : "Redirecting status links only."
  )
})

refreshDiagnosticsButton?.addEventListener("click", async () => {
  await renderDiagnosticLog()
  setStatus("Diagnostics refreshed.")
})

clearDiagnosticsButton?.addEventListener("click", async () => {
  await clearDiagnosticLog()
  await renderDiagnosticLog()
  setStatus("Diagnostics cleared.")
})

initialize().catch(() => {
  setStatus("Unable to load settings.")
})
