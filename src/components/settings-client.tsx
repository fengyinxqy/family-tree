"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import { Bot, PanelsTopLeft, Trees, RotateCcw, Camera, History, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { AppPanel } from "@/components/app-surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getRecoverableDeletionBatches,
  restoreDeletionBatch,
} from "@/services/person.service";
import {
  createSnapshot,
  getSnapshotList,
  previewSnapshotRestore,
  executeSnapshotRestore,
} from "@/services/snapshot.service";
import { getOperationHistoryForCurrentUser } from "@/services/operation-history.service";

const VIEW_OPTIONS = [
  { value: "tree", label: "树状图" },
  { value: "table", label: "世系表" },
  { value: "timeline", label: "时间轴" },
  { value: "branch", label: "分支图" },
] as const;

type DefaultView = (typeof VIEW_OPTIONS)[number]["value"];
type PanelState = "assistant" | "collapsed";

interface AuditEntry {
  entityType: string;
  entityId: string;
  action: string;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
}

interface OpHistoryItem {
  id: string;
  action: string;
  status: string;
  summary: Record<string, unknown>;
  actorId: string;
  createdAt: Date;
  entryCount: number;
  entries: AuditEntry[];
}

interface DeletionBatch {
  id: string;
  action: string;
  status: string;
  summary: Record<string, unknown>;
  createdAt: Date;
}

interface SnapshotItem {
  id: string;
  reason: string;
  version: number;
  sourceRevision: number;
  personCount: number;
  relationshipCount: number;
  eventCount: number;
  createdAt: Date;
}

