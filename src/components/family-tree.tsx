"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, ScrollText, Sparkles } from "lucide-react";
import { FamilyTreeAgentShell } from "./family-tree-agent-shell";
import { PersonForm } from "./person-form";
import { PersonNode } from "./person-node";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { layoutVertical } from "@/lib/tree-layout";
import type { PersonData, RelationshipData, TreeEdge, TreeNode } from "@/types";

const nodeTypes = { person: PersonNode };

interface FamilyTreeProps {
  persons: PersonData[];
  relationships: RelationshipData[];
}

function minimapNodeColor(node: Node): string {
  const data = node.data as unknown as PersonData | undefined;
  if (!data) return "oklch(0.7 0.05 70)";

  return data.gender === "male"
    ? "oklch(0.63 0.045 150)"
    : "oklch(0.64 0.055 42)";
}

function FamilyTreeInner({ persons, relationships }: FamilyTreeProps) {
  const [personFormOpen, setPersonFormOpen] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [shouldFit, setShouldFit] = useState(true);

  const applyLayout = useCallback(() => {
    if (persons.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const result: { nodes: TreeNode[]; edges: TreeEdge[] } = layoutVertical(
      persons,
      relationships,
    );

    const flowNodes: Node[] = result.nodes.map((node) => ({
      id: node.id,
      type: "person",
      position: node.position,
      data: node.data as unknown as Record<string, unknown>,
      draggable: true,
    }));

    const flowEdges: Edge[] = result.edges.map((edge) => {
      const isSpouse = edge.type === "spouse";

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: isSpouse ? "straight" : "smoothstep",
        animated: false,
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
  }, [persons, relationships, setEdges, setNodes]);

  useEffect(() => {
    applyLayout();
  }, [applyLayout]);

  useEffect(() => {
    if (nodes.length > 0 && shouldFit) {
      const timer = setTimeout(() => {
        setShouldFit(false);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [nodes.length, shouldFit]);

  return (
    <div className="flex h-[calc(100dvh-var(--app-header-height))] w-full overflow-hidden">
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 top-0 h-[380px] w-[380px] rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-[-10%] bottom-[-12%] h-[420px] w-[420px] rounded-full bg-secondary/35 blur-3xl" />
          <div
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                "linear-gradient(to right, transparent 0, transparent calc(100% - 1px), color-mix(in oklch, var(--border) 48%, transparent) calc(100% - 1px)), linear-gradient(to bottom, transparent 0, transparent calc(100% - 1px), color-mix(in oklch, var(--border) 44%, transparent) calc(100% - 1px))",
              backgroundSize: "120px 120px",
            }}
          />
        </div>

        <div className="absolute inset-x-0 top-0 z-20 flex flex-col gap-3 p-4 sm:p-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <Card className="app-panel w-full max-w-2xl border border-border/70 bg-card/78">
              <CardHeader className="gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <ScrollText strokeWidth={1.8} />
                  </div>
                  <div>
                    <CardTitle className="text-[1.15rem]">家族树谱</CardTitle>
                    <CardDescription className="text-balance">
                      以关系为轴整理家族成员，可拖拽节点微调位置，并通过右侧助手补录信息。
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{persons.length} 位成员</Badge>
                <Badge variant="outline">{relationships.length} 条关系</Badge>
                <Badge variant="secondary">
                  <Sparkles data-icon="inline-start" />
                  支持自然语言录入
                </Badge>
              </CardContent>
            </Card>

            <div className="flex items-center gap-2 self-start">
              <Button size="lg" onClick={() => setPersonFormOpen(true)}>
                <Plus data-icon="inline-start" strokeWidth={2} />
                新增成员
              </Button>
            </div>
          </div>
        </div>

        {persons.length === 0 ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
            <Card className="app-panel max-w-xl border border-border/70 bg-card/82 text-center">
              <CardHeader>
                <CardTitle>从第一位家族成员开始</CardTitle>
                <CardDescription className="text-balance">
                  你可以先手动新增人物，或直接打开家谱助手，用一段自然语言生成可确认的录入草稿。
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-center gap-2">
                <Button onClick={() => setPersonFormOpen(true)}>
                  <Plus data-icon="inline-start" />
                  新增成员
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView={shouldFit || nodes.length === 0}
          fitViewOptions={{ padding: 0.28 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          className="bg-transparent"
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          onNodeDragStop={async (_event, node) => {
            await fetch(`/api/persons/${node.id}/position`, {
              method: "PATCH",
              body: JSON.stringify({ x: node.position.x, y: node.position.y }),
              headers: { "Content-Type": "application/json" },
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

        <PersonForm open={personFormOpen} onClose={() => setPersonFormOpen(false)} />
      </div>

      <FamilyTreeAgentShell />
    </div>
  );
}

export default function FamilyTree({
  persons,
  relationships,
}: FamilyTreeProps) {
  return (
    <ReactFlowProvider>
      <FamilyTreeInner persons={persons} relationships={relationships} />
    </ReactFlowProvider>
  );
}
