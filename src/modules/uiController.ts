import { config } from "../../package.json";
import { resolveItemArxiv, TranslationWorkflow } from "./workflow";
import type { TaskManager } from "./taskManager";
import { TaskPanelController } from "./taskPanel";
import { isTerminalTask, type TranslationTask } from "./taskTypes";

interface LegacyMenuItem {
  label?: string;
  separator?: boolean;
  command?: () => void;
}

export class UIController {
  private readonly workflow: TranslationWorkflow;
  private readonly panels = new Map<Window, TaskPanelController>();
  private readonly menuIDs: string[] = [];
  private readonly legacyMenus: Element[] = [];
  private unsubscribe?: () => void;
  private lastNotifiedStatus = new Map<string, TranslationTask["status"]>();

  constructor(private readonly manager: TaskManager) {
    this.workflow = new TranslationWorkflow(manager);
  }

  mountWindow(win: _ZoteroTypes.MainWindow): void {
    if (this.panels.has(win)) return;
    const panel = new TaskPanelController(win, this.manager);
    panel.mount();
    this.panels.set(win, panel);
  }

  unmountWindow(win: Window): void {
    this.panels.get(win)?.destroy();
    this.panels.delete(win);
  }

  register(): void {
    this.registerMenus();
    this.unsubscribe = this.manager.subscribe((task) => this.notify(task));
  }

  destroy(): void {
    this.unsubscribe?.();
    for (const panel of this.panels.values()) panel.destroy();
    this.panels.clear();
    const menuManager = Reflect.get(Zotero, "MenuManager") as
      | typeof Zotero.MenuManager
      | undefined;
    for (const menuID of this.menuIDs) menuManager?.unregisterMenu(menuID);
    for (const menu of this.legacyMenus) menu.remove();
    this.menuIDs.length = 0;
    this.legacyMenus.length = 0;
  }

  showTasks(): void {
    const win = Zotero.getMainWindow();
    const panel = win && this.panels.get(win);
    panel?.toggle(true);
  }

  private registerMenus(): void {
    const menuManager = Reflect.get(Zotero, "MenuManager") as
      | typeof Zotero.MenuManager
      | undefined;
    if (!menuManager) {
      this.registerLegacyMenus();
      return;
    }
    const itemMenu = menuManager.registerMenu({
      menuID: `${config.addonRef}-item-menu`,
      pluginID: config.addonID,
      target: "main/library/item",
      menus: [
        {
          menuType: "submenu",
          l10nID: "arxiv2zh-menu-root",
          menus: [
            {
              menuType: "menuitem",
              l10nID: "arxiv2zh-menu-translate",
              onCommand: (_event, context) =>
                void this.workflow.submitItems(context.items || []),
            },
            {
              menuType: "menuitem",
              l10nID: "arxiv2zh-menu-redownload",
              onCommand: (_event, context) =>
                void this.workflow.submitItems(context.items || [], true),
            },
            {
              menuType: "menuitem",
              l10nID: "arxiv2zh-menu-view-site",
              onShowing: (_event, context) => {
                const item = context.items?.[0];
                context.setEnabled(Boolean(item && resolveItemArxiv(item)));
              },
              onCommand: (_event, context) => {
                const item = context.items?.[0];
                const identifier = item && resolveItemArxiv(item);
                if (!identifier) return;
                Zotero.getMainWindow()?.open(
                  `${this.serviceURL()}/arxiv/${encodeURIComponent(identifier.apiId)}`,
                  "_blank",
                );
              },
            },
          ],
        },
      ],
    });
    if (itemMenu) this.menuIDs.push(itemMenu);

    const toolsMenu = menuManager.registerMenu({
      menuID: `${config.addonRef}-tools-menu`,
      pluginID: config.addonID,
      target: "main/menubar/tools",
      menus: [
        {
          menuType: "submenu",
          l10nID: "arxiv2zh-menu-root",
          menus: [
            {
              menuType: "menuitem",
              l10nID: "arxiv2zh-menu-input",
              onCommand: () => this.workflow.openInput(),
            },
            {
              menuType: "menuitem",
              l10nID: "arxiv2zh-menu-tasks",
              onCommand: () => this.showTasks(),
            },
            { menuType: "separator" },
            {
              menuType: "menuitem",
              l10nID: "arxiv2zh-menu-account",
              onCommand: () => this.manager.openAccount(),
            },
            {
              menuType: "menuitem",
              l10nID: "arxiv2zh-menu-clear-session",
              onCommand: () => {
                const win = Zotero.getMainWindow();
                if (
                  win?.confirm(
                    "仅清除 hjfy.top 的登录 Cookie？之后需要重新登录。",
                  )
                ) {
                  this.manager.clearSession();
                }
              },
            },
          ],
        },
      ],
    });
    if (toolsMenu) this.menuIDs.push(toolsMenu);
  }

