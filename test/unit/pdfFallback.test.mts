import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { parseArxivIdentifier } from "../../src/modules/arxiv.ts";
import { HjfyClient } from "../../src/modules/hjfyClient.ts";
import { createTranslationTask } from "../../src/modules/taskTypes.ts";
import type { TaskManager as TaskManagerType } from "../../src/modules/taskManager.ts";

async function bundledModule(entryPoint: string): Promise<string> {
  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
  });
  return `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`;
}

const { TaskManager } = (await import(
  await bundledModule("src/modules/taskManager.ts")
)) as typeof import("../../src/modules/taskManager.ts");
const { TranslationWorkflow } = (await import(
  await bundledModule("src/modules/workflow.ts")
)) as typeof import("../../src/modules/workflow.ts");

const pdf = new TextEncoder().encode("%PDF-1.7\nbody\n%%EOF");

async function waitForCompletion(manager: TaskManagerType, taskID: string) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const task = manager
      .getTasks()
      .find((candidate) => candidate.id === taskID);
    if (task?.status === "completed" || task?.status === "failed") return task;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("mock PDF translation did not complete");
}

for (const scenario of [
  { name: "an item has no arXiv ID", arxiv: false, redirect: false },
  { name: "arXiv has no source", arxiv: true, redirect: false },
  {
    name: "the service identifies an uploaded PDF as arXiv",
    arxiv: false,
    redirect: true,
  },
]) {
  test(`uses PDF upload when ${scenario.name}`, async () => {
    const oldZotero = (globalThis as { Zotero?: unknown }).Zotero;
    const oldIOUtils = (globalThis as { IOUtils?: unknown }).IOUtils;
    const source = {
      id: 2,
      attachmentFilename: "source.pdf",
      attachmentContentType: "application/pdf",
      isAttachment: () => true,
      getField: () => "",
      getFilePathAsync: async () => "/mock/source.pdf",
    };
    const target = {
      id: 1,
      libraryID: 1,
      isAttachment: () => false,
      isRegularItem: () => true,
      getAttachments: () => [2],
      getField: () => "",
    };
    (globalThis as { Zotero?: unknown }).Zotero = {
      Items: {
        get: (id: number) => (id === 1 ? target : source),
        getAsync: async () => [source],
      },
      Promise: { delay: async () => {} },
    };
    (globalThis as { IOUtils?: unknown }).IOUtils = {
      exists: async () => true,
      stat: async () => ({ size: pdf.byteLength }),
      read: async () => pdf,
    };

    const requests: string[] = [];
    const client = new HjfyClient("https://hjfy.top", {
      async getText() {
        return "";
      },
      async getJSON(url) {
        requests.push(url);
        if (url.includes("arxivInfo")) {
          return { status: 0, data: { hasSrc: false } };
        }
        if (url.includes("Status")) {
          return { status: 0, data: { status: "finished" } };
        }
        return {
          status: 0,
          data: {
            id: "file-key",
            origin: "https://files/original.pdf",
            zhCN: "https://files/translated.pdf",
          },
        };
      },
      async getBytes() {
        return pdf;
      },
      async postPDF(_url, name, bytes) {
        assert.equal(name, "source.pdf");
        assert.deepEqual(bytes, pdf);
        return scenario.redirect
          ? { status: 302, arxivId: "2501.14787" }
          : { status: 0, data: { fileKey: "file-key" } };
      },
    });
    const imported: string[] = [];
    const manager = new TaskManager({
      getClient: () => client,
      getPollIntervalSeconds: () => 5,
      getHistoryRetentionDays: () => 7,
      getOpenAfterSingle: () => false,
      store: { save: async () => {} } as never,
      session: { closeTaskLogin: () => {}, closeAll: () => {} } as never,
      importer: {
        findExisting: async () => undefined,
        importPDF: async (options: { sourceFileName?: string }) => {
          imported.push(options.sourceFileName || "");
          return { id: 3 };
        },
      } as never,
    });
    try {
      if (!scenario.arxiv) {
        const submitted: unknown[] = [];
        const workflow = new TranslationWorkflow({
          submit: async (request: unknown) => {
            submitted.push(request);
          },
        } as never);
        await workflow.submitItems([target as never]);
        assert.equal(submitted.length, 1);
        assert.equal(
          (submitted[0] as { sourceAttachmentID: number }).sourceAttachmentID,
          2,
        );
        assert.equal(
          (submitted[0] as { identifier?: unknown }).identifier,
          undefined,
        );
      }
      const task = await manager.submit({
        identifier: scenario.arxiv
          ? parseArxivIdentifier("2501.14787")!
          : undefined,
        sourceAttachmentID: 2,
        targetItemID: 1,
        libraryID: 1,
      });
      const completed = await waitForCompletion(manager, task.id);
      assert.equal(completed?.status, "completed", completed?.error);
      assert.equal(completed.remoteKind, scenario.redirect ? "arxiv" : "file");
      assert.equal(
        completed.remoteID,
        scenario.redirect ? "2501.14787" : "file-key",
      );
      assert.deepEqual(imported, ["source.pdf"]);
      const remote = scenario.redirect ? "arxiv" : "file";
      const remoteID = scenario.redirect ? "2501.14787" : "file-key";
      assert.ok(
        requests.some((url) =>
          url.endsWith(`/api/${remote}Status/${remoteID}`),
        ),
      );
      assert.ok(
        requests.some((url) => url.endsWith(`/api/${remote}Files/${remoteID}`)),
      );
      assert.equal(
        requests.some((url) => url.includes("arxivInfo")),
        scenario.arxiv,
      );
    } finally {
      manager.destroy();
      (globalThis as { Zotero?: unknown }).Zotero = oldZotero;
      (globalThis as { IOUtils?: unknown }).IOUtils = oldIOUtils;
    }
  });
}

