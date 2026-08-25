import assert from "node:assert/strict";
import test from "node:test";
import {
  parseArxivIdentifier,
  resolveArxivIdentifier,
} from "../../src/modules/arxiv.ts";

test("parses modern arXiv URLs and preserves versions", () => {
  assert.deepEqual(
    parseArxivIdentifier("https://arxiv.org/pdf/1706.03762v7.pdf?download=1"),
    {
      id: "1706.03762v7",
      baseId: "1706.03762",
      apiId: "1706.03762v7",
      version: 7,
      canonicalURL: "https://arxiv.org/abs/1706.03762v7",
    },
  );
});

test("parses legacy IDs and builds the hjfy route ID", () => {
  const parsed = parseArxivIdentifier("arXiv:hep-th/9901001v2");
  assert.equal(parsed?.id, "hep-th/9901001v2");
  assert.equal(parsed?.baseId, "hep-th/9901001");
  assert.equal(parsed?.apiId, "hep-th_9901001v2");
});

test("parses arXiv DOI and alphaXiv links", () => {
  assert.equal(
    parseArxivIdentifier("https://doi.org/10.48550/arXiv.2501.14787")?.id,
    "2501.14787",
  );
  assert.equal(
    parseArxivIdentifier("https://alphaxiv.org/abs/2503.06072")?.id,
    "2503.06072",
  );
});

test("resolves the first valid candidate and rejects unrelated text", () => {
  assert.equal(
    resolveArxivIdentifier(["", "not an id", "Extra: arXiv: 2412.05265"])?.id,
    "2412.05265",
  );
  assert.equal(parseArxivIdentifier("Attention is all you need"), null);
});
