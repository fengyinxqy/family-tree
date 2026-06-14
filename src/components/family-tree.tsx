"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronUp,
  Clock3,
  FolderTree,
  GitBranch,
  Loader2,
  MapPinned,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  ScrollText,
  Sparkles,
  Trash2,
  Trees,
} from "lucide-react";
import { AgentPanel } from "@/components/agent-panel";
import { ImportExportPanel } from "@/components/import-export-panel";
import { PersonForm } from "@/components/person-form";
import { PersonNode } from "@/components/person-node";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildFamilyMaps,
  buildWorkspaceTimeline,
  getBranchPersonIds,
  getGenerationGroups,
  getRootPersonIds,
  getPersonNameMap,
} from "@/lib/family-graph";
import { layoutVertical } from "@/lib/tree-layout";
import { cn } from "@/lib/utils";
import { createFamilyTreeSpace, deleteFamilyTreeSpace, switchFamilyTreeSpace } from "@/services/family-tree-space.service";
import type { ActiveFamilyTreeSpace, FamilyTreeSpaceSummary } from "@/services/family-tree-space.service";
import type { RelationshipData, TreeEdge, TreeNode, WorkspacePersonData } from "@/types";


type WorkspaceView = "tree" | "table" | "timeline" | "branch";
type PanelState = "assistant" | "collapsed";

interface FamilyTreeProps {
  activeTree: ActiveFamilyTreeSpace;
  familyTrees: FamilyTreeSpaceSummary[];
  persons: WorkspacePersonData[];
  relationships: RelationshipData[];
  initialState: {
    view: WorkspaceView;
    personId: string | null;
    generation: string | null;
    panel: PanelState;
  };
}

