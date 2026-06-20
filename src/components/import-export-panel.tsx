"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { previewImport, executeImport } from "@/services/snapshot.service";

export function ImportExportPanel() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    summary: Record<string, number>;
    warnings: string[];
    conflicts: string[];
    valid: boolean;
  } | null>(null);
  const [confirmationId, setConfirmationId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

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

  async function handleFileSelect(file: File) {
    setPendingFile(file);
    setIsPreviewing(true);
    setConfirmationId(null);
    setPreviewResult(null);

    try {
      const payload = JSON.parse(await file.text());
      const result = await previewImport(payload);

      if (!result.preview.valid) {
        toast.warning("导入预览发现冲突");
      }

      setPreviewResult(result.preview);
      setConfirmationId(result.confirmationId);
      setPreviewDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "预览失败");
    } finally {
      setIsPreviewing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleConfirmImport() {
    if (!confirmationId || !pendingFile) {
      toast.error("请重新选择文件");
      return;
    }
    setIsImporting(true);

    try {
      const payload = JSON.parse(await pendingFile.text());
      const result = await executeImport(confirmationId, payload);
      toast.success(
        `${"已恢复 "}${result.personCount} 位人物、${result.relationshipCount} 条关系和${result.eventCount} 条事件`
      );
      setPreviewDialogOpen(false);
      setPreviewResult(null);
      setConfirmationId(null);
      setPendingFile(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导入失败");
    } finally {
      setIsImporting(false);
    }
  }

  function handleDialogClose() {
    setPreviewDialogOpen(false);
    setPendingFile(null);
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
            void handleFileSelect(file);
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
          disabled={isExporting || isImporting || isPreviewing}
        >
          {isPreviewing ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Upload data-icon="inline-start" />
          )}
          导入备份
        </Button>
      </div>

      <Dialog open={previewDialogOpen} onOpenChange={(o) => { if (!o) handleDialogClose(); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${previewResult?.valid ? "bg-green-500/10 ring-green-500/20" : "bg-amber-500/10 ring-amber-500/20"}`}>
                {previewResult?.valid ? (
                  <CheckCircle className="h-4.5 w-4.5 text-green-600" strokeWidth={1.8} />
                ) : (
                  <AlertCircle className="h-4.5 w-4.5 text-amber-600" strokeWidth={1.8} />
                )}
              </div>
              <div>
                <DialogTitle className="text-lg">导入预览</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {previewResult?.valid ? "请确认导入内容" : "存在冲突，无法导入"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {previewResult && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm space-y-1">
                <p className="font-medium">导入摘要：</p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                  <li>总人物：{previewResult.summary.totalPersons}</li>
                  <li>新增人物：{previewResult.summary.newPersons}</li>
                  <li>替换人物：{previewResult.summary.replacedPersons}</li>
                  <li>移除人物：{previewResult.summary.removedPersons}</li>
                  <li>关系数：{previewResult.summary.totalRelationships}</li>
                  <li>事件数：{previewResult.summary.totalEvents}</li>
                </ul>
              </div>

              {previewResult.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                  <p className="font-medium text-amber-600">警告：</p>
                  <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                    {previewResult.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {previewResult.conflicts.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <p className="font-medium text-destructive">冲突（阻止导入）：</p>
                  <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                    {previewResult.conflicts.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDialogClose}
                disabled={isImporting}
              >
                取涀
              </Button>
              {previewResult?.valid && confirmationId && (
                <Button
                  onClick={handleConfirmImport}
                  disabled={isImporting}
                  className="flex-1"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      导入中...
                    </>
                  ) : (
                    "确认导入"
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
