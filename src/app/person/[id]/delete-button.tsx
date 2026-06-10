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

interface DeleteButtonProps {
  personId: string;
  personName: string;
}

export function DeleteButton({ personId, personName }: DeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/persons/${personId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "删除失败");
        return;
      }

      toast.success("人物已删除");
      router.push("/tree");
      router.refresh();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setIsDeleting(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="default"
        onClick={() => setOpen(true)}
        className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive dark:border-destructive/30 dark:hover:bg-destructive/10"
      >
        <Trash2 className="mr-1.5 h-4 w-4" />
        删除
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 ring-1 ring-destructive/20">
                <AlertTriangle className="h-4.5 w-4.5 text-destructive" strokeWidth={1.8} />
              </div>
              <div>
                <DialogTitle className="text-lg">确认删除</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  此操作无法撤销
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            确定要删除 <span className="font-medium text-foreground">{personName}</span> 吗？该人物的所有关系记录也将被一并删除。
          </p>

          <DialogFooter>
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
                disabled={isDeleting}
              >
                取消
              </Button>
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
