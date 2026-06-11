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
import { Plus, ArrowLeftRight } from "lucide-react";
import { PersonNode } from "./person-node";
import { PersonForm } from "./person-form";
import { layoutVertical, layoutHorizontal } from "@/lib/tree-layout";
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
  const [layoutMode, setLayoutMode] = useState<"vertical" | "horizontal">("vertical");
  const [personFormOpen, setPersonFormOpen] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Compute layout whenever data or orientation changes
  const applyLayout = useCallback(() => {
    if (persons.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const result: { nodes: TreeNode[]; edges: TreeEdge[] } =
      layoutMode === "vertical"
        ? layoutVertical(persons, relationships)
        : layoutHorizontal(persons, relationships);

    // Map TreeNode[] to React Flow Node[]
    const flowNodes: Node[] = result.nodes.map((n) => ({
      id: n.id,
      type: "person",
      position: n.position,
      data: n.data as unknown as Record<string, unknown>,
      draggable: true,
    }));

    // Map TreeEdge[] to React Flow Edge[]
    const flowEdges: Edge[] = result.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      animated: false,
      label: e.type === "spouse" ? "配偶" : undefined,
      labelStyle: { fill: "#f59e0b", fontSize: 12, fontWeight: 500 },
      labelBgStyle: { fill: "#fff", fillOpacity: 0.9 },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 4,
      style: {
        stroke: e.type === "spouse" ? "#f59e0b" : "#94a3b8",
        strokeWidth: e.type === "spouse" ? 1.5 : 1.5,
        strokeDasharray: e.type === "spouse" ? "6 4" : "none",
      },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [persons, relationships, layoutMode, setNodes, setEdges]);

  // Apply layout on mount and when data changes
  useEffect(() => {
    applyLayout();
  }, [applyLayout]);

  // Fit view after nodes are set
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
    <div className="relative h-[calc(100vh-64px)] w-full">
      {/* Background atmosphere */}
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

      {/* Toolbar overlay */}
      <div className="absolute left-4 top-4 z-50 flex items-center gap-2">
        {/* Add person button */}
        <button
          onClick={() => setPersonFormOpen(true)}
          className="
            inline-flex items-center gap-2 px-4 py-2.5
            rounded-xl
            bg-gradient-to-r from-amber-600 to-amber-700
            text-sm font-medium text-white
            shadow-lg shadow-amber-900/15
            ring-1 ring-amber-700/20
            transition-all duration-200
            hover:from-amber-700 hover:to-amber-800
            hover:shadow-xl hover:shadow-amber-900/20
            dark:from-amber-600 dark:to-amber-700
            dark:hover:from-amber-500 dark:hover:to-amber-600
            dark:ring-amber-400/10
          "
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          新增人物
        </button>

        {/* Layout toggle button */}
        <button
          onClick={() =>
            setLayoutMode((prev) =>
              prev === "vertical" ? "horizontal" : "vertical",
            )
          }
          className="
            inline-flex items-center gap-2 px-4 py-2.5
            rounded-xl
            bg-white/80 dark:bg-zinc-800/80
            backdrop-blur
            border border-border
            text-sm font-medium text-foreground
            shadow-md shadow-zinc-200/40 dark:shadow-zinc-900/60
            transition-all duration-200
            hover:bg-white dark:hover:bg-zinc-800
            hover:shadow-lg
            hover:border-amber-300/60 dark:hover:border-amber-600/30
          "
        >
          <ArrowLeftRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          {layoutMode === "vertical" ? "横向" : "纵向"}
        </button>
      </div>

      {/* Empty state */}
      {persons.length === 0 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-100 to-amber-200 shadow-xl shadow-amber-200/30 dark:from-amber-900/30 dark:to-amber-800/20 dark:shadow-amber-900/10">
              <svg
                className="h-10 w-10 text-amber-500 dark:text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
            </div>
            <div>
              <p className="text-lg font-medium text-foreground">
                家族树是空的
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                点击上方"新增人物"按钮，开始构建您的家族树
              </p>
            </div>
          </div>
        </div>
      )}

      {/* React Flow canvas */}
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
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
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

      {/* Person form dialog */}
      <PersonForm
        open={personFormOpen}
        onClose={handleClosePersonForm}
      />
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
