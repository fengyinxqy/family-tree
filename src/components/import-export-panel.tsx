"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ImportExportPanel() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);

    try {
      const response = await fetch("/api/import-export/export");
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "导出失败");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition");
      const match = disposition?.match(/filename="(.+)"/);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = match?.[1] ?? "family-backup.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("家谱备份已开始下载");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImport(file: File) {
    setIsImporting(true);

    try {
      const payload = JSON.parse(await file.text());
      const response = await fetch("/api/import-export/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        error?: string;
        message?: string;
        summary?: {
          personCount: number;
          relationshipCount: number;
          eventCount: number;
        };
      };

      if (!response.ok) {
        throw new Error(data.error || "导入失败");
      }

      toast.success(
        data.message ||
          `已恢复 ${data.summary?.personCount ?? 0} 位人物、${data.summary?.relationshipCount ?? 0} 条关系和 ${data.summary?.eventCount ?? 0} 条事件`,
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导入失败");
    } finally {
      setIsImporting(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleImport(file);
          }
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          disabled={isExporting || isImporting}
        >
          {isExporting ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Download data-icon="inline-start" />
          )}
          导出备份
        </Button>

        <Button
          type="button"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={isExporting || isImporting}
        >
          {isImporting ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Upload data-icon="inline-start" />
          )}
          导入备份
        </Button>
      </div>
    </>
  );
}
