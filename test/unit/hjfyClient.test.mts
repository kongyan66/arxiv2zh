import assert from "node:assert/strict";
import test from "node:test";
import { parseArxivIdentifier } from "../../src/modules/arxiv.ts";
import {
  createZoteroTransport,
  HjfyClient,
  HjfyError,
  normalizeServiceURL,
  type HjfyTransport,
} from "../../src/modules/hjfyClient.ts";

const identifier = parseArxivIdentifier("2501.14787")!;

function transport(json: unknown): HjfyTransport {
  return {
    async getText() {
      return "";
    },
    async getJSON() {
      return json;
    },
    async getBytes() {
      return new Uint8Array([1]);
    },
  };
}

test("normalizes secure and local service URLs", () => {
  assert.equal(normalizeServiceURL("https://hjfy.top/"), "https://hjfy.top");
  assert.equal(
    normalizeServiceURL("http://127.0.0.1:8890/"),
    "http://127.0.0.1:8890",
  );
  assert.throws(() => normalizeServiceURL("http://example.com"), HjfyError);
});

test("maps login, active, finished, and failed statuses", async () => {
  assert.deepEqual(
    await new HjfyClient(
      "https://hjfy.top",
      transport({ status: 101 }),
    ).getStatus(identifier),
    { kind: "login-required" },
  );
  assert.equal(
    (
      await new HjfyClient(
        "https://hjfy.top",
        transport({ status: 0, data: { status: "processing", info: "x" } }),
      ).getStatus(identifier)
    ).kind,
    "active",
  );
  assert.equal(
    (
      await new HjfyClient(
        "https://hjfy.top",
        transport({ status: 0, data: { status: "finished" } }),
      ).getStatus(identifier)
    ).kind,
    "finished",
  );
  assert.equal(
    (
      await new HjfyClient(
        "https://hjfy.top",
        transport({ status: 0, data: { status: "fault" } }),
      ).getStatus(identifier)
    ).kind,
    "failed",
  );
});

test("validates result fields", async () => {
  const client = new HjfyClient(
    "https://hjfy.top",
    transport({
      status: 0,
      data: {
        id: "2501.14787",
        title: "Matrix Calculus",
        origin: "https://files/original.pdf",
        zhCN: "https://files/translated.pdf",
        zhCNTar: "https://files/source.tgz",
        isDeepSeek: false,
      },
    }),
  );
  assert.equal(
    (await client.getFiles(identifier)).translatedURL,
    "https://files/translated.pdf",
  );

  await assert.rejects(
    new HjfyClient(
      "https://hjfy.top",
      transport({ status: 0, data: { id: "2501.14787" } }),
    ).getFiles(identifier),
    (error: unknown) =>
      error instanceof HjfyError && error.code === "invalid-response",
  );
});

test("fetches arXiv Atom metadata from the public arXiv API", async () => {
  let requested = "";
  const client = new HjfyClient("https://hjfy.top", {
    async getText(url) {
      requested = url;
      return "<feed><entry><title>Example</title></entry></feed>";
    },
    async getJSON() {
      throw new Error("not used");
    },
    async getBytes() {
      throw new Error("not used");
    },
  });

  assert.match(await client.getArxivAtom(identifier), /<entry>/);
  const url = new URL(requested);
  assert.equal(url.origin, "https://export.arxiv.org");
  assert.equal(url.pathname, "/api/query");
  assert.equal(url.searchParams.get("id_list"), identifier.id);
  assert.equal(url.searchParams.get("max_results"), "1");
});

test("wraps Zotero HTTP failures in user-facing errors", async () => {
  const previous = (globalThis as { Zotero?: unknown }).Zotero;
  (globalThis as { Zotero?: unknown }).Zotero = {
    HTTP: {
      async request() {
        throw new Error(
          'HTTP GET failed with status code 500: {"status":500,"msg":"internal"}',
        );
      },
    },
  };

  try {
    await assert.rejects(
      createZoteroTransport().getJSON("https://hjfy.top/api/arxivInfo/x"),
      (error: unknown) =>
        error instanceof HjfyError &&
        error.code === "remote-error" &&
        error.message === "x HTTP 500",
    );
  } finally {
    (globalThis as { Zotero?: unknown }).Zotero = previous;
  }
});
