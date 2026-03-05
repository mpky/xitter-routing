import { getSettings, setSettings } from "./storage.js"
import { BUILD_INFO } from "./build-info.js"

const enabledInput = document.querySelector("#enabled")
const redirectModeInput = document.querySelector("#redirect-mode")
const statusNode = document.querySelector("#status")
const buildStampNode = document.querySelector("#build-stamp")

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

async function initialize() {
  renderBuildStamp()
  const settings = await getSettings()
  enabledInput.checked = settings.enabled
  redirectModeInput.value = settings.redirectMode
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

initialize().catch(() => {
  setStatus("Unable to load settings.")
})