  private registerLegacyMenus(): void {
    const selected = () =>
      Zotero.getActiveZoteroPane()?.getSelectedItems() || [];
    const zh = Zotero.locale?.startsWith("zh");
    this.createLegacySubmenu("#zotero-itemmenu", [
      {
        label: zh ? "翻译为中文" : "Translate to Chinese",
        command: () => void this.workflow.submitItems(selected()),
      },
      {
        label: zh ? "重新下载中文 PDF" : "Re-download Chinese PDF",
        command: () => void this.workflow.submitItems(selected(), true),
      },
      {
        label: zh ? "在 hjfy.top 查看" : "View on hjfy.top",
        command: () => {
          const identifier = resolveItemArxiv(selected()[0]);
          if (!identifier) return;
          Zotero.getMainWindow()?.open(
            `${this.serviceURL()}/arxiv/${encodeURIComponent(identifier.apiId)}`,
            "_blank",
          );
        },
      },
    ]);
    this.createLegacySubmenu("#menu_ToolsPopup", [
      {
        label: zh ? "输入 arXiv 地址" : "Enter arXiv URL",
        command: () => this.workflow.openInput(),
      },
      {
        label: zh ? "翻译任务" : "Translation Tasks",
        command: () => this.showTasks(),
      },
      { separator: true },
      {
        label: zh ? "登录 / 账户" : "Sign In / Account",
        command: () => this.manager.openAccount(),
      },
      {
        label: zh ? "清除 hjfy.top 登录状态" : "Clear hjfy.top Session",
        command: () => {
          const win = Zotero.getMainWindow();
          if (
            win?.confirm(
              zh
                ? "仅清除 hjfy.top 的登录 Cookie？之后需要重新登录。"
                : "Clear only hjfy.top sign-in cookies? You will need to sign in again.",
            )
          ) {
            this.manager.clearSession();
          }
        },
      },
    ]);
  }

  private createLegacySubmenu(
    parentSelector: string,
    items: LegacyMenuItem[],
  ): void {
    const doc = Zotero.getMainWindow()?.document;
    const parent = doc?.querySelector(parentSelector);
    if (!doc || !parent) return;
    const menu = doc.createXULElement("menu");
    menu.setAttribute("label", config.addonName);
    const popup = doc.createXULElement("menupopup");
    for (const item of items) {
      if (item.separator) {
        popup.appendChild(doc.createXULElement("menuseparator"));
        continue;
      }
      const menuItem = doc.createXULElement("menuitem");
      menuItem.setAttribute("label", item.label || "");
      menuItem.addEventListener("command", () => item.command?.());
      popup.appendChild(menuItem);
    }
    menu.appendChild(popup);
    parent.appendChild(menu);
    this.legacyMenus.push(menu);
  }

  private serviceURL(): string {
    return String(
      Zotero.Prefs.get(`${config.prefsPrefix}.serviceURL`, true) ||
        "https://hjfy.top",
    ).replace(/\/+$/, "");
  }

  private notify(task: TranslationTask): void {
    if (this.lastNotifiedStatus.get(task.id) === task.status) return;
    this.lastNotifiedStatus.set(task.id, task.status);
    if (task.status !== "waiting-login" && !isTerminalTask(task.status)) return;
    const win = Zotero.getMainWindow();
    const popup = new Zotero.ProgressWindow({
      ...(win ? { window: win } : {}),
      closeOnClick: true,
    });
    popup.changeHeadline(config.addonName);
    const line = new popup.ItemProgress(
      `chrome://${config.addonRef}/content/icons/favicon.png`,
      `${task.arxivId} · ${task.detail}`,
    );
    if (task.status === "failed") line.setError();
    else line.setProgress(isTerminalTask(task.status) ? 100 : 35);
    popup.show();
    popup.startCloseTimer(task.status === "waiting-login" ? 8000 : 5000);
  }
}
