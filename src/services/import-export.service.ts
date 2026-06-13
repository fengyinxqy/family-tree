"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createImportExportService } from "./import-export-core";

const service = createImportExportService({
  prisma,
  revalidatePath,
});

export const exportFamilyBackupForUser = service.exportFamilyBackupForUser;
export const importFamilyBackupForUser = service.importFamilyBackupForUser;
