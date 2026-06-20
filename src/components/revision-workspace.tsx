"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, GitPullRequest, RefreshCw, RotateCcw, Group } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

type RevisionStatus = "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "PUBLISHED";

interface ReviewDecision {
  id: string; decision: string; comment: string | null; overrideReason: string | null; createdAt: string;
}

interface RevisionItem {
  kind: "revision";
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
  reviewDecisions: ReviewDecision[];
  canSubmit: boolean;
  canDerive: boolean;
  canPublish: boolean;
  canReview: boolean;
}

interface GroupItem {
  kind: "group";
  id: string;
  summary: string;
  status: RevisionStatus;
  authorId: string;
  submittedAt: string | null;
  updatedAt: string;
  author: { id: string; name: string; email: string };
  memberCount: number;
  members: Array<{ id: string; order: number; tempRef: string; contentType: string; payload: unknown }>;
  reviewDecisions: ReviewDecision[];
  provenance?: Array<{ kind: string; safeSourceLabel: string }>;
  canSubmit: boolean;
  canPublish: boolean;
  canReview: boolean;
}

type WorkspaceItem = RevisionItem | GroupItem;

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
  const searchParams = useSearchParams();
  const [revisions, setRevisions] = useState<RevisionItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [queue, setQueue] = useState<WorkspaceItem[]>([]);
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
      const [revData, groupData] = await Promise.all([
        requestJson<RevisionItem[]>("/api/revisions"),
        requestJson<GroupItem[]>("/api/revision-groups"),
      ]);
      setRevisions(revData);
      setGroups(groupData);
      // Select from URL param if provided
      const groupParam = searchParams?.get("group");
      const revisionParam = searchParams?.get("revision");
      if (groupParam) setSelectedId(groupParam);
      else if (revisionParam) setSelectedId(revisionParam);
      else setSelectedId((current) => current ?? groupData[0]?.id ?? revData[0]?.id ?? null);

      if (canReadReviewQueue) {
        const [revQueue, groupQueue] = await Promise.all([
          requestJson<RevisionItem[]>("/api/revisions/review-queue"),
          requestJson<GroupItem[]>("/api/revision-groups/review-queue"),
        ]);
        setQueue([...groupQueue, ...revQueue]);
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
  }, [canReadReviewQueue, searchParams]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const allItems = useMemo(() => {
    const map = new Map<string, WorkspaceItem>();
    for (const item of queue) map.set(item.id, item);
    for (const item of groups) if (!map.has(item.id)) map.set(item.id, item);
    for (const item of revisions) if (!map.has(item.id)) map.set(item.id, item);
    return [...map.values()];
  }, [revisions, groups, queue]);

  const selected = useMemo(() => allItems.find((item) => item.id === selectedId) ?? null, [allItems, selectedId]);

  function isGroup(item: WorkspaceItem): item is GroupItem {
    return item.kind === "group";
  }

  function getItemLabel(item: WorkspaceItem): string {
    if (isGroup(item)) return item.summary.slice(0, 60);
    const type = TYPE_LABELS[item.contentType] ?? item.contentType;
    return type + " v" + item.version;
  }

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
          <CardTitle>审核工作区</CardTitle>
          <CardDescription>{queueAvailable ? "待审队列 " + queue.length + " 项" : "我的草稿"}</CardDescription>
          <CardAction><Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw data-icon="inline-start" />刷新</Button></CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {allItems.length === 0 ? <p className="text-sm text-muted-foreground">暂无修订。编辑业务内容后，草稿会出现在这里。</p> : null}
          {allItems.map((item) => (
            <Button key={item.id} variant={selectedId === item.id ? "secondary" : "ghost"} className="h-auto justify-start" onClick={() => setSelectedId(item.id)}>
              <span className="flex min-w-0 flex-col items-start gap-1 text-left">
                <span className="flex items-center gap-1.5 truncate">
                  {isGroup(item) ? <Group className="size-3.5 shrink-0 text-muted-foreground" /> : null}
                  <span className="truncate">{getItemLabel(item)}</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {isGroup(item) ? <span className="text-[10px] text-muted-foreground">修订组</span> : <span>{TYPE_LABELS[item.contentType] ?? item.contentType}</span>}
                  <span>·</span>
                  <span>{item.author.name}</span>
                  <span>·</span>
                  <Badge variant={item.status === "PUBLISHED" ? "default" : item.status === "IN_REVIEW" ? "secondary" : "outline"} className="text-[10px]">{STATUS_LABELS[item.status]}</Badge>
                </span>
              </span>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{selected ? (isGroup(selected) ? "修订组: " + selected.summary.slice(0, 40) : (TYPE_LABELS[selected.contentType] ?? selected.contentType) + " 修订") : "修订详情"}</CardTitle>
          <CardDescription>{selected ? "作者: " + selected.author.name + (isGroup(selected) ? " · " + selected.memberCount + " 个成员" : " · 版本 " + selected.version) : "从左侧选择一项"}</CardDescription>
          {selected ? <CardAction><Badge>{STATUS_LABELS[selected.status]}</Badge></CardAction> : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {selected ? (
            <>
              {isGroup(selected) && selected.provenance && selected.provenance.length > 0 ? (
                <Alert>
                  <AlertTitle>来源</AlertTitle>
                  <AlertDescription>
                    {selected.provenance.map((p, i) => <span key={i} className="mr-2"><Badge variant="outline">{p.safeSourceLabel}</Badge></span>)}
                  </AlertDescription>
                </Alert>
              ) : null}

              {isGroup(selected) ? (
                <div className="flex flex-col gap-2">
                  <h3 className="font-medium">修订组成员 ({selected.memberCount})</h3>
                  {selected.members.map((member) => (
                    <Alert key={member.id}>
                      <AlertTitle>{TYPE_LABELS[member.contentType] ?? member.contentType}</AlertTitle>
                      <AlertDescription><pre className="max-h-32 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(member.payload, null, 2)}</pre></AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertTitle>候选内容</AlertTitle>
                  <AlertDescription><pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(selected.payload, null, 2)}</pre></AlertDescription>
                </Alert>
              )}

              {selected.reviewDecisions.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <h3 className="font-medium">审校记录</h3>
                  {selected.reviewDecisions.map((decision) => <Alert key={decision.id}><AlertTitle>{decision.decision === "APPROVED" ? "通过" : "退回"}</AlertTitle><AlertDescription>{decision.comment || decision.overrideReason || "未填写补充说明"}</AlertDescription></Alert>)}
                </div>
              ) : null}

              {selected.status === "DRAFT" && selected.canSubmit
                ? (isGroup(selected)
                  ? <Button onClick={() => void perform("/api/revision-groups/" + selected.id + "/submit")} disabled={busy}><GitPullRequest data-icon="inline-start" />提交审校</Button>
                  : <Button onClick={() => void perform("/api/revisions/" + selected.id + "/submit")} disabled={busy}><GitPullRequest data-icon="inline-start" />提交审校</Button>)
                : null}

              {selected.status === "APPROVED" && selected.canPublish
                ? (isGroup(selected)
                  ? <Button onClick={() => void perform("/api/revision-groups/" + selected.id + "/publish")} disabled={busy}><Check data-icon="inline-start" />发布正式版本</Button>
                  : <Button onClick={() => void perform("/api/revisions/" + selected.id + "/publish")} disabled={busy}><Check data-icon="inline-start" />发布正式版本</Button>)
                : null}

              {!isGroup(selected) && (selected.status === "CHANGES_REQUESTED" || selected.status === "PUBLISHED") && (selected as RevisionItem).canDerive
                ? <Button variant="outline" onClick={() => void perform("/api/revisions/" + selected.id + "/derive")} disabled={busy}><RotateCcw data-icon="inline-start" />派生新草稿</Button>
                : null}

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
                    <Button onClick={() => void perform((isGroup(selected) ? "/api/revision-groups/" : "/api/revisions/") + selected.id + "/review", { decision: "APPROVED", comment, overrideReason })} disabled={busy}><Check data-icon="inline-start" />通过</Button>
                    <Button variant="outline" onClick={() => void perform((isGroup(selected) ? "/api/revision-groups/" : "/api/revisions/") + selected.id + "/review", { decision: "CHANGES_REQUESTED", comment, overrideReason })} disabled={busy || !comment.trim()}>退回修改</Button>
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
