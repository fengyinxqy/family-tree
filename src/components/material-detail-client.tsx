"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DragEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Download, File, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppPage } from "@/components/app-surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { SourceMaterialData } from "@/types";

type DetailMaterial = SourceMaterialData & { links: Array<SourceMaterialData["links"][number] & { label?: string | null }> };

const CATEGORY_LABELS: Record<string, string> = { genealogy: "族谱", document: "文献", photo: "照片", certificate: "证件", oral_history: "口述整理", other: "其他" };

type LinkablePerson = {
  id: string;
  name: string;
  events: Array<{ id: string; type: string; title: string | null; dateLabel: string | null }>;
};

export function MaterialDetailClient({ material, persons }: { material: DetailMaterial; persons: LinkablePerson[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const [uploading, setUploading] = useState(false);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [savingLinks, setSavingLinks] = useState(false);
  const [deletingFile, setDeletingFile] = useState<DetailMaterial["files"][number] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const initialTargets = useMemo(() => new Set(material.links.map((link) => link.personId ? `person:${link.personId}` : `event:${link.personEventId}`)), [material.links]);
  const [targets, setTargets] = useState(initialTargets);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.set("file", file);
        const response = await fetch(`/api/materials/${material.id}/files`, { method: "POST", body });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `${file.name} 上传失败`);
      }
      toast.success(`已上传 ${files.length} 个文件`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (!event.dataTransfer.types.includes("Files")) return;
    dragDepthRef.current += 1;
    setDraggingFiles(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDraggingFiles(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setDraggingFiles(false);
    if (!uploading) void uploadFiles(event.dataTransfer.files);
  }

  async function confirmDeleteFile() {
    if (!deletingFile) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/materials/files/${deletingFile.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "删除文件失败");
      toast.success("文件已从资料中移除");
      setDeletingFile(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除文件失败");
    } finally {
      setDeleting(false);
    }
  }

  async function moveFile(index: number, direction: -1 | 1) {
    const next = [...material.files];
    const targetIndex = index + direction;
    if (!next[targetIndex]) return;
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    const response = await fetch(`/api/materials/${material.id}/files`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileIds: next.map((file) => file.id) }) });
    const result = await response.json();
    if (!response.ok) return toast.error(result.error || "排序失败");
    router.refresh();
  }

  function toggleTarget(key: string, checked: boolean) {
    setTargets((current) => {
      const next = new Set(current);
      if (checked) next.add(key); else next.delete(key);
      return next;
    });
  }

  async function saveLinks() {
    setSavingLinks(true);
    try {
      const mapped = Array.from(targets).map((target) => target.startsWith("person:") ? { personId: target.slice(7) } : { personEventId: target.slice(6) });
      const response = await fetch(`/api/materials/${material.id}/links`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targets: mapped }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "保存关联失败");
      toast.success("资料关联已更新");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存关联失败");
    } finally {
      setSavingLinks(false);
    }
  }

  return (
    <AppPage>
      <div className="flex flex-col gap-6">
        <div><Button variant="ghost" render={<Link href="/documents" />}><ArrowLeft data-icon="inline-start" />返回资料库</Button></div>
        <Card><CardHeader><CardTitle className="text-2xl">{material.title}</CardTitle><CardDescription>{material.description || "暂无资料说明"}</CardDescription><div className="mt-2 flex flex-wrap gap-2"><Badge>{CATEGORY_LABELS[material.category]}</Badge>{material.eraLabel ? <Badge variant="secondary">{material.eraLabel}</Badge> : null}{material.source ? <Badge variant="outline">来源：{material.source}</Badge> : null}{material.contributor ? <Badge variant="outline">提供者：{material.contributor}</Badge> : null}</div></CardHeader></Card>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card><CardHeader><CardTitle>原始文件</CardTitle><CardDescription>支持 PDF、JPEG、PNG、WebP 与 TIFF，单个文件大小受服务器配置限制。</CardDescription></CardHeader><CardContent className="flex flex-col gap-3">
            {uploading ? <Progress value={65}><ProgressLabel>正在验证并保存文件</ProgressLabel><ProgressValue>{() => "处理中"}</ProgressValue></Progress> : null}
            {material.files.length === 0 ? <Empty className="border"><EmptyHeader><EmptyMedia variant="icon"><File /></EmptyMedia><EmptyTitle>尚未上传文件</EmptyTitle><EmptyDescription>上传扫描页、照片或 PDF，文件只通过授权接口访问。</EmptyDescription></EmptyHeader></Empty> : material.files.map((file, index) => <Card key={file.id} size="sm"><CardHeader><CardTitle className="truncate">{file.originalName}</CardTitle><CardDescription>{file.mimeType} · {(file.byteSize / 1024).toFixed(1)} KB</CardDescription></CardHeader><CardFooter className="gap-2"><Button size="sm" variant="outline" render={<a href={`/api/materials/files/${file.id}`} target="_blank" rel="noreferrer" />}>预览</Button><Button size="sm" variant="outline" render={<a href={`/api/materials/files/${file.id}?download=1`} />}><Download data-icon="inline-start" />下载</Button><Button size="icon-sm" variant="ghost" aria-label="上移文件" disabled={index === 0} onClick={() => void moveFile(index, -1)}><ArrowUp /></Button><Button size="icon-sm" variant="ghost" aria-label="下移文件" disabled={index === material.files.length - 1} onClick={() => void moveFile(index, 1)}><ArrowDown /></Button><Button size="icon-sm" variant="ghost" aria-label={`删除文件 ${file.originalName}`} onClick={() => setDeletingFile(file)}><Trash2 /></Button></CardFooter></Card>)}
          </CardContent><CardFooter
            className={cn("justify-between gap-4 border-t border-dashed transition-colors", draggingFiles && "bg-accent")}
            onDragEnter={handleDragEnter}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          ><div className="flex min-w-0 items-center gap-3"><Upload className="text-muted-foreground" /><div className="flex min-w-0 flex-col gap-1"><p className="text-sm font-medium">{draggingFiles ? "松开以上传文件" : "拖入文件，或手动选择"}</p><p className="text-xs text-muted-foreground">支持一次上传多个 PDF 或图片文件。</p></div></div><input ref={fileInputRef} id="material-files" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp,image/tiff" className="sr-only" disabled={uploading} onChange={(event) => void uploadFiles(event.target.files)} /><Button type="button" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>{uploading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Upload data-icon="inline-start" />}选择文件</Button></CardFooter></Card>

          <Card><CardHeader><CardTitle>人物与事件关联</CardTitle><CardDescription>没有任何勾选时，这条资料仍作为整棵家谱的公共资料保存。</CardDescription></CardHeader><CardContent><FieldGroup><FieldSet><FieldLegend>选择关联目标</FieldLegend>{persons.length === 0 ? <Empty><EmptyHeader><EmptyMedia variant="icon"><Link2 /></EmptyMedia><EmptyTitle>暂无人物</EmptyTitle><EmptyDescription>先在家族树中添加人物，再建立资料关联。</EmptyDescription></EmptyHeader></Empty> : persons.map((person) => <div key={person.id} className="flex flex-col gap-2 rounded-lg border p-3"><Field orientation="horizontal"><Checkbox id={`person-${person.id}`} checked={targets.has(`person:${person.id}`)} onCheckedChange={(checked) => toggleTarget(`person:${person.id}`, checked === true)} /><FieldLabel htmlFor={`person-${person.id}`}>{person.name}</FieldLabel></Field>{person.events.map((event) => <Field key={event.id} orientation="horizontal" className="pl-6"><Checkbox id={`event-${event.id}`} checked={targets.has(`event:${event.id}`)} onCheckedChange={(checked) => toggleTarget(`event:${event.id}`, checked === true)} /><FieldLabel htmlFor={`event-${event.id}`}>{event.title || event.type}{event.dateLabel ? ` · ${event.dateLabel}` : ""}</FieldLabel></Field>)}</div>)}</FieldSet></FieldGroup></CardContent><CardFooter><Button className="w-full" disabled={savingLinks} onClick={() => void saveLinks()}>{savingLinks ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Link2 data-icon="inline-start" />}保存关联</Button></CardFooter></Card>
        </div>
      </div>
      <Dialog open={deletingFile !== null} onOpenChange={(open) => { if (!open && !deleting) setDeletingFile(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除这个文件？</DialogTitle>
            <DialogDescription>
              “{deletingFile?.originalName}”将从资料详情、下载和导出中隐藏。原始对象会暂时保留用于审计与恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setDeletingFile(null)}>取消</Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void confirmDeleteFile()}>
              {deleting ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Trash2 data-icon="inline-start" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPage>
  );
}
