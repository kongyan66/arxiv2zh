import type { ArxivIdentifier } from "./arxiv";

export type HjfyRemoteState =
  | "start"
  | "processing"
  | "finished"
  | "failed"
  | "error"
  | "fault";

export type HjfyStatus =
  | { kind: "login-required" }
  | { kind: "active"; state: "start" | "processing"; info: string }
  | {
      kind: "finished";
      state: "finished";
      info: string;
    }
  | {
      kind: "failed";
      state: "failed" | "error" | "fault";
      info: string;
    };

export interface HjfyInfo {
  atomXML: string;
  hasSource: boolean;
}

export interface HjfyFiles {
  id: string;
  title: string;
  originalURL: string;
  translatedURL: string;
  sourceArchiveURL?: string;
  isDeepSeek: boolean;
}

export interface HjfyTransport {
  getText(url: string): Promise<string>;
  getJSON(url: string): Promise<unknown>;
  getBytes(url: string): Promise<Uint8Array>;
}

export type HjfyErrorCode =
  | "invalid-base-url"
  | "invalid-response"
  | "remote-error"
  | "missing-source"
  | "download-failed";

export class HjfyError extends Error {
  readonly code: HjfyErrorCode;

  constructor(code: HjfyErrorCode, message: string) {
    super(message);
    this.name = "HjfyError";
    this.code = code;
  }
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseEnvelope(value: unknown): {
  status: number;
  data?: JsonRecord;
  message?: string;
} {
  if (!isRecord(value) || typeof value.status !== "number") {
    throw new HjfyError("invalid-response", "服务返回了无法识别的响应");
  }
  return {
    status: value.status,
    data: isRecord(value.data) ? value.data : undefined,
    message:
      typeof value.msg === "string"
        ? value.msg
        : typeof value.message === "string"
          ? value.message
          : undefined,
  };
}

export function normalizeServiceURL(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new HjfyError("invalid-base-url", "服务地址格式无效");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new HjfyError(
      "invalid-base-url",
      "服务地址必须使用 HTTPS；本机开发地址可以使用 HTTP",
    );
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function requiredString(
  data: JsonRecord | undefined,
  field: string,
  context: string,
): string {
  const value = data?.[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new HjfyError("invalid-response", `${context}响应缺少字段 ${field}`);
  }
  return value;
}

function endpointLabel(url: string): string {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).pop() || "请求";
  } catch {
    return "请求";
  }
}

export class HjfyClient {
  readonly baseURL: string;
  private readonly transport: HjfyTransport;

  constructor(baseURL: string, transport: HjfyTransport) {
    this.baseURL = normalizeServiceURL(baseURL);
    this.transport = transport;
  }

  private endpoint(path: string): string {
    return `${this.baseURL}${path}`;
  }

  async getArxivAtom(identifier: ArxivIdentifier): Promise<string> {
    const url = new URL("https://export.arxiv.org/api/query");
    url.searchParams.set("id_list", identifier.id);
    url.searchParams.set("max_results", "1");
    const atomXML = await this.transport.getText(url.toString());
    if (!atomXML.trim()) {
      throw new HjfyError("invalid-response", "arXiv 未返回论文元数据");
    }
    return atomXML;
  }

  async getInfo(identifier: ArxivIdentifier): Promise<HjfyInfo> {
    const raw = await this.transport.getJSON(
      this.endpoint(`/api/arxivInfo/${encodeURIComponent(identifier.apiId)}`),
    );
    const envelope = responseEnvelope(raw);
    if (envelope.status !== 0) {
      throw new HjfyError(
        "remote-error",
        envelope.message || "无法读取 arXiv 元数据",
      );
    }
    return {
      atomXML: requiredString(envelope.data, "meta", "arxivInfo"),
      hasSource: envelope.data?.hasSrc !== false,
    };
  }

