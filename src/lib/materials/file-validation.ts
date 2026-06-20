import { createHash } from "node:crypto";
import path from "node:path";

export const DEFAULT_FILE_MAX_BYTES = 20 * 1024 * 1024;
export const DEFAULT_MATERIAL_MAX_FILES = 50;

const MIME_SIGNATURES: Array<{
  mimeType: string;
  matches: (bytes: Uint8Array) => boolean;
}> = [
  { mimeType: "application/pdf", matches: (bytes) => Buffer.from(bytes.subarray(0, 5)).toString() === "%PDF-" },
  { mimeType: "image/jpeg", matches: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { mimeType: "image/png", matches: (bytes) => Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  { mimeType: "image/webp", matches: (bytes) => Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP" },
  { mimeType: "image/tiff", matches: (bytes) => Buffer.from(bytes.subarray(0, 4)).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) || Buffer.from(bytes.subarray(0, 4)).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a])) },
];

export function getFileLimits() {
  return {
    maxBytes: Number(process.env.FILE_MAX_BYTES) || DEFAULT_FILE_MAX_BYTES,
    maxFiles: Number(process.env.MATERIAL_MAX_FILES) || DEFAULT_MATERIAL_MAX_FILES,
  };
}

export function sanitizeFilename(filename: string) {
  const basename = path.basename(filename).replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, "-").trim();
  return (basename || "未命名文件").slice(0, 180);
}

export function validateFileBytes(input: {
  bytes: Uint8Array;
  declaredMimeType: string;
  filename: string;
}) {
  const { maxBytes } = getFileLimits();
  if (input.bytes.byteLength === 0) throw new Error("文件不能为空");
  if (input.bytes.byteLength > maxBytes) throw new Error(`文件不能超过 ${maxBytes} 字节`);

  const signature = MIME_SIGNATURES.find((candidate) => candidate.matches(input.bytes));
  if (!signature) throw new Error("不支持或无法识别的文件类型");
  if (signature.mimeType !== input.declaredMimeType) throw new Error("文件内容与声明类型不一致");

  return {
    originalName: sanitizeFilename(input.filename),
    mimeType: signature.mimeType,
    byteSize: input.bytes.byteLength,
    contentHash: createHash("sha256").update(input.bytes).digest("hex"),
  };
}
