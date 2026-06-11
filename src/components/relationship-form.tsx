"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PersonData } from "@/types";

type RelationType = "spouse" | "child";

const RANK_PRESETS = ["长", "次", "三", "幼", "独"];

function ChildLabelField({
  persons,
  targetPersonId,
  value,
  onChange,
}: {
  persons: PersonData[];
  targetPersonId: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [isCustom, setIsCustom] = useState(false);
  const target = persons.find((p) => p.id === targetPersonId);
  const suffix = target?.gender === "male" ? "子" : "女";

  const presets = RANK_PRESETS.map((r) => `${r}${suffix}`);

  const selectedPreset = presets.includes(value) ? value : undefined;

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">排行标签</Label>
        <Select
          value={selectedPreset || (isCustom ? "__custom__" : "")}
          onValueChange={(v) => {
            if (!v) return;
            if (v === "__custom__") {
              setIsCustom(true);
              onChange("");
            } else {
              setIsCustom(false);
              onChange(v);
            }
          }}
        >
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder="选择排行（如长子、长女）" />
          </SelectTrigger>
          <SelectContent>
            {presets.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
            <SelectItem value="__custom__">自定义...</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isCustom && (
        <Input
          placeholder="输入自定义标签"
          className="h-10"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

interface RelationshipFormProps {
  open: boolean;
  onClose: () => void;
  currentPersonId: string;
}

export function RelationshipForm({ open, onClose, currentPersonId }: RelationshipFormProps) {
  const router = useRouter();
  const [persons, setPersons] = useState<PersonData[]>([]);
  const [loadingPersons, setLoadingPersons] = useState(false);
  const [relationType, setRelationType] = useState<RelationType>("spouse");
  const [targetPersonId, setTargetPersonId] = useState<string>("");
  const [label, setLabel] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available persons (excluding current person)
  useEffect(() => {
    if (!open) return;

    async function fetchPersons() {
      setLoadingPersons(true);
      setError(null);
      try {
        const res = await fetch("/api/persons");
        if (!res.ok) throw new Error("加载人物列表失败");
        const data: PersonData[] = await res.json();
        setPersons(data.filter((p) => p.id !== currentPersonId));
      } catch {
        setError("加载人物列表失败");
      } finally {
        setLoadingPersons(false);
      }
    }

    fetchPersons();

    // Reset form state when dialog opens
    setRelationType("spouse");
    setTargetPersonId("");
    setLabel("");
    setError(null);
  }, [open, currentPersonId]);

  function handleOpenChange(open: boolean) {
    if (!open) {
      onClose();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!targetPersonId) {
      setError("请选择目标人物");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: relationType,
          personAId: currentPersonId,
          personBId: targetPersonId,
          label: label || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "添加关系失败");
        return;
      }

      const relLabel = relationType === "spouse" ? "配偶" : "子女";
      toast.success(`${relLabel}关系已添加`);
      router.refresh();
      onClose();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredPersons = relationType === "child"
    ? persons.filter((p) => p.gender === "male" || p.gender === "female")
    : persons;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 shadow-sm shadow-amber-900/15 ring-1 ring-amber-700/20 dark:from-amber-500 dark:to-amber-700 dark:ring-amber-400/10">
              <Heart className="h-4.5 w-4.5 text-amber-50" strokeWidth={1.8} />
            </div>
            <div>
              <DialogTitle className="text-lg">
                添加关系
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                为当前人物添加配偶或子女关系
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {/* Error banner */}
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive dark:border-destructive/20 dark:bg-destructive/10">
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Relationship type */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">关系类型</Label>
              <Select
                value={relationType}
                onValueChange={(value) => {
                  setRelationType(value as RelationType);
                  setTargetPersonId("");
                }}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue>
                    {relationType === "spouse" ? "配偶" : "子女"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spouse">配偶</SelectItem>
                  <SelectItem value="child">子女</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Target person */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {relationType === "spouse" ? "选择配偶" : "选择子女"}
              </Label>
              <Select
                value={targetPersonId}
                onValueChange={(value) => {
                  setTargetPersonId(value ?? "");
                  setError(null);
                }}
                disabled={loadingPersons}
              >
                <SelectTrigger className="h-10 w-full">
                  {loadingPersons ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      加载中...
                    </span>
                  ) : (
                    <SelectValue
                      placeholder={
                        filteredPersons.length === 0
                          ? "暂无可选人物"
                          : `选择${relationType === "spouse" ? "配偶" : "子女"}`
                      }
                    />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {filteredPersons.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      暂无可选人物
                    </div>
                  ) : (
                    filteredPersons.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        <span className="flex items-center gap-2">
                          <span>{person.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({person.gender === "male" ? "男" : "女"})
                          </span>
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Child label field */}
            {relationType === "child" && targetPersonId && (
              <ChildLabelField
                persons={persons}
                targetPersonId={targetPersonId}
                value={label}
                onChange={setLabel}
              />
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-6">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || loadingPersons}
              className="flex-1 bg-gradient-to-r from-amber-600 to-amber-700 font-medium shadow-md shadow-amber-900/15 transition-all hover:from-amber-700 hover:to-amber-800 dark:from-amber-600 dark:to-amber-700 dark:hover:from-amber-500 dark:hover:to-amber-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  添加中...
                </>
              ) : (
                "确认添加"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
