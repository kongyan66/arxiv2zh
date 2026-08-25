import assert from "node:assert/strict";
import test from "node:test";
import { validatePDFBytes } from "../../src/modules/pdf.ts";

const encoder = new TextEncoder();

test("accepts a complete PDF with harmless surrounding bytes", () => {
  assert.doesNotThrow(() =>
    validatePDFBytes(
      encoder.encode("prefix\n%PDF-1.7\nbody\n%%EOF\ntrailer"),
      "paper.pdf",
    ),
  );
});

test("rejects empty, HTML, and truncated downloads", () => {
  assert.throws(() => validatePDFBytes(new Uint8Array(), "empty.pdf"));
  assert.throws(() =>
    validatePDFBytes(encoder.encode("<html>expired</html>"), "expired.pdf"),
  );
  assert.throws(() =>
    validatePDFBytes(encoder.encode("%PDF-1.7\ntruncated"), "truncated.pdf"),
  );
});
