import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { createHash } from "node:crypto";
import { createFamilyExchangeZip, inspectZipCentralDirectory, parseFamilyExchangePackage, type FamilyExchangeManifest } from "./exchange-package";

const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const hash = createHash("sha256").update(png).digest("hex");
const manifest: FamilyExchangeManifest = {
  kind: "family-exchange-package", version: 2, exportedAt: new Date().toISOString(),
  persons: [{ id: "p1", name: "张三", gender: "male", birthDate: null, deathDate: null, bio: null, aliases: [], generationNumber: 1, generationLabel: null, nativePlace: null, notes: null, posX: null, posY: null, createdAt: new Date().toISOString() }],
  relationships: [], events: [],
  materials: [{ id: "m1", title: "族谱", category: "genealogy", source: null, eraLabel: null, contributor: null, description: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
  files: [{ id: "f1", materialId: "m1", path: "files/f1.png", originalName: "scan.png", mimeType: "image/png", byteSize: png.length, contentHash: hash, displayOrder: 0, createdAt: new Date().toISOString() }],
  links: [{ id: "l1", materialId: "m1", personId: "p1", personEventId: null }],
  summary: { personCount: 1, relationshipCount: 0, eventCount: 0, materialCount: 1, fileCount: 1 },
};

test("round trips a validated exchange package", () => {
  const bytes = createFamilyExchangeZip(manifest, new Map([["f1", png]]));
  const parsed = parseFamilyExchangePackage(bytes);
  assert.equal(parsed.manifest.materials[0].title, "族谱");
  assert.deepEqual(parsed.payloads.get("f1"), png);
});

test("rejects traversal paths before extraction", () => {
  const bytes = zipSync({ "../escape.txt": strToU8("bad") });
  assert.throws(() => inspectZipCentralDirectory(bytes), /不安全路径/);
});

test("rejects missing, mismatched, and malformed payloads", () => {
  const missing = zipSync({ "manifest.json": strToU8(JSON.stringify(manifest)) });
  assert.throws(() => parseFamilyExchangePackage(missing), /缺少文件/);
  const wrong = createFamilyExchangeZip({ ...manifest, files: [{ ...manifest.files[0], contentHash: "0".repeat(64) }] }, new Map([["f1", png]]));
  assert.throws(() => parseFamilyExchangePackage(wrong), /校验失败/);
  assert.throws(() => parseFamilyExchangePackage(Uint8Array.from([1, 2, 3])));
});
