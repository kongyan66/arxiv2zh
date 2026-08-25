export type TaskStatus =
  | "waiting-login"
  | "queued"
  | "translating"
  | "downloading"
  | "importing"
  | "completed"
  | "failed"
  | "stopped";

export interface TranslationTask {
  id: string;
  dedupeKey: string;
  arxivId: string;
  baseArxivId: string;
  libraryID: number;
  targetItemID?: number;
  attachmentID?: number;
  title?: string;
  sourceURL: string;
  status: TaskStatus;
  detail: string;
  error?: string;
  attempts: number;
  forceDownload: boolean;
  batchID?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

const TERMINAL_STATES = new Set<TaskStatus>(["completed", "failed", "stopped"]);

export function isTerminalTask(status: TaskStatus): boolean {
  return TERMINAL_STATES.has(status);
}

export function taskDedupeKey(
  libraryID: number,
  targetItemID: number | undefined,
  baseArxivId: string,
): string {
  return `${libraryID}:${targetItemID ?? "new"}:${baseArxivId.toLowerCase()}`;
}

export function createTranslationTask(input: {
  arxivId: string;
  baseArxivId: string;
  libraryID: number;
  targetItemID?: number;
  sourceURL: string;
  forceDownload?: boolean;
  batchID?: string;
  now?: Date;
  random?: string;
}): TranslationTask {
  const now = input.now || new Date();
  const timestamp = now.toISOString();
  return {
    id: `${now.getTime()}-${input.random || Math.random().toString(36).slice(2, 10)}`,
    dedupeKey: taskDedupeKey(
      input.libraryID,
      input.targetItemID,
      input.baseArxivId,
    ),
    arxivId: input.arxivId,
    baseArxivId: input.baseArxivId,
    libraryID: input.libraryID,
    targetItemID: input.targetItemID,
    sourceURL: input.sourceURL,
    status: "queued",
    detail: "等待处理",
    attempts: 0,
    forceDownload: input.forceDownload === true,
    batchID: input.batchID,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateTask(
  task: TranslationTask,
  status: TaskStatus,
  detail: string,
  now = new Date(),
): TranslationTask {
  const timestamp = now.toISOString();
  return {
    ...task,
    status,
    detail,
    updatedAt: timestamp,
    startedAt: task.startedAt || (status !== "queued" ? timestamp : undefined),
    completedAt: isTerminalTask(status) ? timestamp : undefined,
  };
}
