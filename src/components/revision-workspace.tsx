"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, GitPullRequest, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

type RevisionStatus = "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "PUBLISHED";

type RevisionItem = {
  id: string;
  contentType: string;
  targetEntityId: string | null;
  authorId: string;
  version: number;
  status: RevisionStatus;
  payload: unknown;
  submittedAt: string | null;
  updatedAt: string;
  author: { id: string; name: string; email: string };
  reviewDecisions: Array<{ id: string; decision: string; comment: string | null; overrideReason: string | null; createdAt: string }>;
  canSubmit: boolean;
  canDerive: boolean;
  canPublish: boolean;
  canReview: boolean;
};

const STATUS_LABELS: Record<RevisionStatus, string> = {
  DRAFT: "草稿",
  IN_REVIEW: "待审",
  CHANGES_REQUESTED: "已退回",
  APPROVED: "已通过",
  PUBLISHED: "已发布",
};

const TYPE_LABELS: Record<string, string> = {
  PERSON: "人物",
  PERSON_EVENT: "人物事件",
  RELATIONSHIP: "关系",
  SOURCE_MATERIAL: "文献资料",
  MEDIA_OBJECT: "媒体文件",
  MATERIAL_LINK: "资料关联",
  IMPORT_BATCH: "批量导入",
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "请求失败");
  return body as T;
}

export function RevisionWorkspace({ canReadReviewQueue }: { canReadReviewQueue: boolean }) {
  const [items, setItems] = useState<RevisionItem[]>([]);
  const [queue, setQueue] = useState<RevisionItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [queueAvailable, setQueueAvailable] = useState(canReadReviewQueue);
  const activeRequestRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const workspace = await requestJson<RevisionItem[]>("/api/revisions");
      setItems(workspace);
      setSelectedId((current) => current ?? workspace[0]?.id ?? null);
      if (canReadReviewQueue) {
        setQueue(await requestJson<RevisionItem[]>("/api/revisions/review-queue"));
        setQueueAvailable(true);
      } else {
        setQueue([]);
        setQueueAvailable(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "修订工作区加载失败");
    } finally {
      setLoading(false);
    }
  }, [canReadReviewQueue]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? queue.find((item) => item.id === selectedId) ?? null, [items, queue, selectedId]);

  async function perform(url: string, body?: object) {
    if (activeRequestRef.current === url) return;
    activeRequestRef.current = url;
    setBusy(true);
    try {
      await requestJson(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      setComment("");
      setOverrideReason("");
      toast.success("修订状态已更新");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    } finally {
      activeRequestRef.current = null;
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>修订列表</CardTitle>
          <CardDescription>{queueAvailable ? `我的修订与 ${queue.length} 项待审内容` : "我的修订"}</CardDescription>
          <CardAction><Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw data-icon="inline-start" />刷新</Button></CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {items.length === 0 && queue.length === 0 ? <p className="text-sm text-muted-foreground">暂无修订。编辑业务内容后，草稿会出现在这里。</p> : null}
          {[...new Map([...queue, ...items].map((item) => [item.id, item])).values()].map((item) => (
            <Button key={item.id} variant={selectedId === item.id ? "secondary" : "ghost"} className="h-auto justify-start" onClick={() => setSelectedId(item.id)}>
              <span className="flex min-w-0 flex-col items-start gap-1 text-left">
                <span className="truncate">{TYPE_LABELS[item.contentType] ?? item.contentType} · v{item.version}</span>
                <span className="text-xs text-muted-foreground">{item.author.name} · {STATUS_LABELS[item.status]}</span>
              </span>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{selected ? `${TYPE_LABELS[selected.contentType] ?? selected.contentType}修订` : "修订详情"}</CardTitle>
          <CardDescription>{selected ? `作者：${selected.author.name} · 版本 ${selected.version}` : "从左侧选择一项修订。"}</CardDescription>
          {selected ? <CardAction><Badge>{STATUS_LABELS[selected.status]}</Badge></CardAction> : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {selected ? (
            <>
              <Alert>
                <AlertTitle>候选内容</AlertTitle>
                <AlertDescription><pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(selected.payload, null, 2)}</pre></AlertDescription>
              </Alert>

              {selected.reviewDecisions.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <h3 className="font-medium">审校记录</h3>
                  {selected.reviewDecisions.map((decision) => <Alert key={decision.id}><AlertTitle>{decision.decision === "APPROVED" ? "通过" : "退回"}</AlertTitle><AlertDescription>{decision.comment || decision.overrideReason || "未填写补充说明"}</AlertDescription></Alert>)}
                </div>
              ) : null}

              {selected.status === "DRAFT" && selected.canSubmit ? <Button onClick={() => void perform(`/api/revisions/${selected.id}/submit`)} disabled={busy}><GitPullRequest data-icon="inline-start" />提交审校</Button> : null}
              {(selected.status === "CHANGES_REQUESTED" || selected.status === "PUBLISHED") && selected.canDerive ? <Button variant="outline" onClick={() => void perform(`/api/revisions/${selected.id}/derive`)} disabled={busy}><RotateCcw data-icon="inline-start" />派生新草稿</Button> : null}
              {selected.status === "APPROVED" && selected.canPublish ? <Button onClick={() => void perform(`/api/revisions/${selected.id}/publish`)} disabled={busy}><Check data-icon="inline-start" />发布正式版本</Button> : null}

              {queueAvailable && selected.status === "IN_REVIEW" && selected.canReview ? (
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="review-comment">审校意见</FieldLabel>
                    <Textarea id="review-comment" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="退回时必须填写具体修改建议" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="review-override">紧急自审原因</FieldLabel>
                    <Textarea id="review-override" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="仅所有者或管理员自审时填写" />
                    <FieldDescription>普通审校者不能审校自己的修订。</FieldDescription>
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void perform(`/api/revisions/${selected.id}/review`, { decision: "APPROVED", comment, overrideReason })} disabled={busy}><Check data-icon="inline-start" />通过</Button>
                    <Button variant="outline" onClick={() => void perform(`/api/revisions/${selected.id}/review`, { decision: "CHANGES_REQUESTED", comment, overrideReason })} disabled={busy || !comment.trim()}>退回修改</Button>
                  </div>
                </FieldGroup>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
