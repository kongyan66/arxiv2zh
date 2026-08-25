import { config } from "../../package.json";
import type { TaskManager } from "./taskManager";
import { isTerminalTask, type TranslationTask } from "./taskTypes";

const STATUS_LABELS: Record<TranslationTask["status"], string> = {
  "waiting-login": "等待登录",
  queued: "排队中",
  translating: "翻译中",
  downloading: "下载中",
  importing: "导入中",
  completed: "已完成",
  failed: "失败",
  stopped: "已停止",
};

function html<T extends HTMLElement>(doc: Document, tag: string): T {
  return doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    tag,
  ) as unknown as T;
}

export class TaskPanelController {
  private panel?: HTMLElement;
  private toolbarButton?: HTMLButtonElement;
  private badge?: HTMLElement;
  private unsubscribe?: () => void;
  private readonly keydownListener = (event: KeyboardEvent) => {
    if (event.key === "Escape" && this.panel && !this.panel.hidden) {
      this.toggle(false);
    }
  };

  constructor(
    private readonly win: _ZoteroTypes.MainWindow,
    private readonly manager: TaskManager,
  ) {}

  mount(): void {
    this.addStyleSheet();
    this.createPanel();
    this.createToolbarButton();
    this.win.document.addEventListener("keydown", this.keydownListener);
    this.unsubscribe = this.manager.subscribe(() => this.render());
    this.render();
  }

  toggle(force?: boolean): void {
    if (!this.panel) return;
    const open = force ?? this.panel.hidden;
    this.panel.hidden = !open;
    this.panel.setAttribute("aria-hidden", String(!open));
    this.toolbarButton?.setAttribute("aria-expanded", String(open));
  }

  destroy(): void {
    this.unsubscribe?.();
    this.win.document.removeEventListener("keydown", this.keydownListener);
    this.win.document
      .getElementById(`${config.addonRef}-toolbar-button`)
      ?.remove();
    this.panel?.remove();
    this.win.document.getElementById(`${config.addonRef}-stylesheet`)?.remove();
  }

  private addStyleSheet(): void {
    const doc = this.win.document;
    if (doc.getElementById(`${config.addonRef}-stylesheet`)) return;
    const link = html<HTMLLinkElement>(doc, "link");
    link.id = `${config.addonRef}-stylesheet`;
    link.setAttribute("rel", "stylesheet");
    link.setAttribute(
      "href",
      `chrome://${config.addonRef}/content/zoteroPane.css`,
    );
    doc.documentElement?.appendChild(link);
  }

  private createToolbarButton(): void {
    const doc = this.win.document;
    if (doc.getElementById(`${config.addonRef}-toolbar-button`)) return;
    const button = html<HTMLButtonElement>(doc, "button");
    button.id = `${config.addonRef}-toolbar-button`;
    button.className = "arxiv2zh-toolbar-button";
    button.type = "button";
    button.title = "arxiv2zh 翻译任务";
    button.setAttribute("aria-label", "打开 arxiv2zh 翻译任务");
    button.setAttribute("aria-expanded", "false");
    const mark = html<HTMLSpanElement>(doc, "span");
    mark.className = "arxiv2zh-toolbar-mark";
    mark.textContent = "译";
    const badge = html<HTMLSpanElement>(doc, "span");
    badge.className = "arxiv2zh-task-badge";
    this.badge = badge;
    this.toolbarButton = button;
    button.append(mark, badge);
    button.addEventListener("click", () => this.toggle());
    const itemToolbar = doc.getElementById("zotero-items-toolbar");
    const spacer = itemToolbar?.querySelector("spacer[flex='1']");
    if (itemToolbar && spacer) {
      itemToolbar.insertBefore(button, spacer);
    } else {
      (itemToolbar || doc.getElementById("zotero-toolbar"))?.appendChild(
        button,
      );
    }
  }

