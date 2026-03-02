import { getSettings, setSettings } from "./storage.js";

const enabledInput = document.querySelector("#enabled");
const redirectModeInput = document.querySelector("#redirect-mode");
const statusNode = document.querySelector("#status");

function setStatus(message) {
  statusNode.textContent = message;
}

async function initialize() {
  const settings = await getSettings();
  enabledInput.checked = settings.enabled;
  redirectModeInput.value = settings.redirectMode;
  setStatus("");
}

enabledInput.addEventListener("change", async (event) => {
  const enabled = event.currentTarget.checked;
  await setSettings({ enabled });
  setStatus(enabled ? "Redirect enabled." : "Redirect disabled.");
});

redirectModeInput.addEventListener("change", async (event) => {
  const redirectMode = event.currentTarget.value;
  await setSettings({ redirectMode });
  setStatus(
    redirectMode === "all"
      ? "Redirecting all X/Twitter URLs."
      : "Redirecting status links only."
  );
});

initialize().catch(() => {
  setStatus("Unable to load settings.");
});