function TreeSpaceSwitcher({
  activeTree,
  familyTrees,
}: {
  activeTree: ActiveFamilyTreeSpace;
  familyTrees: FamilyTreeSpaceSummary[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FamilyTreeSpaceSummary | null>(null);

  function handleSwitch(treeId: string) {
    if (treeId === activeTree.id || isPending) return;
    startTransition(async () => {
      await switchFamilyTreeSpace(treeId);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!deleteTarget || isPending) return;
    startTransition(async () => {
      try {
        await deleteFamilyTreeSpace(deleteTarget.id);
        toast.success(`已删除"${deleteTarget.name}"`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "删除失败");
      } finally {
        setDeleteTarget(null);
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/72 px-4 py-2.5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <FolderTree className="size-4" />
        当前家谱空间
      </div>
      <span className="text-sm font-semibold text-foreground">{activeTree.name}</span>

      <div className="flex flex-wrap items-center gap-2">
        {familyTrees.map((tree) => (
          <div key={tree.id} className="group relative inline-flex items-center">
            <Button
              type="button"
              size="sm"
              variant={tree.id === activeTree.id ? "default" : "outline"}
              disabled={isPending}
              onClick={() => handleSwitch(tree.id)}
              className={tree.id === activeTree.id ? "" : "pr-1"}
            >
              {tree.name}
              <span className="text-xs opacity-75">{tree.personCount} 人</span>
            </Button>
            {tree.id !== activeTree.id && familyTrees.length > 1 && (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(tree);
                }}
                className="ml-0.5 size-6 rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="size-3" />
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setDialogOpen(true)}
        >
          <Plus data-icon="inline-start" />
          新建空间
        </Button>
      </div>

      {isPending ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>新建家谱空间</DialogTitle>
            <DialogDescription>
              创建新的家谱空间来管理不同分支的家谱数据
            </DialogDescription>
          </DialogHeader>
          <form
            ref={formRef}
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              startTransition(async () => {
                await createFamilyTreeSpace(formData);
                formRef.current?.reset();
                setDialogOpen(false);
                router.refresh();
              });
            }}
          >
            <Input name="name" placeholder="新家谱名称" maxLength={40} required />
            <Input name="description" placeholder="备注（可选）" maxLength={120} />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus data-icon="inline-start" />
                )}
                创建
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
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
            确定要删除<span className="font-medium text-foreground">"{deleteTarget?.name}"</span>吗？该空间内的所有成员和关系数据将被一并删除。
          </p>

          <DialogFooter>
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteTarget(null)}
                disabled={isPending}
              >
                取消
              </Button>
              <Button
                onClick={handleDelete}
                disabled={isPending}
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isPending ? (
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
    </div>
  );
}
function minimapNodeColor(node: Node): string {
  const data = node.data as unknown as WorkspacePersonData | undefined;
  if (!data) return "oklch(0.7 0.05 70)";

  return data.gender === "male" ? "oklch(0.63 0.045 150)" : "oklch(0.64 0.055 42)";
}

function WorkspaceCanvas({
  persons,
  relationships,
  selectedPersonId,
  highlightedGenerationIds,
  onSelectPerson,
}: {
  persons: WorkspacePersonData[];
  relationships: RelationshipData[];
  selectedPersonId: string | null;
  highlightedGenerationIds: string[];
  onSelectPerson: (personId: string) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { setCenter, fitView } = useReactFlow();
  const focusRequestRef = useRef<"selected" | "generation" | null>("selected");
  const hasInitialFitRef = useRef(false);

  useEffect(() => {
    const layout = layoutVertical(persons, relationships) as { nodes: TreeNode[]; edges: TreeEdge[] };

    const flowNodes: Node[] = layout.nodes.map((node) => ({
      id: node.id,
      type: "person",
      position: node.position,
      data: {
        ...(node.data as unknown as Record<string, unknown>),
        highlighted:
          node.id === selectedPersonId ||
          (highlightedGenerationIds.length > 0 && highlightedGenerationIds.includes(node.id)),
      },
      draggable: true,
      selected: node.id === selectedPersonId,
    }));

    const flowEdges: Edge[] = layout.edges.map((edge) => {
      const isSpouse = edge.type === "spouse";
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: isSpouse ? "straight" : "smoothstep",
        label: edge.label || (isSpouse ? "配偶" : undefined),
        labelStyle: {
          fill: isSpouse ? "oklch(0.42 0.08 45)" : "oklch(0.39 0.032 70)",
          fontSize: 12,
          fontWeight: 600,
        },
        labelBgStyle: {
          fill: "color-mix(in oklch, var(--card) 90%, white 10%)",
          fillOpacity: 0.98,
        },
        labelBgPadding: [8, 4] as [number, number],
        labelBgBorderRadius: 999,
        style: {
          stroke: isSpouse ? "oklch(0.63 0.052 52)" : "oklch(0.74 0.024 74)",
          strokeWidth: isSpouse ? 1.8 : 1.5,
          strokeDasharray: isSpouse ? "8 4" : "none",
        },
      };
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [highlightedGenerationIds, persons, relationships, selectedPersonId, setEdges, setNodes]);

  useEffect(() => {
    focusRequestRef.current = selectedPersonId ? "selected" : highlightedGenerationIds.length > 0 ? "generation" : null;
  }, [highlightedGenerationIds, selectedPersonId]);

  useEffect(() => {
    if (nodes.length > 0 && !hasInitialFitRef.current) {
      fitView({ padding: 0.24 });
      hasInitialFitRef.current = true;
    }
  }, [fitView, nodes.length]);

  useEffect(() => {
    if (focusRequestRef.current === "selected" && selectedPersonId) {
      const targetNode = nodes.find((node) => node.id === selectedPersonId);
      if (targetNode) {
        setCenter(targetNode.position.x + 90, targetNode.position.y + 40, {
          zoom: 0.92,
          duration: 500,
        });
      }
      focusRequestRef.current = null;
      return;
    }

    if (focusRequestRef.current === "generation" && highlightedGenerationIds.length > 0) {
      const generationNodes = nodes.filter((node) => highlightedGenerationIds.includes(node.id));
      if (generationNodes.length > 0) {
        const centerX =
          generationNodes.reduce((sum, node) => sum + node.position.x + 90, 0) / generationNodes.length;
        const centerY =
          generationNodes.reduce((sum, node) => sum + node.position.y + 40, 0) / generationNodes.length;
        setCenter(centerX, centerY, {
          zoom: 0.78,
          duration: 500,
        });
      }
      focusRequestRef.current = null;
    }
  }, [highlightedGenerationIds, nodes, selectedPersonId, setCenter]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={{ person: PersonNode }}
      fitView={false}
      fitViewOptions={{ padding: 0.28 }}
      minZoom={0.12}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      className="bg-transparent"
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      onNodeClick={(_event, node) => {
        hasInitialFitRef.current = true;
        focusRequestRef.current = "selected";
        onSelectPerson(node.id);
      }}
      onNodeDragStop={async (_event, node) => {
        await fetch(`/api/persons/${node.id}/position`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x: node.position.x, y: node.position.y }),
        });
      }}
    >
      <Background gap={24} size={1} color="oklch(0.7 0.018 74 / 0.28)" />
      <Controls
        className="app-panel !rounded-2xl !border !border-border/70 !bg-card/88 !shadow-none"
        position="bottom-right"
      />
      <MiniMap
        nodeColor={minimapNodeColor}
        maskColor="oklch(0.92 0.012 86 / 0.58)"
        className="app-panel !rounded-2xl !border !border-border/70 !bg-card/88 !shadow-none"
        position="bottom-left"
        pannable
        zoomable
      />
    </ReactFlow>
  );
}

function TableView({
  persons,
  relationships,
  generationGroups,
  selectedPersonId,
  activeGeneration,
  onSelectPerson,
}: {
  persons: WorkspacePersonData[];
  relationships: RelationshipData[];
  generationGroups: ReturnType<typeof getGenerationGroups>;
  selectedPersonId: string | null;
  activeGeneration: string | null;
  onSelectPerson: (personId: string) => void;
}) {
  const { childrenMap, parentMap } = buildFamilyMaps(persons, relationships);
  const nameMap = getPersonNameMap(persons);

  return (
    <div className="space-y-4">
      {generationGroups
        .filter((group) => !activeGeneration || group.key === activeGeneration)
        .map((group) => (
          <Card key={group.key} className="border border-border/70 bg-card/82 shadow-none">
            <CardHeader>
              <CardTitle className="text-lg">{group.label}</CardTitle>
              <CardDescription>{group.personIds.length} 位成员</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/70 text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">成员</th>
                      <th className="px-3 py-2 font-medium">生卒</th>
                      <th className="px-3 py-2 font-medium">父母</th>
                      <th className="px-3 py-2 font-medium">子女数</th>
                      <th className="px-3 py-2 font-medium">详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.personIds.map((personId) => {
                      const person = persons.find((entry) => entry.id === personId);
                      if (!person) {
                        return null;
                      }

                      const parentNames = (parentMap.get(person.id) ?? []).map(
                        (parentId) => nameMap.get(parentId) ?? "未命名成员",
                      );

                      return (
                        <tr
                          key={person.id}
                          className={cn(
                            "border-b border-border/40 transition-colors last:border-b-0 hover:bg-background/70",
                            selectedPersonId === person.id && "bg-primary/8",
                          )}
                        >
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => onSelectPerson(person.id)}
                              className="font-medium text-foreground hover:text-primary"
                            >
                              {person.name}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">
                            {person.birthDate || "?"}
                            {person.deathDate ? ` - ${person.deathDate}` : ""}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">
                            {parentNames.length > 0 ? parentNames.join(" / ") : "未记录"}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">
                            {(childrenMap.get(person.id) ?? []).length}
                          </td>
                          <td className="px-3 py-3">
                            <Link href={`/person/${person.id}`} className="text-primary hover:underline">
                              查看档案
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}

function TimelineView({
  timeline,
  onSelectPerson,
}: {
  timeline: ReturnType<typeof buildWorkspaceTimeline>;
  onSelectPerson: (personId: string) => void;
}) {
  return (
    <div className="space-y-4">
      {timeline.length === 0 ? (
        <Card className="border border-dashed border-border/70 bg-card/70 shadow-none">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            当前筛选条件下还没有可展示的家族事件。
          </CardContent>
        </Card>
      ) : null}

      {timeline.map((entry) => (
        <Card key={entry.id} className="border border-border/70 bg-card/82 shadow-none">
          <CardContent className="flex flex-wrap items-start justify-between gap-4 py-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={entry.isSystem ? "secondary" : "outline"}>{entry.title}</Badge>
                <button
                  type="button"
                  onClick={() => onSelectPerson(entry.personId)}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {entry.personName}
                </button>
              </div>
              <p className="text-sm text-muted-foreground">{entry.description || entry.location || "暂无更多说明"}</p>
            </div>
            <div className="text-sm text-muted-foreground">{entry.dateLabel || "未标注时间"}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function FamilyTree({
  activeTree,
  familyTrees,
  persons,
  relationships,
  initialState,
}: FamilyTreeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [personFormOpen, setPersonFormOpen] = useState(false);
  const [view, setView] = useState<WorkspaceView>(initialState.view);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(initialState.personId);
  const [activeGeneration, setActiveGeneration] = useState<string | null>(initialState.generation);
  const [panel, setPanel] = useState<PanelState>(initialState.panel);
  const [headerCollapsed, setHeaderCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("family.workspace.headerCollapsed") === "true";
  });

  const generationGroups = useMemo(() => getGenerationGroups(persons, relationships), [persons, relationships]);
  const rootIds = useMemo(() => getRootPersonIds(persons, relationships), [persons, relationships]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const preferredView = window.localStorage.getItem("family.workspace.defaultView") as WorkspaceView | null;
    const preferredPanel = window.localStorage.getItem("family.workspace.panel") as PanelState | null;

    if (!initialState.personId && !initialState.generation && initialState.view === "tree" && preferredView && preferredView !== view) {
      applyWorkspaceState({ nextView: preferredView });
    }

    if (initialState.panel === "assistant" && preferredPanel === "collapsed") {
      applyWorkspaceState({ nextPanel: "collapsed" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedPerson =
    persons.find((person) => person.id === selectedPersonId) ?? null;
  const panelPerson = selectedPerson ?? persons[0] ?? null;

  const branchRootId = selectedPerson?.id ?? rootIds[0] ?? null;
  const branchPersonIds = useMemo(
    () => (branchRootId ? getBranchPersonIds(branchRootId, persons, relationships) : new Set<string>()),
    [branchRootId, persons, relationships],
  );
  const branchPersons = persons.filter((person) => branchPersonIds.has(person.id));
  const branchRelationships = relationships.filter(
    (relationship) => branchPersonIds.has(relationship.personAId) && branchPersonIds.has(relationship.personBId),
  );

  const highlightedGenerationIds =
    generationGroups.find((group) => group.key === activeGeneration)?.personIds ?? [];

  const timelineEntries = useMemo(
    () =>
      buildWorkspaceTimeline(persons, relationships, {
        selectedPersonId: view === "timeline" ? selectedPerson?.id ?? null : null,
        generationKey: activeGeneration,
        branchRootId: view === "branch" ? branchRootId : null,
      }),
    [activeGeneration, branchRootId, persons, relationships, selectedPerson, view],
  );

  const familyName = `${(rootIds[0] ? persons.find((person) => person.id === rootIds[0])?.name?.[0] : persons[0]?.name?.[0]) || "家"}氏家谱`;
  const ancestorName = persons.find((person) => person.id === rootIds[0])?.name ?? "未定始祖";

  function applyWorkspaceState({
    nextView = view,
    nextPersonId = selectedPersonId,
    nextGeneration = activeGeneration,
    nextPanel = panel,
  }: {
    nextView?: WorkspaceView;
    nextPersonId?: string | null;
    nextGeneration?: string | null;
    nextPanel?: PanelState;
  }) {
    setView(nextView);
    setSelectedPersonId(nextPersonId);
    setActiveGeneration(nextGeneration);
    setPanel(nextPanel);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("family.workspace.defaultView", nextView);
      window.localStorage.setItem("family.workspace.panel", nextPanel);
    }

    const params = new URLSearchParams();
    if (nextView !== "tree") params.set("view", nextView);
    if (nextPersonId) params.set("personId", nextPersonId);
    if (nextGeneration) params.set("generation", nextGeneration);
    if (nextPanel !== "assistant") params.set("panel", nextPanel);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function handleSelectPerson(personId: string) {
    applyWorkspaceState({ nextPersonId: personId, nextGeneration: null });
  }

  function renderMainView() {
    if (view === "table") {
      return (
        <TableView
          persons={persons}
          relationships={relationships}
          generationGroups={generationGroups}
          selectedPersonId={selectedPerson?.id ?? null}
          activeGeneration={activeGeneration}
          onSelectPerson={handleSelectPerson}
        />
      );
    }

    if (view === "timeline") {
      return <TimelineView timeline={timelineEntries} onSelectPerson={handleSelectPerson} />;
    }

    const canvasPersons = view === "branch" ? branchPersons : persons;
    const canvasRelationships = view === "branch" ? branchRelationships : relationships;

    return (
      <ReactFlowProvider>
        <WorkspaceCanvas
          persons={canvasPersons}
          relationships={canvasRelationships}
          selectedPersonId={selectedPerson?.id ?? null}
          highlightedGenerationIds={highlightedGenerationIds.filter((personId) =>
            canvasPersons.some((person) => person.id === personId),
          )}
          onSelectPerson={handleSelectPerson}
        />
      </ReactFlowProvider>
    );
  }

  return (
    <div className="flex w-full flex-1 overflow-hidden">
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 top-0 h-[380px] w-[380px] rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-[-12%] right-[-10%] h-[420px] w-[420px] rounded-full bg-secondary/35 blur-3xl" />
          <div
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                "linear-gradient(to right, transparent 0, transparent calc(100% - 1px), color-mix(in oklch, var(--border) 48%, transparent) calc(100% - 1px)), linear-gradient(to bottom, transparent 0, transparent calc(100% - 1px), color-mix(in oklch, var(--border) 44%, transparent) calc(100% - 1px))",
              backgroundSize: "120px 120px",
            }}
          />
        </div>

        <div className="relative z-10 flex h-full flex-col">
          <div className={cn(
            "border-b border-border/60 transition-all duration-300",
            headerCollapsed ? "px-6 py-2" : "px-6 pt-6 pb-4"
          )}>
            {/* Collapsed bar — always visible */}
            <div className={cn(
              "flex items-center justify-between gap-4",
              !headerCollapsed && "hidden"
            )}>
              <div className="flex items-center gap-4 min-w-0">
                <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground truncate">
                  {activeTree.name || familyName}
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{persons.length} 人</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setHeaderCollapsed(false);
                    window.localStorage.setItem("family.workspace.headerCollapsed", "false");
                  }}
                >
                  <ChevronDown className="size-4" />
                  展开
                </Button>
              </div>
            </div>

            {/* Expandable content — animated height */}
            <div className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-out",
              headerCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
            )}>
              <div className="overflow-hidden">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground">
                    {activeTree.name || familyName}
                  </h1>
                  <Badge variant="outline">私有空间</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  始祖：{ancestorName} · 现有成员：{persons.length} 人
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ImportExportPanel />
                <Button size="lg" onClick={() => setPersonFormOpen(true)}>
                  <Plus data-icon="inline-start" />
                  新增成员
                </Button>
              </div>
            </div>

            <TreeSpaceSwitcher activeTree={activeTree} familyTrees={familyTrees} />

            <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <Tabs value={view} onValueChange={(value) => applyWorkspaceState({ nextView: value as WorkspaceView })}>
                <TabsList className="grid w-full grid-cols-4 xl:w-[460px]">
                  <TabsTrigger value="tree">
                    <Trees data-icon="inline-start" />
                    树状图
                  </TabsTrigger>
                  <TabsTrigger value="table">
                    <ScrollText data-icon="inline-start" />
                    世系表
                  </TabsTrigger>
                  <TabsTrigger value="timeline">
                    <Clock3 data-icon="inline-start" />
                    时间轴
                  </TabsTrigger>
                  <TabsTrigger value="branch">
                    <GitBranch data-icon="inline-start" />
                    分支图
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{selectedPerson?.name ?? "未选中成员"}</Badge>
                <Button
                  variant="outline"
                  onClick={() =>
                    applyWorkspaceState({
                      nextView: view === "timeline" ? "tree" : view,
                      nextPersonId: selectedPerson?.id ?? rootIds[0] ?? null,
                    })
                  }
                >
                  <MapPinned data-icon="inline-start" />
                  定位到我
                </Button>
                <Button
                  variant="outline"
                  onClick={() => applyWorkspaceState({ nextPanel: panel === "assistant" ? "collapsed" : "assistant" })}
                >
                  {panel === "assistant" ? <PanelRightClose data-icon="inline-start" /> : <PanelRightOpen data-icon="inline-start" />}
                  {panel === "assistant" ? "收起助手" : "展开助手"}
                </Button>
                {view === "branch" ? (
                  <Button variant="outline" onClick={() => applyWorkspaceState({ nextView: "tree" })}>
                    <Sparkles data-icon="inline-start" />
                    返回全树
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex justify-center">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setHeaderCollapsed(true);
                  window.localStorage.setItem("family.workspace.headerCollapsed", "true");
                }}
              >
                <ChevronUp className="size-4" />
                收起
              </Button>
            </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
            <aside className="hidden w-28 shrink-0 border-r border-border/60 px-3 py-6 lg:block">
              <div className="app-panel flex h-full flex-col rounded-[1.8rem] border border-border/70 p-2">
                <div className="flex justify-center pb-2">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => {
                      if (!activeGeneration) {
                        return;
                      }
                      const currentIndex = generationGroups.findIndex((group) => group.key === activeGeneration);
                      const previous = generationGroups[Math.max(currentIndex - 1, 0)];
                      applyWorkspaceState({ nextGeneration: previous?.key ?? null, nextPersonId: null });
                    }}
                  >
                    <ChevronUp />
                  </Button>
                </div>
                <div className="app-scrollbar flex-1 space-y-2 overflow-y-auto px-1">
                  {generationGroups.map((group) => {
                    const active = activeGeneration === group.key;
                    return (
                      <button
                        key={group.key}
                        type="button"
                        onClick={() =>
                          applyWorkspaceState({
                            nextGeneration: active ? null : group.key,
                            nextPersonId: null,
                          })
                        }
                        className={cn(
                          "w-full rounded-[1.2rem] border px-2 py-3 text-sm transition-colors",
                          active
                            ? "border-primary/30 bg-primary text-primary-foreground"
                            : "border-border/60 bg-background/75 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <div className="text-xs opacity-80">{group.label}</div>
                        <div className="mt-1 font-medium">{group.personIds.length} 人</div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-center pt-2">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => {
                      if (!activeGeneration) {
                        return;
                      }
                      const currentIndex = generationGroups.findIndex((group) => group.key === activeGeneration);
                      const next = generationGroups[Math.min(currentIndex + 1, generationGroups.length - 1)];
                      applyWorkspaceState({ nextGeneration: next?.key ?? null, nextPersonId: null });
                    }}
                  >
                    <ChevronDown />
                  </Button>
                </div>
              </div>
            </aside>

            <div className="min-w-0 flex-1 px-4 py-4 sm:px-6 flex flex-col">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{persons.length} 位成员</Badge>
                <Badge variant="outline">{relationships.length} 条关系</Badge>
                <Badge variant="secondary">
                  <Bot data-icon="inline-start" />
                  固定右侧助手
                </Badge>
              </div>
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] border border-border/70 bg-card/36">
                <div className={cn("flex-1 min-h-0", view === "table" || view === "timeline" ? "overflow-auto p-4" : "")}>
                  {renderMainView()}
                </div>
              </div>
            </div>

            {panel === "assistant" ? (
              <aside className="hidden w-[420px] shrink-0 border-l border-border/60 p-4 xl:block">
                <AgentPanel
                  selectedPerson={panelPerson}
                  persons={persons}
                  relationships={relationships}
                  onDraftApplied={() => applyWorkspaceState({ nextPersonId: panelPerson?.id ?? null })}
                />
              </aside>
            ) : (
              <div className="hidden w-[88px] shrink-0 items-start justify-center pt-6 xl:flex">
                <Button
                  size="lg"
                  onClick={() => applyWorkspaceState({ nextPanel: "assistant" })}
                  className="shadow-[0_18px_40px_color-mix(in_oklch,var(--foreground)_14%,transparent)]"
                >
                  <Bot data-icon="inline-start" />
                  助手
                </Button>
              </div>
            )}
          </div>
        </div>

        <PersonForm open={personFormOpen} onClose={() => setPersonFormOpen(false)} />
      </div>
    </div>
  );
}
