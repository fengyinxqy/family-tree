"use client";

import { useState, useCallback, useRef } from "react";
import { TriangleAlert, Check, X, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

interface DependencyEntity {
  entityType: string;
  entityId: string;
  entityLabel: string;
}

interface WithdrawalPreview {
  entityType: string;
  entityId: string;
  entityLabel: string;
  canWithdraw: boolean;
  blockers: string[];
  affectedEntityCount: number;
  affectedEntities: DependencyEntity[];
  revision: number;
}

interface PreviewResult {
  preview: WithdrawalPreview;
  confirmationId: string;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "请求失败");
  return body as T;
}

export function PublicationWithdrawalPanel() {
  const [entityType, setEntityType] = useState<string>("PERSON");
  const [entityId, setEntityId] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<WithdrawalPreview | null>(null);
  const [confirmationId, setConfirmationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);
  const busyRef = useRef(false);

  const handlePreview = useCallback(async () => {
    if (busyRef.current) return;
    if (!entityId.trim()) { toast.error("请输入实体 ID"); return; }
    busyRef.current = true;
    setLoading(true);
    setPreview(null);
    setConfirmationId(null);
    setWithdrawn(false);
    try {
      const result = await requestJson<PreviewResult>("/api/publications/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", entityType, entityId: entityId.trim() }),
      });
      setPreview(result.preview);
      setConfirmationId(result.confirmationId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "预览失败");
    } finally {
      setLoading(false);
      busyRef.current = false;
    }
  }, [entityType, entityId]);

  const handleConfirm = useCallback(async () => {
    if (busyRef.current || !confirmationId || !preview) return;
    if (!reason.trim()) { toast.error("请填写撤回原因"); return; }
    busyRef.current = true;
    setLoading(true);
    try {
      await requestJson("/api/publications/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", confirmationId, entityType: preview.entityType, entityId: preview.entityId, reason: reason.trim() }),
      });
      toast.success("已撤回");
      setWithdrawn(true);
      setPreview(null);
      setConfirmationId(null);
      setReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "撤回失败");
    } finally {
      setLoading(false);
      busyRef.current = false;
    }
  }, [confirmationId, preview, reason]);

  const ENTITY_TYPES = [
    { value: "PERSON", label: "人物" },
    { value: "PERSON_EVENT", label: "人物事件" },
    { value: "RELATIONSHIP", label: "关系" },
    { value: "SOURCE_MATERIAL", label: "文献资料" },
    { value: "MEDIA_OBJECT", label: "媒体文件" },
    { value: "MATERIAL_LINK", label: "资料关联" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><History className="size-5" />撤回已发布内容</CardTitle>
        <CardDescription>预览依赖影响后，填写原因确认撤回。撤回后内容在普通视图中不可见，审计记录保留。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <select
            value={entityType}
            onChange={(e) => { setEntityType(e.target.value); setPreview(null); setConfirmationId(null); }}
            className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            disabled={loading}
          >
            {ENTITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input
            type="text"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="输入实体 ID"
            className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            disabled={loading}
          />
          <Button onClick={handlePreview} disabled={loading || !entityId.trim()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <TriangleAlert className="size-4" />}
            预览影响
          </Button>
        </div>

        {preview && (
          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center gap-2">
              <Badge variant={preview.canWithdraw ? "default" : "secondary"}>
                {preview.canWithdraw ? "可撤回" : "存在依赖冲突"}
              </Badge>
              <span className="text-xs text-muted-foreground">影响 {preview.affectedEntityCount} 个实体</span>
            </div>

            {preview.blockers.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>阻止撤回</AlertTitle>
                <AlertDescription><ul className="list-disc pl-4 text-sm">{preview.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul></AlertDescription>
              </Alert>
            )}

            {preview.affectedEntities.length > 0 && (
              <div><h4 className="mb-1 text-sm font-medium">影响的实体：</h4><div className="flex flex-wrap gap-2">{preview.affectedEntities.map((e, i) => <Badge key={i} variant="outline">{e.entityLabel}</Badge>)}</div></div>
            )}

            {preview.canWithdraw && !withdrawn && (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="withdraw-reason">撤回原因</FieldLabel>
                  <Textarea id="withdraw-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="请说明撤回原因" />
                </Field>
                <div className="flex gap-2">
                  <Button onClick={handleConfirm} disabled={loading || !reason.trim()} variant="destructive">
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    确认撤回
                  </Button>
                  <Button variant="outline" onClick={() => { setPreview(null); setConfirmationId(null); }} disabled={loading}>
                    <X className="size-4" />取消
                  </Button>
                </div>
              </FieldGroup>
            )}

            {withdrawn && <Alert variant="default"><AlertTitle>已撤回</AlertTitle><AlertDescription>该内容已从普通视图中移除，审计记录已保存。</AlertDescription></Alert>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
