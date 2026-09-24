import assert from "node:assert/strict";
import test from "node:test";
import { parseArxivIdentifier } from "../../src/modules/arxiv.ts";
import {
  createZoteroTransport,
  encodePDFMultipart,
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

test("parses result files and preserves a non-empty title", async () => {
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
  assert.equal((await client.getFiles(identifier)).title, "Matrix Calculus");
  assert.equal(
    (await client.getFiles(identifier)).translatedURL,
    "https://files/translated.pdf",
  );
});

test("accepts an empty or missing result title", async () => {
  for (const title of ["", "   ", undefined]) {
    const data: Record<string, unknown> = {
      id: "2501.14787",
      origin: "https://files/original.pdf",
      zhCN: "https://files/translated.pdf",
    };
    if (title !== undefined) data.title = title;

    const files = await new HjfyClient(
      "https://hjfy.top",
      transport({ status: 0, data }),
    ).getFiles(identifier);
    assert.equal(files.title, "");
  }
});

test("rejects result files without a translated PDF URL", async () => {
  await assert.rejects(
    new HjfyClient(
      "https://hjfy.top",
      transport({
        status: 0,
        data: {
          id: "2501.14787",
          title: "Matrix Calculus",
          origin: "https://files/original.pdf",
        },
      }),
    ).getFiles(identifier),
    (error: unknown) =>
      error instanceof HjfyError &&
      error.code === "invalid-response" &&
      error.message === "arxivFiles响应缺少字段 zhCN",
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

test("accepts a missing metadata field when the service reports no source", async () => {
  for (const hasSrc of [false, 0, null]) {
    const client = new HjfyClient(
      "https://hjfy.top",
      transport({ status: 0, data: { hasSrc } }),
    );
    assert.deepEqual(await client.getInfo(identifier), {
      atomXML: "",
      hasSource: false,
    });
  }
});

test("uploads a PDF and follows file task endpoints", async () => {
  const requests: string[] = [];
  const client = new HjfyClient("https://hjfy.top", {
    async getText() {
      return "";
    },
    async getJSON(url) {
      requests.push(url);
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
      return new Uint8Array([1]);
    },
    async postPDF(url, fileName, bytes) {
      assert.equal(url, "https://hjfy.top/api/uploadFiles");
      assert.equal(fileName, "论文.pdf");
      assert.deepEqual(bytes, new Uint8Array([0, 255, 13, 10]));
      return { status: 0, data: { fileKey: "file-key" } };
    },
  });
  assert.deepEqual(
    await client.uploadPDF("论文.pdf", new Uint8Array([0, 255, 13, 10])),
    { kind: "file", id: "file-key" },
  );
  assert.equal((await client.getStatus("file-key", "file")).kind, "finished");
  const files = await client.getFiles("file-key", "file");
  assert.equal(files.id, "file-key");
  assert.equal(files.translatedURL, "https://files/translated.pdf");
  assert.deepEqual(requests, [
    "https://hjfy.top/api/fileStatus/file-key",
    "https://hjfy.top/api/fileFiles/file-key",
  ]);
  assert.equal(client.fileURL("file-key"), "https://hjfy.top/file/file-key");
});

test("handles upload login and arXiv deduplication responses", async () => {
  for (const [response, expected] of [
    [{ status: 101 }, { kind: "login-required" }],
    [
      { status: 302, arxivId: "2501.14787" },
      { kind: "arxiv", id: "2501.14787" },
    ],
  ] as const) {
    const client = new HjfyClient("https://hjfy.top", {
      ...transport({}),
      async postPDF() {
        return response;
      },
    });
    assert.deepEqual(
      await client.uploadPDF("paper.pdf", new Uint8Array([1])),
      expected,
    );
  }
});

test("multipart upload preserves binary bytes and UTF-8 file name", () => {
  const body = encodePDFMultipart(
    "论文.pdf",
    new Uint8Array([0, 255, 13, 10]),
    "test-boundary",
  );
  const binaryStart = body.indexOf(0);
  assert.deepEqual(
    Array.from(body.slice(binaryStart, binaryStart + 4)),
    [0, 255, 13, 10],
  );
  const decoder = new TextDecoder();
  assert.match(decoder.decode(body), /name="fileName"\r\n\r\n论文\.pdf/);
  assert.ok(body.indexOf(255) > 0);
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
