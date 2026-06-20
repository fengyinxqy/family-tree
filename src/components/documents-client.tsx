"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Archive, FileText, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { MaterialCategory, SourceMaterialData } from "@/types";

const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  genealogy: "族谱",
  document: "文献",
  photo: "照片",
  certificate: "证件",
  oral_history: "口述整理",
  other: "其他",
};

type MaterialListResponse = { items: SourceMaterialData[]; total: number; page: number; pageSize: number };
type MaterialDraft = Pick<SourceMaterialData, "title" | "category" | "source" | "eraLabel" | "contributor" | "description">;

const EMPTY_DRAFT: MaterialDraft = { title: "", category: "genealogy", source: null, eraLabel: null, contributor: null, description: null };

export function DocumentsClient() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<MaterialListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<SourceMaterialData | null | "new">(null);
  const [draft, setDraft] = useState<MaterialDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<SourceMaterialData | null>(null);
  const [confirmationId, setConfirmationId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), q: query, category });
      const response = await fetch(`/api/materials?${params}`, { signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "读取资料失败");
      setData(result);
    } catch (loadError) {
      if ((loadError as Error).name !== "AbortError") setError(loadError instanceof Error ? loadError.message : "读取资料失败");
    } finally {
      setLoading(false);
    }
  }, [category, page, query]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void load(controller.signal));
    return () => controller.abort();
  }, [load]);

  function openEditor(material?: SourceMaterialData) {
    setEditing(material ?? "new");
    setDraft(material ? { title: material.title, category: material.category, source: material.source, eraLabel: material.eraLabel, contributor: material.contributor, description: material.description } : EMPTY_DRAFT);
  }

  async function saveMaterial() {
    setSaving(true);
    try {
      const url = editing === "new" ? "/api/materials" : `/api/materials/${editing?.id}`;
      const response = await fetch(url, { method: editing === "new" ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败");
      toast.success(editing === "new" ? "资料已创建" : "资料已更新");
      setEditing(null);
      await load();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function beginDelete(material: SourceMaterialData) {
    try {
      const response = await fetch(`/api/materials/${material.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "无法预览删除影响");
      setDeleting(material);
      setConfirmationId(result.confirmationId);
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "无法预览删除影响");
    }
  }

  async function confirmDelete() {
    if (!deleting || !confirmationId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/materials/${deleting.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmationId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "删除失败");
      toast.success("资料已移入可恢复记录");
      setDeleting(null);
      setConfirmationId(null);
      await load();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "删除失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {searchParams.get("restored") === "1" ? (
        <Alert><Archive /><AlertTitle>资料已恢复</AlertTitle><AlertDescription>条目、文件与人物关联已经重新进入当前家谱。</AlertDescription></Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>资料库</CardTitle>
          <CardDescription>按标题、来源或提供者检索当前家谱的资料。</CardDescription>
          <CardAction><Button onClick={() => openEditor()}><Plus data-icon="inline-start" />新建资料</Button></CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="搜索资料" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="搜索标题、来源或提供者" className="pl-8" />
          </div>
          <Select value={category} onValueChange={(value) => { setCategory(value ?? "all"); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue>{category === "all" ? "全部类型" : CATEGORY_LABELS[category as MaterialCategory]}</SelectValue></SelectTrigger>
            <SelectContent><SelectGroup><SelectItem value="all">全部类型</SelectItem>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error ? <Alert variant="destructive"><AlertTitle>无法读取资料</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-48" />)}</div> : null}
      {!loading && !error && data?.items.length === 0 ? (
        <Empty className="min-h-64 border"><EmptyHeader><EmptyMedia variant="icon"><FileText /></EmptyMedia><EmptyTitle>还没有资料</EmptyTitle><EmptyDescription>创建第一条资料，再上传扫描件或照片并关联人物。</EmptyDescription></EmptyHeader><EmptyContent><Button onClick={() => openEditor()}><Plus data-icon="inline-start" />新建资料</Button></EmptyContent></Empty>
      ) : null}
      {!loading && data?.items.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((material) => (
            <Card key={material.id}>
              <CardHeader><CardTitle className="truncate">{material.title}</CardTitle><CardDescription>{material.source || "未记录来源"}</CardDescription><CardAction><Badge variant="secondary">{CATEGORY_LABELS[material.category]}</Badge></CardAction></CardHeader>
              <CardContent className="flex flex-col gap-3"><p className="line-clamp-3 min-h-15 text-sm text-muted-foreground">{material.description || "暂无说明"}</p><div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{material.files.length} 个文件</span><span>{material.links.length} 条关联</span>{material.eraLabel ? <span>{material.eraLabel}</span> : null}</div></CardContent>
              <CardFooter className="gap-2"><Button render={<Link href={`/documents/${material.id}`} />} className="flex-1">查看资料</Button><Button variant="outline" size="icon" aria-label="编辑资料" onClick={() => openEditor(material)}><Pencil /></Button><Button variant="outline" size="icon" aria-label="删除资料" onClick={() => void beginDelete(material)}><Trash2 /></Button></CardFooter>
            </Card>
          ))}
        </div>
      ) : null}

      {data && data.total > data.pageSize ? <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">共 {data.total} 条资料</p><div className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>上一页</Button><Button variant="outline" disabled={page * data.pageSize >= data.total} onClick={() => setPage((value) => value + 1)}>下一页</Button></div></div> : null}

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent><DialogHeader><DialogTitle>{editing === "new" ? "新建资料" : "编辑资料"}</DialogTitle><DialogDescription>描述资料来源和年代；文件与人物关联可在详情页继续维护。</DialogDescription></DialogHeader>
          <FieldGroup><Field><FieldLabel htmlFor="material-title">标题</FieldLabel><Input id="material-title" value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} /></Field><Field><FieldLabel>类型</FieldLabel><Select value={draft.category} onValueChange={(value) => setDraft((current) => ({ ...current, category: value as MaterialCategory }))}><SelectTrigger className="w-full"><SelectValue>{CATEGORY_LABELS[draft.category]}</SelectValue></SelectTrigger><SelectContent><SelectGroup>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="material-source">来源</FieldLabel><Input id="material-source" value={draft.source ?? ""} onChange={(event) => setDraft((value) => ({ ...value, source: event.target.value || null }))} /></Field><Field><FieldLabel htmlFor="material-era">年代</FieldLabel><Input id="material-era" value={draft.eraLabel ?? ""} onChange={(event) => setDraft((value) => ({ ...value, eraLabel: event.target.value || null }))} /></Field></div><Field><FieldLabel htmlFor="material-contributor">提供者</FieldLabel><Input id="material-contributor" value={draft.contributor ?? ""} onChange={(event) => setDraft((value) => ({ ...value, contributor: event.target.value || null }))} /></Field><Field><FieldLabel htmlFor="material-description">说明</FieldLabel><Textarea id="material-description" value={draft.description ?? ""} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value || null }))} /></Field></FieldGroup>
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>取消</Button><Button disabled={saving || !draft.title.trim()} onClick={() => void saveMaterial()}>{saving ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}保存</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}><DialogContent><DialogHeader><DialogTitle>确认删除资料</DialogTitle><DialogDescription>“{deleting?.title}”及其文件和人物关联会从普通视图隐藏，但仍可通过操作记录恢复。</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleting(null)}>取消</Button><Button variant="destructive" disabled={saving} onClick={() => void confirmDelete()}>确认删除</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
