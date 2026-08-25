import assert from "node:assert/strict";
import test from "node:test";
import {
  createTranslationTask,
  isTerminalTask,
  taskDedupeKey,
  updateTask,
} from "../../src/modules/taskTypes.ts";

test("creates stable duplicate keys", () => {
  assert.equal(taskDedupeKey(1, 42, "2501.14787"), "1:42:2501.14787");
  assert.equal(
    taskDedupeKey(1, undefined, "HEP-TH/9901001"),
    "1:new:hep-th/9901001",
  );
});

test("creates and transitions tasks", () => {
  const created = createTranslationTask({
    arxivId: "2501.14787",
    baseArxivId: "2501.14787",
    libraryID: 1,
    targetItemID: 42,
    sourceURL: "https://arxiv.org/abs/2501.14787",
    now: new Date("2026-08-24T00:00:00Z"),
    random: "test",
  });
  assert.equal(created.status, "queued");
  const completed = updateTask(
    created,
    "completed",
    "done",
    new Date("2026-08-24T00:01:00Z"),
  );
  assert.equal(completed.completedAt, "2026-08-24T00:01:00.000Z");
  assert.equal(isTerminalTask(completed.status), true);
  assert.equal(isTerminalTask("translating"), false);
});