test("resumes an uploaded document without rereading a removed source attachment", async () => {
  const oldZotero = (globalThis as { Zotero?: unknown }).Zotero;
  (globalThis as { Zotero?: unknown }).Zotero = {
    Items: {
      get: (id: number) => (id === 1 ? { id: 1, libraryID: 1 } : undefined),
    },
    Promise: { delay: async () => {} },
  };
  const savedTask = {
    ...createTranslationTask({
      arxivId: "",
      baseArxivId: "",
      libraryID: 1,
      targetItemID: 1,
      sourceAttachmentID: 2,
      sourceFileName: "source.pdf",
      sourceURL: "https://hjfy.top/file/file-key",
      mode: "file",
    }),
    remoteID: "file-key",
    remoteKind: "file" as const,
    status: "translating" as const,
  };
  const client = new HjfyClient("https://hjfy.top", {
    async getText() {
      return "";
    },
    async getJSON(url) {
      if (url.includes("fileStatus")) {
        return { status: 0, data: { status: "finished" } };
      }
      return {
        status: 0,
        data: {
          origin: "https://files/original.pdf",
          zhCN: "https://files/translated.pdf",
        },
      };
    },
    async getBytes() {
      return pdf;
    },
    async postPDF() {
      throw new Error("must not upload again");
    },
  });
  const manager = new TaskManager({
    getClient: () => client,
    getPollIntervalSeconds: () => 5,
    getHistoryRetentionDays: () => 7,
    getOpenAfterSingle: () => false,
    store: {
      load: async () => [savedTask],
      prune: (tasks: unknown) => tasks,
      save: async () => {},
    } as never,
    session: { closeTaskLogin: () => {}, closeAll: () => {} } as never,
    importer: {
      importPDF: async (options: { sourceFileName?: string }) => {
        assert.equal(options.sourceFileName, "source.pdf");
        return { id: 3 };
      },
    } as never,
  });
  try {
    await manager.initialize();
    const completed = await waitForCompletion(manager, savedTask.id);
    assert.equal(completed?.status, "completed", completed?.error);
  } finally {
    manager.destroy();
    (globalThis as { Zotero?: unknown }).Zotero = oldZotero;
  }
});
