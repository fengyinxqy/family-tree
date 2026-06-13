"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus } from "lucide-react";
import { FamilyTreeAgentShell } from "./family-tree-agent-shell";
import { PersonNode } from "./person-node";
import { PersonForm } from "./person-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { layoutVertical } from "@/lib/tree-layout";
import type { PersonData, RelationshipData, TreeNode, TreeEdge } from "@/types";

const nodeTypes = { person: PersonNode };

interface FamilyTreeProps {
  persons: PersonData[];
  relationships: RelationshipData[];
}

function minimapNodeColor(node: Node): string {
  const data = node.data as unknown as PersonData | undefined;
  if (!data) return "#d4a574";
  return data.gender === "male" ? "#60a5fa" : "#f472b6";
}

function FamilyTreeInner({ persons, relationships }: FamilyTreeProps) {
  const [personFormOpen, setPersonFormOpen] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const applyLayout = useCallback(() => {
    if (persons.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const result: { nodes: TreeNode[]; edges: TreeEdge[] } =
      layoutVertical(persons, relationships);

    const flowNodes: Node[] = result.nodes.map((node) => ({
      id: node.id,
      type: "person",
      position: node.position,
      data: node.data as unknown as Record<string, unknown>,
      draggable: true,
    }));

    const flowEdges: Edge[] = result.edges.map((edge) => {
      const edgeLabel = edge.label || (edge.type === "spouse" ? "配偶" : undefined);
      const isSpouse = edge.type === "spouse";
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: isSpouse ? "straight" : "smoothstep",
        animated: false,
        label: edgeLabel,
        labelStyle: {
          fill: isSpouse ? "#f59e0b" : "#6366f1",
          fontSize: 12,
          fontWeight: 500,
        },
        labelBgStyle: { fill: "#fff", fillOpacity: 0.9 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
        style: {
          stroke: isSpouse ? "#f59e0b" : "#94a3b8",
          strokeWidth: 1.5,
          strokeDasharray: isSpouse ? "6 4" : "none",
        },
      };
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [persons, relationships, setNodes, setEdges]);

  useEffect(() => {
    applyLayout();
  }, [applyLayout]);

  const [shouldFit, setShouldFit] = useState(true);
  useEffect(() => {
    if (nodes.length > 0 && shouldFit) {
      const timer = setTimeout(() => {
        setShouldFit(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, shouldFit]);

  const handleClosePersonForm = useCallback(() => {
    setPersonFormOpen(false);
  }, []);

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden">
      <div className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 -top-20 h-[400px] w-[400px] rounded-full bg-amber-100/15 blur-3xl dark:bg-amber-800/5" />
          <div className="absolute -bottom-20 -right-20 h-[350px] w-[350px] rounded-full bg-stone-100/20 blur-3xl dark:bg-stone-800/5" />
          <div
            className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
            style={{
              backgroundImage:
                "radial-gradient(circle, currentColor 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
          <Button onClick={() => setPersonFormOpen(true)}>
            <Plus data-icon="inline-start" strokeWidth={2} />
            新增人物
          </Button>
        </div>

        {persons.length === 0 && (
          <div className="absolute inset-0 z-40 flex items-center justify-center px-6">
            <Card className="max-w-md border border-border/80 bg-background/90 shadow-xl backdrop-blur">
              <CardHeader>
                <CardTitle>家族树还是空的</CardTitle>
                <CardDescription>
                  你可以先手动新增人物，也可以直接打开 Agent，用自然语言开始录入。
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView={shouldFit || nodes.length === 0}
          fitViewOptions={{ padding: 0.3 }}
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
          <Background
            gap={24}
            size={1}
            color="oklch(0.87 0 0 / 0.3)"
          />

          <Controls
            className="!rounded-xl !border !border-border !bg-white/80 !backdrop-blur !shadow-lg !shadow-zinc-200/30 dark:!bg-zinc-800/80 dark:!shadow-zinc-900/60"
            position="bottom-right"
          />

          <MiniMap
            nodeColor={minimapNodeColor}
            maskColor="oklch(0 0 0 / 0.05)"
            className="!rounded-xl !border !border-border !bg-white/80 !backdrop-blur !shadow-lg !shadow-zinc-200/30 dark:!bg-zinc-800/80 dark:!shadow-zinc-900/60"
            position="bottom-left"
            pannable
            zoomable
          />
        </ReactFlow>

        <PersonForm
          open={personFormOpen}
          onClose={handleClosePersonForm}
        />
      </div>

      <FamilyTreeAgentShell />
    </div>
  );
}

export default function FamilyTree({ persons, relationships }: FamilyTreeProps) {
  return (
    <ReactFlowProvider>
      <FamilyTreeInner persons={persons} relationships={relationships} />
    </ReactFlowProvider>
  );
}
