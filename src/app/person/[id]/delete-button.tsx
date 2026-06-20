"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
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
import { previewPersonDeletion, deletePerson } from "@/services/person.service";

interface DeleteButtonProps {
  personId: string;
  personName: string;
}

interface PreviewData {
  person: { id: string; name: string };
  affected: {
    relationshipCount: number;
    eventCount: number;
    relationships: Array<{ id: string; type: string; otherPerson: { id: string; name: string } }>;
    events: Array<{ id: string; type: string; title: string | null }>;
  };
  revision: number;
}

export function DeleteButton({ personId, personName }: DeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [confirmationId, setConfirmationId] = useState<string | null>(null);

  async function handlePreview() {
    setIsPreviewing(true);
    try {
      const result = await previewPersonDeletion(personId);
      setPreviewData(result.preview as PreviewData);
      setConfirmationId(result.confirmationId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载预览失败");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleDelete() {
    if (!confirmationId) return;
    setIsDeleting(true);

    try {
      await deletePerson(confirmationId, personId);
      toast.success("人物已删除");
      router.push("/tree");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
      setPreviewData(null);
      setConfirmationId(null);
    } finally {
      setIsDeleting(false);
      setOpen(false);
    }
  }

  function handleOpen(open: boolean) {
    setOpen(open);
    if (!open) {
      setPreviewData(null);
      setConfirmationId(null);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="default"
        onClick={() => handleOpen(true)}
        className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive dark:border-destructive/30 dark:hover:bg-destructive/10"
      >
        <Trash2 className="mr-1.5 h-4 w-4" />
        删除
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 ring-1 ring-destructive/20">
                <AlertTriangle className="h-4.5 w-4.5 text-destructive" strokeWidth={1.8} />
              </div>
              <div>
                <DialogTitle className="text-lg">确认删除</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {previewData ? "请确认删除操作" : "查看影响范围后确认"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {previewData ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                确定要删除 <span className="font-medium text-foreground">{personName}</span> 吗？
              </p>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm space-y-1">
                <p>影响范围：</p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                  <li>相邻关系：{previewData.affected.relationshipCount} 条</li>
                  <li>关联事件：{previewData.affected.eventCount} 条（将被保留但不可见）</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">
                数据将被软删除，可在设置中恢复。
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              点击下方按钮查看 <span className="font-medium text-foreground">{personName}</span> 的删除影响范围。
            </p>
          )}

          <DialogFooter>
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleOpen(false)}
                disabled={isPreviewing || isDeleting}
              >
                取消
              </Button>

              {!previewData ? (
                <Button
                  onClick={handlePreview}
                  disabled={isPreviewing}
                  className="flex-1"
                >
                  {isPreviewing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      预览中...
                    </>
                  ) : (
                    "查看影响范围"
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      删除中...
                    </>
                  ) : (
                    "确认删除"
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