"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createImportExportService } from "./import-export-core";
import { authorizeFamilyAction } from "@/services/family-authorization.service";

const service = createImportExportService({
  prisma,
  revalidatePath,
});

export async function exportFamilyBackupForUser(userId: string, treeId: string) {
  await authorizeFamilyAction(userId, treeId, "export.read");
  return service.exportFamilyBackupForUser(userId, treeId);
}

export async function importFamilyBackupForUser(userId: string, treeId: string, input: unknown) {
  await authorizeFamilyAction(userId, treeId, "import.execute");
  return service.importFamilyBackupForUser(userId, treeId, input);
}
