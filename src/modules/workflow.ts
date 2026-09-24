import { parseArxivIdentifier, resolveArxivIdentifier } from "./arxiv";
import { selectedLibraryID } from "./librarySelection";
import type { TaskManager } from "./taskManager";

function field(item: Zotero.Item, name: _ZoteroTypes.Item.ItemField): string {
  try {
    return String(item.getField(name) || "");
  } catch {
    return "";
  }
}

function parentItem(item: Zotero.Item): Zotero.Item | undefined {
  if (!item.isAttachment()) return item;
  return item.parentID ? Zotero.Items.get(item.parentID) : undefined;
}

function isSourcePDF(item: Zotero.Item): boolean {
  if (!item.isAttachment()) return false;
  const name = String(item.attachmentFilename || "");
  return (
    (item.attachmentContentType === "application/pdf" ||
      /\.pdf$/i.test(name)) &&
    !/_zh_cn\.pdf$/i.test(name) &&
    !/^(中文翻译|Chinese Translation) - arxiv2zh$/.test(field(item, "title"))
  );
}

async function sourcePDF(
  selected: Zotero.Item,
  target: Zotero.Item,
): Promise<Zotero.Item | undefined> {
  if (isSourcePDF(selected)) return selected;
  const attachments = await Zotero.Items.getAsync(target.getAttachments());
  return attachments.find(
    (attachment) => attachment && isSourcePDF(attachment),
  );
}

export function resolveItemArxiv(item: Zotero.Item) {
  const parent = parentItem(item);
  return resolveArxivIdentifier([
    parent && field(parent, "url"),
    parent && field(parent, "DOI"),
    parent && field(parent, "extra"),
    field(item, "url"),
    item.isAttachment() ? item.attachmentFilename : "",
  ]);
}

export class TranslationWorkflow {
  private readonly manager: TaskManager;

  constructor(manager: TaskManager) {
    this.manager = manager;
  }

  async submitItems(
    items: Zotero.Item[],
    forceDownload = false,
  ): Promise<void> {
    const batchID = items.length > 1 ? `batch-${Date.now()}` : undefined;
    let submitted = 0;
    for (const selected of items) {
      const target = parentItem(selected);
      if (!target || !target.isRegularItem()) continue;
      const identifier = resolveItemArxiv(selected);
      const pdf = await sourcePDF(selected, target);
      if (!identifier && !pdf) continue;
      await this.manager.submit({
        identifier: identifier || undefined,
        sourceAttachmentID: pdf?.id,
        libraryID: target.libraryID,
        targetItemID: target.id,
        forceDownload,
        batchID,
      });
      submitted += 1;
    }
    if (!submitted) this.openInput(items.length === 1 ? items[0] : undefined);
  }

  openInput(selected?: Zotero.Item): void {
    const win = Zotero.getMainWindow();
    const value = win?.prompt(
      "输入 arXiv 地址或 ID",
      "例如：https://arxiv.org/abs/2501.14787",
    );
    if (!value) return;
    const identifier = parseArxivIdentifier(value);
    if (!identifier) {
      win?.alert("无法识别该 arXiv 地址或 ID。");
      return;
    }
    const target = selected ? parentItem(selected) : this.selectedTarget();
    const libraryID =
      target?.libraryID || selectedLibraryID(Zotero.getActiveZoteroPane());
    if (!libraryID) {
      win?.alert("请先选择一个可写入的 Zotero 文库。");
      return;
    }
    void (async () => {
      const pdf = target?.isRegularItem()
        ? await sourcePDF(target, target)
        : undefined;
      await this.manager.submit({
        identifier,
        sourceAttachmentID: pdf?.id,
        libraryID,
        targetItemID: target?.isRegularItem() ? target.id : undefined,
      });
    })();
  }

  private selectedTarget(): Zotero.Item | undefined {
    const selected = Zotero.getActiveZoteroPane()?.getSelectedItems() || [];
    if (selected.length !== 1) return undefined;
    const target = parentItem(selected[0]);
    return target?.isRegularItem() ? target : undefined;
  }
}
