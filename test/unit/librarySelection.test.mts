import assert from "node:assert/strict";
import test from "node:test";
import { selectedLibraryID } from "../../src/modules/librarySelection.ts";

test("uses the Zotero 10 plural library selection API", () => {
  assert.equal(
    selectedLibraryID({
      getSelectedLibraryIDs: () => [7],
      getSelectedLibraryID: () => {
        throw new Error("legacy API should not be called");
      },
    }),
    7,
  );
});

test("does not infer a library from multiple selected Zotero 10 rows", () => {
  assert.equal(
    selectedLibraryID({
      getSelectedLibraryIDs: () => [1, 2],
      getSelectedLibraryID: () => 1,
    }),
    undefined,
  );
});

test("falls back to the legacy single library API", () => {
  assert.equal(selectedLibraryID({ getSelectedLibraryID: () => 3 }), 3);
});
