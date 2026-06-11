"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";

export function DeleteRelationButton({ relationId }: { relationId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    await fetch("/api/relationships", {
      method: "DELETE",
      body: JSON.stringify({ id: relationId }),
      headers: { "Content-Type": "application/json" },
    });
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="shrink-0 rounded-md p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        title="删除关系"
      >
        <X className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <span className="text-xs text-red-500 whitespace-nowrap">确认删除？</span>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "删除"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="rounded-md p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
