import type { Readable } from "node:stream";

export interface StagedObject {
  temporaryKey: string;
}

export interface ObjectStorage {
  stage(data: Uint8Array): Promise<StagedObject>;
  finalize(temporaryKey: string): Promise<string>;
  open(storageKey: string): Promise<Readable>;
  exists(storageKey: string): Promise<boolean>;
  remove(storageKey: string): Promise<void>;
}
