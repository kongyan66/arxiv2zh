import type { ArxivIdentifier } from "./arxiv";
import { validatePDFBytes } from "./pdf";

const TITLE_ZH = "中文翻译 - arxiv2zh";
const TITLE_EN = "Chinese Translation - arxiv2zh";

function attachmentTitle(): string {
  return Zotero.locale?.startsWith("zh") ? TITLE_ZH : TITLE_EN;
}

export function translatedFileName(identifier: ArxivIdentifier): string {
  const id = identifier.id.replace(/[/\\]/g, "_");
  return Array.from(`${id}_zh_CN.pdf`)
    .map((character) =>
      character.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(character)
        ? "_"
        : character,
    )
    .join("")
    .replace(/[. ]+(?=\.pdf$)/i, "");
}

export class ResultImporter {
  async findExisting(
    targetItem: Zotero.Item,
    identifier: ArxivIdentifier,
  ): Promise<Zotero.Item | undefined> {
    const expectedBase = identifier.baseId.replace(/[/\\]/g, "_").toLowerCase();
    const attachments = await Zotero.Items.getAsync(
      targetItem.getAttachments(),
    );
    return attachments.find((attachment) => {
      if (!attachment?.isAttachment()) return false;
      const title = String(attachment.getField("title") || "");
      const fileName = String(
        attachment.attachmentFilename || "",
      ).toLowerCase();
      return (
        (title === TITLE_ZH || title === TITLE_EN) &&
        fileName.startsWith(expectedBase) &&
        fileName.endsWith("_zh_cn.pdf")
      );
    });
  }

  async importPDF(options: {
    bytes: Uint8Array;
    identifier: ArxivIdentifier;
    targetItem: Zotero.Item;
    forceDownload: boolean;
    openAfterImport: boolean;
  }): Promise<Zotero.Item> {
    const { bytes, identifier, targetItem, forceDownload, openAfterImport } =
      options;
    const fileName = translatedFileName(identifier);
    validatePDFBytes(bytes, fileName);

    const existing = await this.findExisting(targetItem, identifier);
    if (existing && !forceDownload) return existing;

    if (existing && forceDownload) {
      const renameResult = await existing.renameAttachmentFile(
        fileName,
        true,
        false,
      );
      if (renameResult === -2 || renameResult === false) {
        throw new Error("无法更新已有中文翻译附件的文件名");
      }
      const existingPath = await existing.getFilePathAsync();
      if (!existingPath) throw new Error("已有中文翻译附件缺少本地文件");
      await IOUtils.write(existingPath, bytes, {
        tmpPath: `${existingPath}.arxiv2zh.tmp`,
        flush: true,
      });
      existing.setField("title", attachmentTitle());
      await existing.saveTx();
      if (openAfterImport) Zotero.Reader.open(existing.id);
      return existing;
    }

    const tempName = `arxiv2zh-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}.pdf`;
    const tempPath = PathUtils.join(PathUtils.tempDir, tempName);
    await IOUtils.write(tempPath, bytes, { flush: true });
    try {
      const attachment = await Zotero.Attachments.importFromFile({
        file: tempPath,
        parentItemID: targetItem.id,
        libraryID: targetItem.libraryID,
        fileBaseName: fileName.replace(/\.pdf$/i, ""),
        title: attachmentTitle(),
        contentType: "application/pdf",
      });
      if (!attachment?.id) throw new Error("Zotero 未能创建中文 PDF 附件");
      if (openAfterImport) Zotero.Reader.open(attachment.id);
      return attachment;
    } finally {
      if (await IOUtils.exists(tempPath)) await IOUtils.remove(tempPath);
    }
  }
}
