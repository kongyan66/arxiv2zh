function containsBytes(
  bytes: Uint8Array,
  needle: readonly number[],
  start: number,
  end: number,
): boolean {
  const first = Math.max(0, start);
  const last = Math.min(bytes.length, end) - needle.length;
  for (let i = first; i <= last; i++) {
    let matched = true;
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

export function validatePDFBytes(bytes: Uint8Array, fileName: string): void {
  if (!bytes.byteLength) throw new Error(`下载文件为空: ${fileName}`);
  const hasHeader = containsBytes(
    bytes,
    [0x25, 0x50, 0x44, 0x46, 0x2d],
    0,
    Math.min(bytes.length, 1024),
  );
  const hasEOF = containsBytes(
    bytes,
    [0x25, 0x25, 0x45, 0x4f, 0x46],
    Math.max(0, bytes.length - 65_536),
    bytes.length,
  );
  if (!hasHeader || !hasEOF) {
    throw new Error(`下载内容不是完整 PDF: ${fileName}`);
  }
}