export function SettingsClient({ canManageRecovery }: { canManageRecovery: boolean }) {
  const [defaultView, setDefaultView] = useState<DefaultView>("tree");
  const [panelState, setPanelState] = useState<PanelState>("assistant");

  const [deletionBatches, setDeletionBatches] = useState<DeletionBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [restoringBatchId, setRestoringBatchId] = useState<string | null>(null);

  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState<string | null>(null);

  const [opHistory, setOpHistory] = useState<OpHistoryItem[]>([]);
  const [opTotal, setOpTotal] = useState(0);
  const [opPage, setOpPage] = useState(1);
  const [loadingOps, setLoadingOps] = useState(false);
  const [expandedOpId, setExpandedOpId] = useState<string | null>(null);
  const PAGE_SIZE = 20;

  function persistView(nextView: DefaultView) { setDefaultView(nextView); window.localStorage.setItem("family.workspace.defaultView", nextView); }
  function persistPanel(nextPanel: PanelState) { setPanelState(nextPanel); window.localStorage.setItem("family.workspace.panel", nextPanel); }

  const loadDeletionBatches = useCallback(() => {
    startTransition(() => setLoadingBatches(true));
    return (async () => {
    try { setDeletionBatches(await getRecoverableDeletionBatches()); } catch (e) { console.error(e); } finally { setLoadingBatches(false); }
    })();
  }, []);

  const loadSnapshots = useCallback(() => {
    startTransition(() => setLoadingSnapshots(true));
    return (async () => {
    try { setSnapshots(await getSnapshotList()); } catch (e) { console.error(e); } finally { setLoadingSnapshots(false); }
    })();
  }, []);

  const loadOpHistory = useCallback((page: number) => {
    startTransition(() => setLoadingOps(true));
    return (async () => {
    try {
      const result = await getOperationHistoryForCurrentUser(page, PAGE_SIZE);
      setOpHistory(result.items);
      setOpTotal(result.total);
      setOpPage(result.page);
    } catch (e) { console.error(e); } finally { setLoadingOps(false); }
    })();
  }, []);

  useEffect(() => {
    const storedView = window.localStorage.getItem("family.workspace.defaultView");
    const storedPanel = window.localStorage.getItem("family.workspace.panel");
    queueMicrotask(() => {
      if (VIEW_OPTIONS.some((option) => option.value === storedView)) setDefaultView(storedView as DefaultView);
      if (storedPanel === "assistant" || storedPanel === "collapsed") setPanelState(storedPanel);
    });
    if (canManageRecovery) {
      loadDeletionBatches();
      loadSnapshots();
      loadOpHistory(1);
    }
  }, [canManageRecovery, loadDeletionBatches, loadSnapshots, loadOpHistory]);

  async function handleRestoreBatch(batchId: string) {
    setRestoringBatchId(batchId);
    try { await restoreDeletionBatch(batchId); toast.success("删除批次已恢复"); await loadDeletionBatches(); await loadOpHistory(opPage); }
    catch (e) { toast.error(e instanceof Error ? e.message : "恢复失败"); }
    finally { setRestoringBatchId(null); }
  }

  async function handleCreateSnapshot() {
    setCreatingSnapshot(true);
    try { await createSnapshot("manual"); toast.success("快照创建成功"); await loadSnapshots(); await loadOpHistory(opPage); }
    catch (e) { toast.error(e instanceof Error ? e.message : "创建快照失败"); }
    finally { setCreatingSnapshot(false); }
  }

  async function handleRestoreSnapshot(snapshotId: string) {
    setRestoringSnapshotId(snapshotId);
    try {
      const { preview, confirmationId } = await previewSnapshotRestore(snapshotId);
      if (window.confirm("确认恢复到快照？\n" + "人物: " + preview.preview.personCount + "  关系: " + preview.preview.relationshipCount + "\n\n" + preview.preview.warning) && confirmationId) {
        await executeSnapshotRestore(confirmationId, snapshotId);
        toast.success("快照恢复完成"); await loadSnapshots(); await loadOpHistory(opPage);
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "恢复失败"); }
    finally { setRestoringSnapshotId(null); }
  }

  const reasonLabel = (r: string) => ({ manual: "手动", pre_import: "导入前", pre_restore: "恢复前" }[r] ?? r);
  const actionLabel = (a: string) => ({
    person_create: "新建人物", person_update: "修改人物", person_delete: "人物删除", person_restore: "恢复人物",
    relationship_create: "新建关系", relationship_delete: "关系删除", relationship_restore: "恢复关系",
    revision_group_create: "修订组创建", revision_group_submit: "提交修订组", revision_group_review: "审校修订组", revision_group_publish: "发布修订组",
    content_revision_publish: "发布修订", content_withdrawal: "撤回内容",
    revision_create: "创建修订", revision_submit: "提交修订",
    import: "导入数据", snapshot_restore: "快照恢复",
  }[a] ?? a);

  const entityLabel = (t: string) => ({ person: "人物", relationship: "关系", person_event: "事件", snapshot: "快照", content_revision: "修订", revision_group: "修订组", revision_provenance: "来源", review_decision: "审校决定", source_material: "文献资料", media_object: "媒体文件", material_link: "资料关联" }[t] ?? t);
  const entryActionLabel = (a: string) => ({ create: "创建", update: "修改", delete: "删除", restore: "恢复", snapshot_create: "创建快照" }[a] ?? a);

  function renderEntryText(entry: AuditEntry): string {
    const entity = entityLabel(entry.entityType);
    const act = entryActionLabel(entry.action);
    // Use afterJson name if available, otherwise entityId
    const name = (entry.afterJson as Record<string,unknown>)?.name || (entry.beforeJson as Record<string,unknown>)?.name;
    if (name) return act + entity + " “" + name + "”";
    // For relationships, show type
    const type = (entry.afterJson as Record<string,unknown>)?.type || (entry.beforeJson as Record<string,unknown>)?.type;
    if (type) return act + entity + " (" + type + ")";
    return act + entity + " #" + entry.entityId.slice(0, 8);
  }

  const totalPages = Math.max(1, Math.ceil(opTotal / PAGE_SIZE));

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <AppPanel className="p-1.5">
        <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Trees className="size-5" /></div>
            <div><h2 className="text-xl font-semibold text-foreground">默认工作台视图</h2><p className="text-sm text-muted-foreground">当你打开家谱页且 URL 没有指定视图时，优先进入这里设置的默认视图。</p></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {VIEW_OPTIONS.map((o) => (<Button key={o.value} variant={defaultView === o.value ? "default" : "outline"} onClick={() => persistView(o.value)}>{o.label}</Button>))}
          </div>
        </div>
      </AppPanel>
      <AppPanel className="p-1.5">
        <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Bot className="size-5" /></div>
            <div><h2 className="text-xl font-semibold text-foreground">助手面板状态</h2><p className="text-sm text-muted-foreground">默认决定工作台右侧助手是展开还是折叠。</p></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant={panelState === "assistant" ? "default" : "outline"} onClick={() => persistPanel("assistant")}>展开助手</Button>
            <Button variant={panelState === "collapsed" ? "default" : "outline"} onClick={() => persistPanel("collapsed")}>默认折叠</Button>
          </div>
        </div>
      </AppPanel>
      {canManageRecovery ? <>
      <AppPanel className="p-1.5 xl:col-span-2">
        <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-600"><RotateCcw className="size-5" /></div>
              <div><h2 className="text-xl font-semibold text-foreground">数据恢复</h2><p className="text-sm text-muted-foreground">查看和恢复近期删除的人物与关系。</p></div>
            </div>
            <Button variant="outline" size="sm" onClick={loadDeletionBatches} disabled={loadingBatches}>{loadingBatches ? "加载中..." : "刷新"}</Button>
          </div>
          <div className="mt-4">
            {deletionBatches.length === 0 ? <p className="text-sm text-muted-foreground">暂无可恢复的删除记录。</p> : (
              <div className="space-y-2">
                {deletionBatches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{actionLabel(b.action)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleString("zh-CN")}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleRestoreBatch(b.id)} disabled={restoringBatchId === b.id || b.status === "restored"}>
                      {restoringBatchId === b.id ? "恢复中..." : b.status === "restored" ? "已恢复" : "恢复"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </AppPanel>
      <AppPanel className="p-1.5 xl:col-span-2">
        <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-600"><Camera className="size-5" /></div>
              <div><h2 className="text-xl font-semibold text-foreground">数据快照</h2><p className="text-sm text-muted-foreground">创建和恢复家谱数据快照，安全地进行破坏性操作。</p></div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleCreateSnapshot} disabled={creatingSnapshot}>{creatingSnapshot ? "创建中..." : "创建快照"}</Button>
              <Button variant="outline" size="sm" onClick={loadSnapshots} disabled={loadingSnapshots}>{loadingSnapshots ? "加载中..." : "刷新"}</Button>
            </div>
          </div>
          <div className="mt-4">
            {snapshots.length === 0 ? <p className="text-sm text-muted-foreground">暂无快照记录。</p> : (
              <div className="space-y-2">
                {snapshots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2"><Badge variant="secondary">{reasonLabel(s.reason)}</Badge><span className="text-sm font-medium">{s.personCount}人 / {s.relationshipCount}关系 / {s.eventCount}事件</span></div>
                      <p className="text-xs text-muted-foreground">修订号: {s.sourceRevision} | {new Date(s.createdAt).toLocaleString("zh-CN")}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleRestoreSnapshot(s.id)} disabled={restoringSnapshotId === s.id}>{restoringSnapshotId === s.id ? "恢复中..." : "恢复"}</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </AppPanel>
      <AppPanel className="p-1.5 xl:col-span-2">
        <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600"><History className="size-5" /></div>
              <div><h2 className="text-xl font-semibold text-foreground">操作记录</h2><p className="text-sm text-muted-foreground">记录所有关键操作的详细信息。</p></div>
            </div>
            <Button variant="outline" size="sm" onClick={() => loadOpHistory(1)} disabled={loadingOps}>{loadingOps ? "加载中..." : "刷新"}</Button>
          </div>
          <div className="mt-4">
            {opHistory.length === 0 ? <p className="text-sm text-muted-foreground">暂无操作记录。</p> : (
              <>
                <div className="space-y-2">
                  {opHistory.map((op) => {
                    const isExpanded = expandedOpId === op.id;
                    return (
                      <div key={op.id} className="rounded-lg border border-border/60 bg-muted/20">
                        <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30" onClick={() => setExpandedOpId(isExpanded ? null : op.id)}>
                          <div className="space-y-0.5 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{actionLabel(op.action)}</Badge>
                              <span className="text-xs text-muted-foreground">{op.entryCount} 条目</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{new Date(op.createdAt).toLocaleString("zh-CN")}</p>
                          </div>
                          {isExpanded ? <ChevronUp className="size-4 text-muted-foreground shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground shrink-0" />}
                        </div>
                        {isExpanded && (
                          <div className="border-t border-border/40 px-4 py-3 space-y-1.5">
                            {op.entries.length === 0 && <p className="text-xs text-muted-foreground">无详细条目</p>}
                            {op.entries.map((entry, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">•</span>
                                <span>{renderEntryText(entry)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{opTotal} 条记录，第 {opPage}/{totalPages} 页</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => loadOpHistory(opPage - 1)} disabled={opPage <= 1 || loadingOps}>上一页</Button>
                      <Button variant="outline" size="sm" onClick={() => loadOpHistory(opPage + 1)} disabled={opPage >= totalPages || loadingOps}>下一页</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </AppPanel>
      </> : (
        <AppPanel className="p-1.5 xl:col-span-2">
          <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-6">
            <h2 className="text-xl font-semibold text-foreground">所有者工具</h2>
            <p className="mt-2 text-sm text-muted-foreground">数据恢复、快照和操作审计仅家族所有者可用。</p>
          </div>
        </AppPanel>
      )}
      <AppPanel className="p-1.5 xl:col-span-2">
        <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><PanelsTopLeft className="size-5" /></div>
            <div><h2 className="text-xl font-semibold text-foreground">当前偏好摘要</h2><p className="text-sm text-muted-foreground">这些设置会在没有显式 query 参数时应用到族谱工作台。</p></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Badge variant="secondary">默认视图：{VIEW_OPTIONS.find((o) => o.value === defaultView)?.label}</Badge>
            <Badge variant="secondary">助手状态：{panelState === "assistant" ? "展开" : "折叠"}</Badge>
          </div>
        </div>
      </AppPanel>
    </div>
  );
}
