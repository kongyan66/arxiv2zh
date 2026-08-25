import type { ArxivIdentifier } from "./arxiv";
import { debugLog } from "../utils/log";

export interface ArxivMetadata {
  title: string;
  abstract: string;
  published: string;
  updated?: string;
  authors: string[];
  categories: string[];
  canonicalURL: string;
  doi?: string;
}

function text(node: Element | null): string {
  return (node?.textContent || "").replace(/\s+/g, " ").trim();
}

function firstElement(parent: Element, tagName: string): Element | null {
  return parent.getElementsByTagName(tagName)[0] || null;
}

export function parseArxivAtom(atomXML: string): ArxivMetadata {
  const document = new DOMParser().parseFromString(atomXML, "application/xml");
  if (document.getElementsByTagName("parsererror").length) {
    throw new Error("arXiv 元数据 XML 无法解析");
  }
  const entry = document.getElementsByTagName("entry")[0];
  if (!entry) throw new Error("arXiv 元数据中没有论文条目");

  const title = text(firstElement(entry, "title"));
  if (!title) throw new Error("arXiv 元数据缺少标题");

  const links = Array.from(entry.getElementsByTagName("link")) as Element[];
  const canonicalURL =
    links
      .find((link) => link.getAttribute("rel") === "alternate")
      ?.getAttribute("href") || "";
  const doiNode =
    entry.getElementsByTagName("arxiv:doi")[0] ||
    entry.getElementsByTagNameNS("http://arxiv.org/schemas/atom", "doi")[0];

  return {
    title,
    abstract: text(firstElement(entry, "summary")),
    published: text(firstElement(entry, "published")),
    updated: text(firstElement(entry, "updated")) || undefined,
    authors: (Array.from(entry.getElementsByTagName("author")) as Element[])
      .map((author) => text(firstElement(author, "name")))
      .filter(Boolean),
    categories: (
      Array.from(entry.getElementsByTagName("category")) as Element[]
    )
      .map((category) => category.getAttribute("term") || "")
      .filter(Boolean),
    canonicalURL,
    doi: text(doiNode) || undefined,
  };
}

function setSupportedField(
  item: Zotero.Item,
  field: _ZoteroTypes.Item.ItemField,
  value: string | undefined,
): void {
  if (!value) return;
  try {
    item.setField(field, value);
  } catch (error) {
    const type = error instanceof Error ? error.name : typeof error;
    debugLog(`当前 Zotero 版本不支持预印本字段 ${field} (${type})`);
  }
}

export async function createPreprintItem(
  metadata: ArxivMetadata,
  identifier: ArxivIdentifier,
  libraryID: number,
): Promise<Zotero.Item> {
  const item = new Zotero.Item("preprint");
  item.libraryID = libraryID;
  setSupportedField(item, "title", metadata.title);
  setSupportedField(item, "abstractNote", metadata.abstract);
  setSupportedField(item, "date", metadata.published.slice(0, 10));
  setSupportedField(
    item,
    "url",
    metadata.canonicalURL || identifier.canonicalURL,
  );
  setSupportedField(item, "repository", "arXiv");
  setSupportedField(item, "archiveID", identifier.id);
  setSupportedField(item, "DOI", metadata.doi);
  setSupportedField(item, "extra", `arXiv: ${identifier.id}`);
  item.setCreators(
    metadata.authors.map((author) => {
      const creator = Zotero.Utilities.cleanAuthor(author, "author", false);
      return {
        firstName: creator.firstName,
        lastName: creator.lastName,
        creatorType: "author",
      };
    }),
  );
  for (const category of metadata.categories) item.addTag(category);
  await item.saveTx();
  return item;
}