  private createPanel(): void {
    const doc = this.win.document;
    const panel = html<HTMLElement>(doc, "aside");
    panel.id = `${config.addonRef}-task-panel`;
    panel.className = "arxiv2zh-task-panel";
    panel.hidden = true;
    panel.setAttribute("aria-hidden", "true");
    const header = html<HTMLElement>(doc, "header");
    header.className = "arxiv2zh-panel-header";
    const closeButton = html<HTMLButtonElement>(doc, "button");
    closeButton.type = "button";
    closeButton.className = "arxiv2zh-icon-button";
    closeButton.dataset.action = "close";
    closeButton.title = "关闭翻译任务";
    closeButton.setAttribute("aria-label", "关闭翻译任务");
    closeButton.textContent = "×";
    closeButton.addEventListener("click", (event: Event) => {
      event.stopPropagation();
      this.toggle(false);
    });
    const titleGroup = html<HTMLDivElement>(doc, "div");
    const title = html<HTMLElement>(doc, "strong");
    title.textContent = "arxiv2zh";
    const subtitle = html<HTMLSpanElement>(doc, "span");
    subtitle.textContent = "翻译任务";
    titleGroup.append(title, subtitle);
    header.append(closeButton, titleGroup);

    const list = html<HTMLDivElement>(doc, "div");
    list.className = "arxiv2zh-task-list";
    list.setAttribute("role", "list");
    panel.append(header, list);
    doc.documentElement?.appendChild(panel);
    this.panel = panel;
  }

  private render(): void {
    const tasks = this.manager.getTasks();
    const active = tasks.filter((task) => !isTerminalTask(task.status)).length;
    if (this.badge) {
      this.badge.textContent = active > 99 ? "99+" : String(active);
      this.badge.hidden = active === 0;
    }
    const list = this.panel?.querySelector(".arxiv2zh-task-list");
    if (!list) return;
    list.replaceChildren();
    if (!tasks.length) {
      const empty = html<HTMLDivElement>(this.win.document, "div");
      empty.className = "arxiv2zh-empty";
      empty.textContent = "暂无翻译任务";
      list.appendChild(empty);
      return;
    }
    for (const task of tasks) list.appendChild(this.taskRow(task));
  }

  private taskRow(task: TranslationTask): HTMLElement {
    const doc = this.win.document;
    const row = html<HTMLElement>(doc, "article");
    row.className = `arxiv2zh-task arxiv2zh-status-${task.status}`;
    row.setAttribute("role", "listitem");

    const heading = html<HTMLDivElement>(doc, "div");
    heading.className = "arxiv2zh-task-heading";
    const id = html<HTMLElement>(doc, "strong");
    id.textContent = task.arxivId;
    const status = html<HTMLSpanElement>(doc, "span");
    status.textContent = STATUS_LABELS[task.status];
    heading.append(id, status);

    const title = html<HTMLDivElement>(doc, "div");
    title.className = "arxiv2zh-task-title";
    title.textContent = task.title || "正在读取论文信息";
    const detail = html<HTMLDivElement>(doc, "div");
    detail.className = "arxiv2zh-task-detail";
    detail.textContent = task.detail;
    const actions = html<HTMLDivElement>(doc, "div");
    actions.className = "arxiv2zh-task-actions";
    actions.appendChild(
      this.actionButton("网站", () => this.win.open(task.sourceURL, "_blank")),
    );
    if (task.status === "failed" || task.status === "stopped") {
      actions.appendChild(
        this.actionButton("重试", () => void this.manager.retry(task.id)),
      );
    } else if (!isTerminalTask(task.status)) {
      actions.appendChild(
        this.actionButton("停止", () => void this.manager.stop(task.id)),
      );
    }
    if (task.attachmentID) {
      actions.appendChild(
        this.actionButton("打开 PDF", () =>
          Zotero.Reader.open(task.attachmentID!),
        ),
      );
    }
    if (isTerminalTask(task.status)) {
      actions.appendChild(
        this.actionButton("移除", () => void this.manager.remove(task.id)),
      );
    }
    row.append(heading, title, detail, actions);
    return row;
  }

  private actionButton(label: string, action: () => void): HTMLButtonElement {
    const button = html<HTMLButtonElement>(this.win.document, "button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  }
}
