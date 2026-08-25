import { config } from "../package.json";
import { HjfyClient, createZoteroTransport } from "./modules/hjfyClient";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { TaskManager } from "./modules/taskManager";
import { UIController } from "./modules/uiController";
import { debugLog } from "./utils/log";
import { getPref } from "./utils/prefs";

async function onStartup(): Promise<void> {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);
  await Zotero.PreferencePanes.register({
    pluginID: config.addonID,
    id: `${config.addonRef}-preferences`,
    src: rootURI + "content/preferences.xhtml",
    label: config.addonName,
    image: `chrome://${config.addonRef}/content/icons/arxiv2zh.svg`,
  });

  const manager = new TaskManager({
    getClient: () =>
      new HjfyClient(String(getPref("serviceURL")), createZoteroTransport()),
    getPollIntervalSeconds: () => Number(getPref("pollInterval")),
    getHistoryRetentionDays: () => Number(getPref("historyRetentionDays")),
    getOpenAfterSingle: () => Boolean(getPref("openAfterSingle")),
  });
  addon.data.taskManager = manager;
  await manager.initialize();

  const ui = new UIController(manager);
  addon.data.ui = ui;
  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );
  ui.register();
  addon.data.initialized = true;
  debugLog("插件已启动");
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  win.MozXULElement.insertFTLIfNeeded(`${config.addonRef}-mainWindow.ftl`);
  addon.data.ui?.mountWindow(win);
}

async function onMainWindowUnload(win: Window): Promise<void> {
  addon.data.ui?.unmountWindow(win);
}

function onShutdown(): void {
  addon.data.ui?.destroy();
  addon.data.taskManager?.destroy();
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[config.addonInstance];
}

async function onPrefsEvent(type: string, data: { window: Window }) {
  if (type === "load") await registerPrefsScripts(data.window);
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onPrefsEvent,
};
