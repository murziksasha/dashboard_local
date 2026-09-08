const INLINE_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/bmp",
]);

const DANGEROUS_INLINE = new Set([
  "image/svg+xml",
  "text/html",
  "application/xhtml+xml",
  "text/xml",
  "application/xml",
  "image/svg",
]);

export function normalizeMime(raw: string | null | undefined): string {
  const mime = (raw || "application/octet-stream").split(";")[0]!.trim().toLowerCase();
  return mime || "application/octet-stream";
}

export function isSafeInlineImage(mime: string, filename?: string): boolean {
  const m = normalizeMime(mime);
  if (DANGEROUS_INLINE.has(m)) return false;
  if (filename && /\.(svg|html?|xhtml|xml)$/i.test(filename)) return false;
  return INLINE_IMAGE_MIMES.has(m);
}

export function contentTypeForDownload(mime: string, inline: boolean): string {
  const m = normalizeMime(mime);
  if (inline && isSafeInlineImage(m)) return m;
  if (DANGEROUS_INLINE.has(m) || m === "text/html") return "application/octet-stream";
  return m;
}
