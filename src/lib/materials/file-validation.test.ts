import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeFilename, validateFileBytes } from "./file-validation";

const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

test("validates signatures and returns normalized metadata", () => {
  const result = validateFileBytes({ bytes: png, declaredMimeType: "image/png", filename: "../族谱?.png" });
  assert.equal(result.mimeType, "image/png");
  assert.equal(result.originalName, "族谱-.png");
  assert.equal(result.contentHash.length, 64);
});

test("rejects empty, unsupported, and mismatched files", () => {
  assert.throws(() => validateFileBytes({ bytes: new Uint8Array(), declaredMimeType: "image/png", filename: "a.png" }));
  assert.throws(() => validateFileBytes({ bytes: Uint8Array.from([1, 2, 3]), declaredMimeType: "image/png", filename: "a.png" }));
  assert.throws(() => validateFileBytes({ bytes: png, declaredMimeType: "image/jpeg", filename: "a.jpg" }));
});

test("sanitizes unsafe display names", () => {
  assert.equal(sanitizeFilename("C:\\fakepath\\scan<1>.pdf"), "scan-1-.pdf");
});
