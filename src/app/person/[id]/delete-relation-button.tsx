"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, AlertTriangle } from "lucide-react";
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
import { previewRelationshipDeletion, deleteRelationship } from "@/services/relationship.service";

export function DeleteRelationButton({ relationId }: { relationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewData, setPreviewData] = useState<{
    relationship: { id: string; type: string; personA: { id: string; name: string }; personB: { id: string; name: string } };
    affected: { willHide: boolean; note: string };
    revision: number;
  } | null>(null);
  const [confirmationId, setConfirmationId] = useState<string | null>(null);

  async function handlePreview() {
        try {
      const result = await previewRelationshipDeletion(relationId);
      setPreviewData(result.preview);
      setConfirmationId(result.confirmationId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载预览失败");
    } finally {
          }
  }

  async function handleDelete() {
    if (!confirmationId) return;
    setIsDeleting(true);
    try {
      await deleteRelationship(confirmationId, relationId);
      toast.success("关系已删除");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
      setPreviewData(null);
      setConfirmationId(null);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleOpenChange(open: boolean) {
    setOpen(open);
    if (!open) {
      setPreviewData(null);
      setConfirmationId(null);
    }
  }

  return (
    <>
      <button
        onClick={() => { handleOpenChange(true); handlePreview(); }}
        className="shrink-0 rounded-md p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        title="删除关系"
      >
        <X className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 ring-1 ring-destructive/20">
                <AlertTriangle className="h-4.5 w-4.5 text-destructive" strokeWidth={1.8} />
              </div>
              <div>
                <DialogTitle className="text-lg">确认删除关系</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  此操作可恢复
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {previewData ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                确定要删除
                <span className="font-medium text-foreground"> {previewData.relationship.personA.name} </span>
                与
                <span className="font-medium text-foreground"> {previewData.relationship.personB.name} </span>
                之间的{previewData.relationship.type === "spouse" ? "配偶" : "亲子"}关系吗？
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">正在加载关系信息...</p>
          )}

          <DialogFooter>
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleOpenChange(false)}
                disabled={isDeleting}
              >
                取消
              </Button>
              <Button
                onClick={handleDelete}
                disabled={isDeleting || !confirmationId}
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}