import { parseArxivIdentifier, type ArxivIdentifier } from "./arxiv";
import { HjfyClient, HjfyError } from "./hjfyClient";
import { createPreprintItem, parseArxivAtom } from "./metadata";
import { ResultImporter } from "./resultImporter";
import { SessionManager } from "./sessionManager";
import { TaskStore } from "./taskStore";
import { debugLog } from "../utils/log";
import {
  createTranslationTask,
  isTerminalTask,
  updateTask,
  type TaskStatus,
  type TranslationTask,
} from "./taskTypes";

export interface TranslationRequest {
  identifier: ArxivIdentifier;
  libraryID: number;
  targetItemID?: number;
  forceDownload?: boolean;
  batchID?: string;
}

export type TaskListener = (
  task: TranslationTask,
  tasks: readonly TranslationTask[],
) => void;

interface TaskManagerOptions {
  getClient: () => HjfyClient;
  getPollIntervalSeconds: () => number;
  getHistoryRetentionDays: () => number;
  getOpenAfterSingle: () => boolean;
  store?: TaskStore;
  session?: SessionManager;
  importer?: ResultImporter;
}

export class TaskManager {
  private tasks: TranslationTask[] = [];
  private listeners: TaskListener[] = [];
  private running = new Set<string>();
  private alive = true;
  private readonly store: TaskStore;
  private readonly session: SessionManager;
  private readonly importer: ResultImporter;

  constructor(private readonly options: TaskManagerOptions) {
    this.store = options.store || new TaskStore();
    this.session = options.session || new SessionManager();
    this.importer = options.importer || new ResultImporter();
  }

  async initialize(): Promise<void> {
    const loaded = await this.store.load();
    this.tasks = this.store.prune(
      loaded,
      this.options.getHistoryRetentionDays(),
    );
    await this.persist();
    for (const task of this.tasks) {
      if (!isTerminalTask(task.status)) void this.run(task.id);
    }
  }

  getTasks(): readonly TranslationTask[] {
    return this.tasks;
  }

