export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  redirectMode: "status-only"
});

const browserApi = globalThis.browser ?? null;
const chromeApi = globalThis.chrome ?? null;

function getStorageArea() {
  return browserApi?.storage?.local ?? chromeApi?.storage?.local ?? null;
}

export async function getSettings() {
  const storage = getStorageArea();

  if (!storage) {
    return { ...DEFAULT_SETTINGS };
  }

  if (browserApi?.storage?.local) {
    const result = await browserApi.storage.local.get(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS, ...result };
  }

  const result = await new Promise((resolve, reject) => {
    chromeApi.storage.local.get(DEFAULT_SETTINGS, (items) => {
      const error = chromeApi.runtime?.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(items);
    });
  });

  return { ...DEFAULT_SETTINGS, ...result };
}

export async function setSettings(nextSettings) {
  const storage = getStorageArea();

  if (!storage) {
    return;
  }

  const mergedSettings = {
    ...(await getSettings()),
    ...nextSettings
  };

  if (browserApi?.storage?.local) {
    await browserApi.storage.local.set(mergedSettings);
    return;
  }

  await new Promise((resolve, reject) => {
    chromeApi.storage.local.set(mergedSettings, () => {
      const error = chromeApi.runtime?.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}