  async getStatus(identifier: ArxivIdentifier): Promise<HjfyStatus> {
    const raw = await this.transport.getJSON(
      this.endpoint(`/api/arxivStatus/${encodeURIComponent(identifier.apiId)}`),
    );
    const envelope = responseEnvelope(raw);
    if (envelope.status === 101) return { kind: "login-required" };
    if (envelope.status !== 0 || !envelope.data) {
      throw new HjfyError(
        "remote-error",
        envelope.message || "无法读取翻译状态",
      );
    }

    const state = envelope.data.status;
    const info =
      typeof envelope.data.info === "string" ? envelope.data.info : "";
    if (state === "finished") {
      return { kind: "finished", state, info };
    }
    if (state === "failed" || state === "error" || state === "fault") {
      return { kind: "failed", state, info };
    }
    if (state === "start" || state === "processing") {
      return { kind: "active", state, info };
    }
    throw new HjfyError(
      "invalid-response",
      `无法识别的翻译状态: ${String(state)}`,
    );
  }

  async getFiles(identifier: ArxivIdentifier): Promise<HjfyFiles> {
    const raw = await this.transport.getJSON(
      this.endpoint(`/api/arxivFiles/${encodeURIComponent(identifier.apiId)}`),
    );
    const envelope = responseEnvelope(raw);
    if (envelope.status !== 0) {
      throw new HjfyError(
        "remote-error",
        envelope.message || "无法读取翻译结果",
      );
    }
    return {
      id: requiredString(envelope.data, "id", "arxivFiles"),
      title: requiredString(envelope.data, "title", "arxivFiles"),
      originalURL: requiredString(envelope.data, "origin", "arxivFiles"),
      translatedURL: requiredString(envelope.data, "zhCN", "arxivFiles"),
      sourceArchiveURL:
        typeof envelope.data?.zhCNTar === "string"
          ? envelope.data.zhCNTar
          : undefined,
      isDeepSeek: envelope.data?.isDeepSeek === true,
    };
  }

  async downloadTranslatedPDF(url: string): Promise<Uint8Array> {
    try {
      const bytes = await this.transport.getBytes(url);
      if (!bytes.byteLength) {
        throw new HjfyError("download-failed", "下载的 PDF 文件为空");
      }
      return bytes;
    } catch (error) {
      if (error instanceof HjfyError) throw error;
      throw new HjfyError("download-failed", "下载中文 PDF 失败");
    }
  }

  paperURL(identifier: ArxivIdentifier): string {
    return this.endpoint(`/arxiv/${encodeURIComponent(identifier.apiId)}`);
  }
}

export function createZoteroTransport(): HjfyTransport {
  async function request(
    url: string,
    responseType: "text" | "arraybuffer",
    timeout: number,
    code: HjfyErrorCode,
  ) {
    try {
      return await Zotero.HTTP.request("GET", url, {
        responseType,
        timeout,
        errorDelayIntervals: [1_000, 2_000, 5_000],
        errorDelayMax: 10_000,
      });
    } catch (error) {
      const statusMatch =
        error instanceof Error
          ? error.message.match(/status code (\d+)/i)
          : null;
      const detail = statusMatch
        ? `HTTP ${statusMatch[1]}`
        : error instanceof Error && /timed? out|timeout/i.test(error.message)
          ? "请求超时"
          : "网络请求失败";
      throw new HjfyError(code, `${endpointLabel(url)} ${detail}`);
    }
  }

  return {
    async getText(url) {
      const xhr = await request(url, "text", 30_000, "remote-error");
      return xhr.responseText || "";
    },
    async getJSON(url) {
      const xhr = await request(url, "text", 30_000, "remote-error");
      try {
        return JSON.parse(xhr.responseText || "");
      } catch {
        throw new HjfyError("invalid-response", "服务返回了无效 JSON");
      }
    },
    async getBytes(url) {
      const xhr = await request(url, "arraybuffer", 60_000, "download-failed");
      const response = xhr.response as unknown;
      if (!response || typeof response !== "object") {
        throw new HjfyError("download-failed", "服务未返回二进制 PDF");
      }
      if (ArrayBuffer.isView(response)) {
        return new Uint8Array(
          response.buffer,
          response.byteOffset,
          response.byteLength,
        ).slice();
      }
      if ("byteLength" in response && typeof response.byteLength === "number") {
        return new Uint8Array(response as ArrayBuffer);
      }
      throw new HjfyError("download-failed", "服务未返回二进制 PDF");
    },
  };
}
