import { assert } from "chai";
import { config } from "../package.json";
import { parseArxivIdentifier } from "../src/modules/arxiv";
import type { TaskManager } from "../src/modules/taskManager";
import { isTerminalTask } from "../src/modules/taskTypes";

interface TestAddon {
  data: {
    initialized: boolean;
    taskManager: TaskManager;
  };
}

async function waitForTerminalTask(
  manager: TaskManager,
  taskID: string,
  timeout = 120_000,
) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const task = manager
      .getTasks()
      .find((candidate) => candidate.id === taskID);
    if (task && isTerminalTask(task.status)) return task;
    await Zotero.Promise.delay(500);
  }
  throw new Error("等待 arxiv2zh 集成任务超时");
}

describe("arxiv2zh integration", function () {
  this.timeout(150_000);

  it("mounts the task UI", function () {
    const doc = Zotero.getMainWindow()?.document;
    const panel = doc?.getElementById("arxiv2zh-task-panel") as
      | HTMLElement
      | undefined;
    const toolbarButton = doc?.getElementById("arxiv2zh-toolbar-button") as
      | HTMLButtonElement
      | undefined;
    assert.exists(panel);
    assert.exists(toolbarButton);
    assert.equal(
      toolbarButton?.nextElementSibling?.localName,
      "spacer",
      "快捷图标应位于条目工具栏左侧按钮组末尾",
    );

    toolbarButton?.click();
    assert.isFalse(panel?.hidden, "点击快捷图标应打开任务面板");
    const closeButton = panel?.querySelector(
      '[data-action="close"]',
    ) as HTMLButtonElement | null;
    assert.exists(closeButton);
    closeButton?.click();
    assert.isTrue(panel?.hidden, "点击关闭按钮应收起任务面板");
  });

  it("opens hjfy.top in a persistent profile browser", async function () {
    const instance = Zotero[config.addonInstance] as unknown as TestAddon;
    const viewer = instance.data.taskManager.openAccount();
    const started = Date.now();
    let browser = viewer.document.querySelector("browser");
    let currentURL = "";
    while (Date.now() - started < 15_000) {
      browser = viewer.document.querySelector("browser");
      currentURL =
        (browser as (Element & { currentURI?: { spec?: string } }) | null)
          ?.currentURI?.spec || "";
      if (/^https:\/\/hjfy\.top\/?/.test(currentURL)) break;
      await Zotero.Promise.delay(50);
    }
    if (!browser) assert.fail("账户对话框缺少第一方内容浏览器");
    const type = browser.getAttribute("type");
    assert.strictEqual(type, "content", "账户浏览器类型错误");
    assert.match(
      currentURL,
      /^https:\/\/hjfy\.top\/?/,
      "账户浏览器未导航到 hjfy.top",
    );
    let contentTitle = "";
    let loading = true;
    while (Date.now() - started < 15_000) {
      const contentBrowser = browser as Element & {
        contentTitle?: string;
        webProgress?: { isLoadingDocument?: boolean };
      };
      contentTitle = contentBrowser.contentTitle?.trim() || "";
      loading = contentBrowser.webProgress?.isLoadingDocument === true;
      if (contentTitle && !loading) break;
      await Zotero.Promise.delay(100);
    }
    assert.isNotEmpty(contentTitle, "hjfy.top 文档加载后没有页面标题");
    assert.isFalse(loading, "hjfy.top 文档一直处于加载状态");
    viewer.close();
  });

  it("downloads and imports a completed hjfy translation", async function () {
    const instance = Zotero[config.addonInstance] as unknown as TestAddon;
    assert.isTrue(instance.data.initialized);
    const manager = instance.data.taskManager;
    const identifier = parseArxivIdentifier("2501.14787");
    assert.exists(identifier);
    Zotero.Prefs.set(`${config.prefsPrefix}.openAfterSingle`, false, true);

    const submitted = await manager.submit({
      identifier: identifier!,
      libraryID: Zotero.Libraries.userLibraryID,
      forceDownload: true,
    });
    const completed = await waitForTerminalTask(manager, submitted.id);
    assert.equal(
      completed.status,
      "completed",
      completed.error || completed.detail,
    );
    assert.isNumber(completed.targetItemID);
    assert.isNumber(completed.attachmentID);

    const parent = Zotero.Items.get(completed.targetItemID!);
    const attachment = Zotero.Items.get(completed.attachmentID!);
    assert.equal(parent.itemType, "preprint");
    assert.equal(attachment.parentID, parent.id);
    assert.match(String(attachment.attachmentFilename), /_zh_CN\.pdf$/);
    const path = await attachment.getFilePathAsync();
    assert.isString(path);
    assert.isTrue(await IOUtils.exists(path!));
  });
});