  subscribe(listener: TaskListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(
        (candidate) => candidate !== listener,
      );
    };
  }

  async submit(request: TranslationRequest): Promise<TranslationTask> {
    const draft = createTranslationTask({
      arxivId: request.identifier.id,
      baseArxivId: request.identifier.baseId,
      libraryID: request.libraryID,
      targetItemID: request.targetItemID,
      sourceURL: request.identifier.canonicalURL,
      forceDownload: request.forceDownload,
      batchID: request.batchID,
    });
    const duplicate = this.tasks.find(
      (task) =>
        task.dedupeKey === draft.dedupeKey && !isTerminalTask(task.status),
    );
    if (duplicate) return duplicate;

    if (request.targetItemID && !request.forceDownload) {
      const target = Zotero.Items.get(request.targetItemID);
      const existing = await this.importer.findExisting(
        target,
        request.identifier,
      );
      if (existing) {
        const completed = {
          ...updateTask(draft, "completed", "已有中文翻译附件"),
          attachmentID: existing.id,
        };
        this.tasks.unshift(completed);
        await this.persistAndEmit(completed);
        return completed;
      }
    }

    this.tasks.unshift(draft);
    await this.persistAndEmit(draft);
    void this.run(draft.id);
    return draft;
  }

  async retry(taskID: string): Promise<void> {
    const task = this.find(taskID);
    if (!task) return;
    this.replace({
      ...updateTask(task, "queued", "等待重试"),
      error: undefined,
      completedAt: undefined,
      attempts: 0,
    });
    await this.persistAndEmit(this.find(taskID)!);
    void this.run(taskID);
  }

  async stop(taskID: string): Promise<void> {
    const task = this.find(taskID);
    if (!task || isTerminalTask(task.status)) return;
    await this.transition(taskID, "stopped", "已停止本地轮询");
  }

  async remove(taskID: string): Promise<void> {
    const task = this.find(taskID);
    if (!task || !isTerminalTask(task.status)) return;
    this.tasks = this.tasks.filter((candidate) => candidate.id !== taskID);
    await this.persist();
    this.emit(task);
  }

  destroy(): void {
    this.alive = false;
    this.session.closeAll();
    this.listeners = [];
  }

  openAccount() {
    const client = this.options.getClient();
    return this.session.openAccount(client.baseURL);
  }

  clearSession(): void {
    const client = this.options.getClient();
    this.session.clearSession(new URL(client.baseURL).hostname);
  }

  private find(taskID: string): TranslationTask | undefined {
    return this.tasks.find((task) => task.id === taskID);
  }

  private replace(task: TranslationTask): void {
    this.tasks = this.tasks.map((candidate) =>
      candidate.id === task.id ? task : candidate,
    );
  }

  private async transition(
    taskID: string,
    status: TaskStatus,
    detail: string,
    changes: Partial<TranslationTask> = {},
  ): Promise<TranslationTask | undefined> {
    const current = this.find(taskID);
    if (!current) return undefined;
    const next = { ...updateTask(current, status, detail), ...changes };
    this.replace(next);
    await this.persistAndEmit(next);
    return next;
  }

  private async run(taskID: string): Promise<void> {
    if (this.running.has(taskID)) return;
    this.running.add(taskID);
    try {
      await this.process(taskID);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.transition(taskID, "failed", message, { error: message });
      const code = error instanceof HjfyError ? error.code : "unexpected";
      debugLog(`任务失败 ${taskID} (${code})`);
    } finally {
      this.running.delete(taskID);
    }
  }

  private async process(taskID: string): Promise<void> {
    let task = this.find(taskID);
    if (!task) return;
    const identifier = parseArxivIdentifier(task.arxivId);
    if (!identifier) throw new Error(`无效的 arXiv ID: ${task.arxivId}`);
    const client = this.options.getClient();

    const info = await this.getInfoWithFallback(client, identifier);
    if (!info.hasSource) throw new Error("这篇论文没有可供翻译的 LaTeX 源码");
    const metadata = parseArxivAtom(info.atomXML);
    task =
      (await this.transition(taskID, task.status, task.detail, {
        title: metadata.title,
      })) || task;

    const started = Date.now();
    let consecutiveErrors = 0;
    while (this.alive) {
      task = this.find(taskID);
      if (!task || isTerminalTask(task.status)) return;
      if (Date.now() - started > 30 * 60_000) {
        throw new Error("等待翻译超过 30 分钟，可稍后重试");
      }

      let status;
      try {
        status = await client.getStatus(identifier);
        consecutiveErrors = 0;
      } catch (error) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= 3) throw error;
        await this.transition(taskID, "translating", "网络波动，正在重试", {
          attempts: (this.find(taskID)?.attempts || 0) + 1,
        });
        await Zotero.Promise.delay(this.pollIntervalMilliseconds());
        continue;
      }

      if (status.kind === "login-required") {
        await this.transition(taskID, "waiting-login", "请在登录窗口完成登录");
        this.session.openForTask(client.paperURL(identifier));
      } else if (status.kind === "active") {
        this.session.closeTaskLogin();
        await this.transition(taskID, "translating", status.info || "翻译中");
      } else if (status.kind === "failed") {
        this.session.closeTaskLogin();
        throw new Error(status.info || `远端任务失败: ${status.state}`);
      } else {
        this.session.closeTaskLogin();
        await this.finish(taskID, identifier, metadata);
        return;
      }

      await Zotero.Promise.delay(this.pollIntervalMilliseconds());
    }
  }

  private async finish(
    taskID: string,
    identifier: ArxivIdentifier,
    metadata: ReturnType<typeof parseArxivAtom>,
  ): Promise<void> {
    let task = await this.transition(taskID, "downloading", "正在下载中文 PDF");
    if (!task) return;
    const client = this.options.getClient();
    const files = await client.getFiles(identifier);
    const bytes = await client.downloadTranslatedPDF(files.translatedURL);

    task = await this.transition(taskID, "importing", "正在导入 Zotero");
    if (!task) return;
    let targetItem: Zotero.Item;
    if (task.targetItemID) {
      targetItem = Zotero.Items.get(task.targetItemID);
    } else {
      targetItem = await createPreprintItem(
        metadata,
        identifier,
        task.libraryID,
      );
      task =
        (await this.transition(taskID, "importing", "已创建预印本条目", {
          targetItemID: targetItem.id,
        })) || task;
    }

    const attachment = await this.importer.importPDF({
      bytes,
      identifier,
      targetItem,
      forceDownload: task.forceDownload,
      openAfterImport:
        !task.batchID && this.options.getOpenAfterSingle() === true,
    });
    await this.transition(taskID, "completed", "中文 PDF 已添加到 Zotero", {
      attachmentID: attachment.id,
      title: files.title || task.title,
    });
  }

  private async getInfoWithFallback(
    client: HjfyClient,
    identifier: ArxivIdentifier,
  ) {
    try {
      return await client.getInfo(identifier);
    } catch (error) {
      if (!(error instanceof HjfyError)) throw error;
      debugLog(`hjfy arxivInfo 失败，改用 arXiv 元数据接口 (${error.code})`);
      return {
        atomXML: await client.getArxivAtom(identifier),
        hasSource: true,
      };
    }
  }

  private pollIntervalMilliseconds(): number {
    const seconds = this.options.getPollIntervalSeconds();
    return Math.max(5, Number.isFinite(seconds) ? seconds : 10) * 1000;
  }

  private async persistAndEmit(task: TranslationTask): Promise<void> {
    await this.persist();
    this.emit(task);
  }

  private async persist(): Promise<void> {
    await this.store.save(this.tasks);
  }

  private emit(task: TranslationTask): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(task, this.tasks);
      } catch (error) {
        const type = error instanceof Error ? error.name : typeof error;
        debugLog(`任务监听器异常 (${type})`);
      }
    }
  }
}
