"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PersonData } from "@/types";

type RelationType = "spouse" | "child" | "parent";

const RANK_PRESETS = ["长", "次", "三", "幼", "独"];

function relationTypeLabel(type: RelationType) {
  return type === "spouse" ? "配偶" : type === "child" ? "子女" : "父母";
}

function relationTypeDescription(type: RelationType) {
  return type === "spouse"
    ? "建立婚姻或伴侣关系"
    : type === "child"
      ? "将下一代成员接入当前人物"
      : "补录当前人物的父母关系";
}

function ChildLabelField({
  persons,
  targetPersonId,
  value,
  onChange,
  childGender,
}: {
  persons: PersonData[];
  targetPersonId: string;
  value: string;
  onChange: (v: string) => void;
  childGender?: string;
}) {
  const [isCustom, setIsCustom] = useState(false);
  const target = persons.find((person) => person.id === targetPersonId);
  const gender = childGender || target?.gender;
  const suffix = gender === "male" ? "子" : "女";
  const presets = RANK_PRESETS.map((rank) => `${rank}${suffix}`);
  const selectedPreset = presets.includes(value) ? value : undefined;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">排行标签</Label>
        <p className="text-xs leading-5 text-muted-foreground">
          用于在家族关系里标注长子、次女等称谓。
        </p>
      </div>

      <div className="mt-3 space-y-3">
        <Select
          value={selectedPreset || (isCustom ? "__custom__" : "")}
          onValueChange={(nextValue) => {
            if (!nextValue) return;

            if (nextValue === "__custom__") {
              setIsCustom(true);
              onChange("");
              return;
            }

            setIsCustom(false);
            onChange(nextValue);
          }}
        >
          <SelectTrigger className="h-11 w-full bg-background/80">
            <SelectValue placeholder="选择排行标签，如长子、次女" />
          </SelectTrigger>
          <SelectContent>
            {presets.map((preset) => (
              <SelectItem key={preset} value={preset}>
                {preset}
              </SelectItem>
            ))}
            <SelectItem value="__custom__">自定义...</SelectItem>
          </SelectContent>
        </Select>

        {isCustom ? (
          <Input
            placeholder="输入自定义标签"
            className="h-11 bg-background/80"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : null}
      </div>
    </div>
  );
}

interface RelationshipFormProps {
  open: boolean;
  onClose: () => void;
  currentPersonId: string;
}

export function RelationshipForm({
  open,
  onClose,
  currentPersonId,
}: RelationshipFormProps) {
  const router = useRouter();
  const [persons, setPersons] = useState<PersonData[]>([]);
  const [currentGender, setCurrentGender] = useState<string>("male");
  const [loadingPersons, setLoadingPersons] = useState(false);
  const [relationType, setRelationType] = useState<RelationType>("spouse");
  const [targetPersonId, setTargetPersonId] = useState<string>("");
  const [label, setLabel] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetFormState() {
    setRelationType("spouse");
    setTargetPersonId("");
    setLabel("");
    setError(null);
  }

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function fetchPersons() {
      setLoadingPersons(true);
      setError(null);

      try {
        const res = await fetch("/api/persons");
        if (!res.ok) throw new Error("load_failed");

        const data: PersonData[] = await res.json();
        if (cancelled) return;

        const self = data.find((person) => person.id === currentPersonId);
        if (self) setCurrentGender(self.gender);
        setPersons(data.filter((person) => person.id !== currentPersonId));
      } catch {
        if (!cancelled) {
          setError("加载人物列表失败");
        }
      } finally {
        if (!cancelled) {
          setLoadingPersons(false);
        }
      }
    }

    void fetchPersons();

    return () => {
      cancelled = true;
    };
  }, [open, currentPersonId]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetFormState();
      onClose();
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
          type: relationType === "parent" ? "child" : relationType,
          personAId: relationType === "parent" ? targetPersonId : currentPersonId,
          personBId: relationType === "parent" ? currentPersonId : targetPersonId,
          label: label || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "添加关系失败");
        return;
      }

      toast.success(`${relationTypeLabel(relationType)}关系已添加`);
      router.refresh();
      resetFormState();
      onClose();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredPersons = persons.filter((person) => {
    if (relationType === "spouse") {
      return person.gender !== currentGender;
    }
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 shadow-sm shadow-amber-900/15 ring-1 ring-amber-700/20 dark:from-amber-500 dark:to-amber-700 dark:ring-amber-400/10">
              <Heart className="h-5 w-5 text-amber-50" strokeWidth={1.8} />
            </div>
            <div>
              <DialogTitle className="text-lg">添加家族关系</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                为当前人物补充配偶、父母或子女，并保持和档案页一致的维护体验。
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error ? (
            <div className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">关系类型</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  先确定你要维护的是配偶、子女还是父母关系。
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <Select
                value={relationType}
                onValueChange={(value) => {
                  setRelationType(value as RelationType);
                  setTargetPersonId("");
                  setLabel("");
                  setError(null);
                }}
              >
                <SelectTrigger className="h-11 w-full bg-background/80">
                  <SelectValue>{relationTypeLabel(relationType)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spouse">配偶</SelectItem>
                  <SelectItem value="child">子女</SelectItem>
                  <SelectItem value="parent">父母</SelectItem>
                </SelectContent>
              </Select>

              <div className="rounded-xl border border-border/60 bg-background/75 px-3 py-2 text-xs text-muted-foreground">
                {relationTypeDescription(relationType)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Users className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">目标人物</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  从已录入成员里选择要建立关系的对象。
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <Label className="text-sm font-medium">
                {relationType === "spouse"
                  ? "选择配偶"
                  : relationType === "child"
                    ? "选择子女"
                    : "选择父母"}
              </Label>
              <Select
                value={targetPersonId}
                onValueChange={(value) => {
                  setTargetPersonId(value ?? "");
                  setError(null);
                }}
                disabled={loadingPersons}
              >
                <SelectTrigger className="h-11 w-full bg-background/80">
                  {loadingPersons ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      加载中...
                    </span>
                  ) : (
                    <SelectValue>
                      {targetPersonId
                        ? persons.find((person) => person.id === targetPersonId)?.name || targetPersonId
                        : filteredPersons.length === 0
                          ? "暂无可选人物"
                          : `选择${relationTypeLabel(relationType)}`}
                    </SelectValue>
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
          </div>

          {relationType === "child" && targetPersonId ? (
            <ChildLabelField
              persons={persons}
              targetPersonId={targetPersonId}
              value={label}
              onChange={setLabel}
            />
          ) : null}

          {relationType === "parent" && targetPersonId ? (
            <ChildLabelField
              persons={persons}
              targetPersonId={currentPersonId}
              value={label}
              onChange={setLabel}
              childGender={currentGender}
            />
          ) : null}

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting || loadingPersons} className="flex-1">
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
