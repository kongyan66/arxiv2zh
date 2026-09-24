import { parseArxivIdentifier, type ArxivIdentifier } from "./arxiv";
import { HjfyClient, HjfyError } from "./hjfyClient";
import { createPreprintItem, parseArxivAtom } from "./metadata";
import { validatePDFBytes } from "./pdf";
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
  identifier?: ArxivIdentifier;
  sourceAttachmentID?: number;
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
  private readonly options: TaskManagerOptions;
  private tasks: TranslationTask[] = [];
  private listeners: TaskListener[] = [];
  private running = new Set<string>();
  private alive = true;
  private readonly store: TaskStore;
  private readonly session: SessionManager;
  private readonly importer: ResultImporter;

  constructor(options: TaskManagerOptions) {
    this.options = options;
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
    if (
      !request.identifier &&
      (!request.sourceAttachmentID || !request.targetItemID)
    ) {
      throw new Error("本地文档翻译需要 Zotero 条目及其 PDF 附件");
    }
    const sourceAttachment = request.sourceAttachmentID
      ? Zotero.Items.get(request.sourceAttachmentID)
      : undefined;
    const sourceFileName = String(
      sourceAttachment?.attachmentFilename || "document.pdf",
    );
    const targetTitle = request.targetItemID
      ? String(Zotero.Items.get(request.targetItemID)?.getField("title") || "")
      : "";
    const draft = createTranslationTask({
      arxivId: request.identifier?.id || "",
      baseArxivId: request.identifier?.baseId || "",
      libraryID: request.libraryID,
      targetItemID: request.targetItemID,
      sourceURL:
        request.identifier?.canonicalURL || this.options.getClient().baseURL,
      mode: request.identifier ? "arxiv" : "file",
      sourceAttachmentID: request.sourceAttachmentID,
      sourceFileName: request.sourceAttachmentID ? sourceFileName : undefined,
      forceDownload: request.forceDownload,
      batchID: request.batchID,
    });
    if (targetTitle || !request.identifier) {
      draft.title = targetTitle || sourceFileName;
    }
    if (!request.identifier) {
      draft.detail = "等待上传 PDF";
    }
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
        request.identifier ? undefined : sourceFileName,
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
    const client = this.options.getClient();
    if (task.mode === "file") {
      await this.processFile(taskID, client);
      return;
    }
    const identifier = parseArxivIdentifier(task.arxivId);
    if (!identifier) throw new Error(`无效的 arXiv ID: ${task.arxivId}`);

    const info = await this.getInfoWithFallback(client, identifier);
    if (!info.hasSource) {
      if (!task.sourceAttachmentID) {
        throw new Error(
          "arXiv 未提供 LaTeX 源码；请先给条目添加原始 PDF 附件，再重试",
        );
      }
      await this.transition(taskID, "queued", "无 LaTeX 源码，改用 PDF 上传", {
        mode: "file",
      });
      await this.processFile(taskID, client);
      return;
    }
    const metadata = parseArxivAtom(info.atomXML);
    task =
      (await this.transition(taskID, task.status, task.detail, {
        title: metadata.title,
      })) || task;

    await this.poll(taskID, client, "arxiv", identifier.apiId, metadata);
  }

  private async processFile(taskID: string, client: HjfyClient): Promise<void> {
    let task = this.find(taskID);
    if (!task?.targetItemID) throw new Error("PDF 上传任务缺少目标条目");

    const uploadStarted = Date.now();
    while (!task.remoteID && this.alive) {
      if (isTerminalTask(task.status)) return;
      if (Date.now() - uploadStarted > 30 * 60_000) {
        throw new Error("等待 PDF 上传超过 30 分钟，可稍后重试");
      }
      const source = task.sourceAttachmentID
        ? Zotero.Items.get(task.sourceAttachmentID)
        : undefined;
      const originalName = String(source?.attachmentFilename || "");
      const storedName = task.sourceFileName || originalName;
      const fileName = /\.pdf$/i.test(storedName)
        ? storedName
        : `${storedName || "document"}.pdf`;
      if (
        !source?.isAttachment() ||
        (source.attachmentContentType !== "application/pdf" &&
          !/\.pdf$/i.test(originalName))
      ) {
        throw new Error("原始 PDF 附件已不存在或格式不正确");
      }
      const path = await source.getFilePathAsync();
      if (!path || !(await IOUtils.exists(path))) {
        throw new Error("原始 PDF 文件未保存在本机，请先下载 Zotero 附件");
      }
      const fileInfo = await IOUtils.stat(path);
      if (!fileInfo) throw new Error("无法读取原始 PDF 文件大小");
      if (
        typeof fileInfo.size === "number" &&
        fileInfo.size > 50 * 1024 * 1024
      ) {
        throw new Error("PDF 超过网页服务 50MB 的上传限制");
      }
      const bytes = await IOUtils.read(path);
      if (bytes.byteLength > 50 * 1024 * 1024) {
        throw new Error("PDF 超过网页服务 50MB 的上传限制");
      }
      validatePDFBytes(bytes, fileName);
      await this.transition(taskID, "translating", "正在上传原始 PDF");
      const uploaded = await client.uploadPDF(fileName, bytes);
      if (isTerminalTask(this.find(taskID)?.status || "queued")) return;
      if (uploaded.kind === "login-required") {
        await this.transition(taskID, "waiting-login", "请登录后上传 PDF");
        this.session.openForTask(client.baseURL);
        await Zotero.Promise.delay(this.pollIntervalMilliseconds());
        task = this.find(taskID);
        if (!task) return;
        continue;
      }
      this.session.closeTaskLogin();
      const redirected =
        uploaded.kind === "arxiv"
          ? parseArxivIdentifier(uploaded.id.replace("_", "/"))
          : undefined;
      if (uploaded.kind === "arxiv" && !redirected) {
        throw new Error("服务返回了无法识别的 arXiv ID");
      }
      task = (await this.transition(
        taskID,
        "translating",
        "PDF 已上传，等待翻译",
        {
          remoteKind: uploaded.kind,
          remoteID: redirected?.apiId || uploaded.id,
          sourceURL:
            uploaded.kind === "file"
              ? client.fileURL(uploaded.id)
              : client.paperURL(redirected!),
        },
      ))!;
    }
    if (!task?.remoteID) return;
    await this.poll(taskID, client, task.remoteKind || "file", task.remoteID);
  }

  private async poll(
    taskID: string,
    client: HjfyClient,
    kind: "arxiv" | "file",
    remoteID: string,
    metadata?: ReturnType<typeof parseArxivAtom>,
  ): Promise<void> {
    const started = Date.now();
    let consecutiveErrors = 0;
    while (this.alive) {
      const task = this.find(taskID);
      if (!task || isTerminalTask(task.status)) return;
      if (Date.now() - started > 30 * 60_000) {
        throw new Error("等待翻译超过 30 分钟，可稍后重试");
      }

      let status;
      try {
        status = await client.getStatus(remoteID, kind);
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
        this.session.openForTask(
          kind === "file"
            ? client.fileURL(remoteID)
            : client.paperURL(parseArxivIdentifier(remoteID)!),
        );
      } else if (status.kind === "active") {
        this.session.closeTaskLogin();
        await this.transition(taskID, "translating", status.info || "翻译中");
      } else if (status.kind === "failed") {
        this.session.closeTaskLogin();
        throw new Error(status.info || `远端任务失败: ${status.state}`);
      } else {
        this.session.closeTaskLogin();
        await this.finish(taskID, client, kind, remoteID, metadata);
        return;
      }

      await Zotero.Promise.delay(this.pollIntervalMilliseconds());
    }
  }

  private async finish(
    taskID: string,
    client: HjfyClient,
    kind: "arxiv" | "file",
    remoteID: string,
    metadata?: ReturnType<typeof parseArxivAtom>,
  ): Promise<void> {
    let task = await this.transition(taskID, "downloading", "正在下载中文 PDF");
    if (!task) return;
    const files = await client.getFiles(remoteID, kind);
    const bytes = await client.downloadTranslatedPDF(files.translatedURL);

    task = await this.transition(taskID, "importing", "正在导入 Zotero");
    if (!task) return;
    let targetItem: Zotero.Item;
    if (task.targetItemID) {
      targetItem = Zotero.Items.get(task.targetItemID);
    } else {
      const identifier = parseArxivIdentifier(task.arxivId);
      if (!identifier || !metadata)
        throw new Error("创建预印本条目缺少 arXiv 元数据");
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

    const identifier =
      task.mode === "file"
        ? undefined
        : parseArxivIdentifier(task.arxivId) || undefined;
    const sourceFileName =
      task.sourceFileName ||
      (task.sourceAttachmentID
        ? String(
            Zotero.Items.get(task.sourceAttachmentID)?.attachmentFilename ||
              "document.pdf",
          )
        : undefined);

    const attachment = await this.importer.importPDF({
      bytes,
      identifier,
      sourceFileName: identifier ? undefined : sourceFileName,
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
