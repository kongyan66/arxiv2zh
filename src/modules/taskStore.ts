import type { TranslationTask } from "./taskTypes";
import { isTerminalTask } from "./taskTypes";
import { debugLog } from "../utils/log";

function isTask(value: unknown): value is TranslationTask {
  if (!value || typeof value !== "object") return false;
  const task = value as Partial<TranslationTask>;
  return (
    typeof task.id === "string" &&
    typeof task.dedupeKey === "string" &&
    typeof task.arxivId === "string" &&
    typeof task.baseArxivId === "string" &&
    typeof task.libraryID === "number" &&
    typeof task.status === "string" &&
    typeof task.createdAt === "string" &&
    typeof task.updatedAt === "string"
  );
}

export class TaskStore {
  readonly directory: string;
  readonly path: string;

  constructor(path?: string) {
    this.directory = PathUtils.join(Zotero.DataDirectory.dir, "arxiv2zh");
    this.path = path || PathUtils.join(this.directory, "tasks.json");
  }

  async load(): Promise<TranslationTask[]> {
    if (!(await IOUtils.exists(this.path))) return [];
    try {
      const value = await IOUtils.readJSON(this.path);
      return Array.isArray(value) ? value.filter(isTask) : [];
    } catch (error) {
      const type = error instanceof Error ? error.name : typeof error;
      debugLog(`读取任务记录失败 (${type})`);
      return [];
    }
  }

  async save(tasks: TranslationTask[]): Promise<void> {
    await IOUtils.makeDirectory(this.directory, {
      createAncestors: true,
      ignoreExisting: true,
    });
    await IOUtils.writeJSON(this.path, tasks, {
      tmpPath: `${this.path}.tmp`,
      flush: true,
    });
  }

  prune(tasks: TranslationTask[], retentionDays: number): TranslationTask[] {
    const cutoff = Date.now() - Math.max(1, retentionDays) * 86_400_000;
    return tasks.filter((task) => {
      if (!isTerminalTask(task.status)) return true;
      const timestamp = Date.parse(task.completedAt || task.updatedAt);
      return !Number.isFinite(timestamp) || timestamp >= cutoff;
    });
  }
}
