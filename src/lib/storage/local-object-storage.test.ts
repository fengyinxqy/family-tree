import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LocalObjectStorage } from "./local-object-storage";

test("stages, finalizes, reads, and removes a private object", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "family-storage-"));
  try {
    const storage = new LocalObjectStorage(root);
    const staged = await storage.stage(new TextEncoder().encode("archive"));
    const key = await storage.finalize(staged.temporaryKey);
    assert.equal(await storage.exists(key), true);

    const stream = await storage.open(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    assert.equal(Buffer.concat(chunks).toString(), "archive");

    await storage.remove(key);
    assert.equal(await storage.exists(key), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects traversal and missing objects", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "family-storage-"));
  try {
    const storage = new LocalObjectStorage(root);
    await assert.rejects(storage.open("../../package.json"));
    await assert.rejects(storage.open("objects/00000000-0000-0000-0000-000000000000"));
    await assert.rejects(readFile(path.join(root, "objects", "missing")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
