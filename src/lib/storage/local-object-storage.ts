import { createReadStream } from "node:fs";
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ObjectStorage, StagedObject } from "./object-storage";

function resolveStorageRoot() {
  if (process.env.NODE_ENV === "production" && !process.env.FILE_STORAGE_ROOT) {
    throw new Error("生产环境必须配置 FILE_STORAGE_ROOT 持久存储目录");
  }

  const root = path.resolve(
    /* turbopackIgnore: true */ process.env.FILE_STORAGE_ROOT || ".data/materials",
  );
  const publicRoot = path.resolve("public");
  const relativeToPublic = path.relative(publicRoot, root);
  if (relativeToPublic === "" || (!relativeToPublic.startsWith("..") && !path.isAbsolute(relativeToPublic))) {
    throw new Error("FILE_STORAGE_ROOT 必须位于 public 目录之外");
  }
  return root;
}

function safeObjectKey(prefix: "staging" | "objects", key: string) {
  if (!/^[a-f0-9-]{36}$/.test(key)) {
    throw new Error("无效的存储对象标识");
  }
  return `${prefix}/${key}`;
}

export class LocalObjectStorage implements ObjectStorage {
  readonly root: string;

  constructor(root = resolveStorageRoot()) {
    this.root = path.resolve(root);
  }

  private resolveKey(key: string) {
    const resolved = path.resolve(this.root, key);
    const relative = path.relative(this.root, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("存储路径越界");
    }
    return resolved;
  }

  async stage(data: Uint8Array): Promise<StagedObject> {
    const temporaryKey = safeObjectKey("staging", randomUUID());
    const filename = this.resolveKey(temporaryKey);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, data, { flag: "wx" });
    return { temporaryKey };
  }

  async finalize(temporaryKey: string) {
    const temporaryId = temporaryKey.split("/").at(-1) ?? "";
    safeObjectKey("staging", temporaryId);
    const storageKey = safeObjectKey("objects", randomUUID());
    const source = this.resolveKey(temporaryKey);
    const destination = this.resolveKey(storageKey);
    await mkdir(path.dirname(destination), { recursive: true });
    await rename(source, destination);
    return storageKey;
  }

  async open(storageKey: string) {
    const objectId = storageKey.split("/").at(-1) ?? "";
    safeObjectKey("objects", objectId);
    const filename = this.resolveKey(storageKey);
    await access(filename);
    return createReadStream(filename);
  }

  async exists(storageKey: string) {
    try {
      const stream = await this.open(storageKey);
      stream.destroy();
      return true;
    } catch {
      return false;
    }
  }

  async remove(storageKey: string) {
    const filename = this.resolveKey(storageKey);
    await rm(filename, { force: true });
  }
}

let storage: ObjectStorage | null = null;

export function getObjectStorage() {
  storage ??= new LocalObjectStorage();
  return storage;
}
