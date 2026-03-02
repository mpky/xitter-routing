import { rewriteUrl } from "./shared/rewriter.js";
import { DEFAULT_SETTINGS, getSettings, setSettings } from "./storage.js";

const extensionApi = globalThis.browser ?? globalThis.chrome;
const browserApi = globalThis.browser ?? null;
const chromeApi = globalThis.chrome ?? null;
const pendingRedirects = new Map();
const MENU_OPEN_LINK = "open-link-via-xcancel";
const MENU_OPEN_PAGE = "open-page-via-xcancel";

function updateTab(tabId, updateProperties) {
  if (browserApi?.tabs?.update) {
    return browserApi.tabs.update(tabId, updateProperties);
  }

  return new Promise((resolve, reject) => {
    chromeApi.tabs.update(tabId, updateProperties, () => {
      const error = chromeApi.runtime?.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

function createTab(createProperties) {
  if (browserApi?.tabs?.create) {
    return browserApi.tabs.create(createProperties);
  }

  return new Promise((resolve, reject) => {
    chromeApi.tabs.create(createProperties, (tab) => {
      const error = chromeApi.runtime?.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(tab);
    });
  });
}

function getMenusApi() {
  return browserApi?.menus ?? browserApi?.contextMenus ?? chromeApi?.contextMenus ?? null;
}

function removeAllMenus(menusApi) {
  if (!menusApi?.removeAll) {
    return Promise.resolve();
  }

  if (browserApi?.menus || browserApi?.contextMenus) {
    return menusApi.removeAll();
  }

  return new Promise((resolve, reject) => {
    menusApi.removeAll(() => {
      const error = chromeApi.runtime?.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

function createMenu(menusApi, createProperties) {
  if (browserApi?.menus || browserApi?.contextMenus) {
    menusApi.create(createProperties);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    menusApi.create(createProperties, () => {
      const error = chromeApi.runtime?.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

async function shouldRedirect(url) {
  const settings = await getSettings();

  if (!settings.enabled) {
    return null;
  }

  return rewriteUrl(url, { redirectMode: settings.redirectMode });
}

async function redirectTab(tabId, url) {
  const rewrittenUrl = await shouldRedirect(url);

  if (!rewrittenUrl || rewrittenUrl === url) {
    return false;
  }

  const pendingUrl = pendingRedirects.get(tabId);

  if (pendingUrl === url) {
    pendingRedirects.delete(tabId);
    return false;
  }

  pendingRedirects.set(tabId, rewrittenUrl);

  try {
    await updateTab(tabId, { url: rewrittenUrl });
    return true;
  } catch {
    pendingRedirects.delete(tabId);
    return false;
  }
}

async function openLinkInNewTab(tab, linkUrl) {
  const rewrittenUrl = await shouldRedirect(linkUrl);

  if (!rewrittenUrl || rewrittenUrl === linkUrl) {
    return false;
  }

  const createProperties = {
    url: rewrittenUrl
  };

  if (typeof tab?.id === "number") {
    createProperties.openerTabId = tab.id;
  }

  if (typeof tab?.index === "number") {
    createProperties.index = tab.index + 1;
  }

  await createTab(createProperties);
  return true;
}

async function handleNavigation(details) {
  if (details.frameId !== 0 || details.tabId < 0 || typeof details.url !== "string") {
    return;
  }

  const pendingUrl = pendingRedirects.get(details.tabId);

  if (pendingUrl === details.url) {
    pendingRedirects.delete(details.tabId);
    return;
  }

  await redirectTab(details.tabId, details.url);
}

async function createContextMenus() {
  const menusApi = getMenusApi();

  if (!menusApi) {
    return;
  }

  await removeAllMenus(menusApi);
  await createMenu(menusApi, {
    id: MENU_OPEN_LINK,
    title: "Open link via xcancel",
    contexts: ["link"]
  });
  await createMenu(menusApi, {
    id: MENU_OPEN_PAGE,
    title: "Open page via xcancel",
    contexts: ["page"]
  });
}

async function handleMenuClick(info, tab) {
  if (info.menuItemId === MENU_OPEN_LINK && typeof info.linkUrl === "string") {
    await openLinkInNewTab(tab, info.linkUrl);
    return;
  }

  if (info.menuItemId === MENU_OPEN_PAGE && typeof tab?.id === "number" && typeof tab.url === "string") {
    await redirectTab(tab.id, tab.url);
  }
}

extensionApi.runtime.onInstalled.addListener(async () => {
  const currentSettings = await getSettings();
  await setSettings({ ...DEFAULT_SETTINGS, ...currentSettings });
  await createContextMenus();
});

extensionApi.runtime.onStartup?.addListener(() => {
  createContextMenus().catch(() => {});
});

extensionApi.webNavigation.onBeforeNavigate.addListener((details) => {
  handleNavigation(details).catch(() => {
    pendingRedirects.delete(details.tabId);
  });
});

extensionApi.tabs.onRemoved.addListener((tabId) => {
  pendingRedirects.delete(tabId);
});

extensionApi.action?.onClicked?.addListener((tab) => {
  if (typeof tab?.id !== "number" || typeof tab.url !== "string") {
    return;
  }

  redirectTab(tab.id, tab.url).catch(() => {
    pendingRedirects.delete(tab.id);
  });
});

const menusApi = getMenusApi();

menusApi?.onClicked?.addListener((info, tab) => {
  handleMenuClick(info, tab).catch(() => {});
});
