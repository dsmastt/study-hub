import { useEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { FormulaTreeData } from "../../shared/types.ts";
import { IconButton } from "./ui.tsx";

type NodeKind = "subject" | "chapter" | "subtopic";

interface GraphNode extends SimulationNodeDatum {
  id: string;
  kind: NodeKind;
  refId: number;
  label: string;
  parentId: string | null;
  count: number;
  colorIndex: number;
}

type GraphLink = SimulationLinkDatum<GraphNode>;

export interface FormulaGraphSelection {
  kind: NodeKind;
  id: number;
}

function nodeRadius(node: GraphNode): number {
  return node.kind === "subject" ? 27 : node.kind === "chapter" ? 18 : 10;
}

function nodeColor(node: GraphNode): string {
  return `var(--chart-${(node.colorIndex % 6) + 1})`;
}

function endpoint(node: GraphNode | string | number, nodesById: Map<string, GraphNode>): GraphNode | undefined {
  if (typeof node === "object") return node;
  return nodesById.get(String(node));
}

export function FormulaGraph({
  tree,
  expandedSubjects,
  expandedChapters,
  selected,
  onNodeClick,
}: {
  tree: FormulaTreeData;
  expandedSubjects: number[];
  expandedChapters: number[];
  selected: FormulaGraphSelection | null;
  onNodeClick: (selection: FormulaGraphSelection) => void;
}) {
  const [rendered, setRendered] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({
    nodes: [],
    links: [],
  });
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const positions = useRef(new Map<string, { x: number; y: number }>());
  const drag = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const expandedSubjectKey = expandedSubjects.join(",");
  const expandedChapterKey = expandedChapters.join(",");

  useEffect(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const chapterSubject = new Map(tree.chapters.map((chapter) => [chapter.id, chapter.subjectId]));
    const expandedSubjectSet = new Set(expandedSubjects);
    const expandedChapterSet = new Set(expandedChapters);

    tree.subjects.forEach((subject, index) => {
      nodes.push({
        id: `subject:${subject.id}`,
        kind: "subject",
        refId: subject.id,
        label: subject.name,
        parentId: null,
        count: subject.formulaCount,
        colorIndex: index,
      });
    });
    tree.chapters.forEach((chapter) => {
      if (!expandedSubjectSet.has(chapter.subjectId)) return;
      const subjectIndex = Math.max(0, tree.subjects.findIndex((subject) => subject.id === chapter.subjectId));
      nodes.push({
        id: `chapter:${chapter.id}`,
        kind: "chapter",
        refId: chapter.id,
        label: chapter.name,
        parentId: `subject:${chapter.subjectId}`,
        count: chapter.formulaCount,
        colorIndex: subjectIndex,
      });
      links.push({
        source: `subject:${chapter.subjectId}`,
        target: `chapter:${chapter.id}`,
      });
    });
    tree.subtopics.forEach((subtopic) => {
      const subjectId = chapterSubject.get(subtopic.chapterId);
      if (!expandedChapterSet.has(subtopic.chapterId)) return;
      const subjectIndex = Math.max(0, tree.subjects.findIndex((subject) => subject.id === subjectId));
      nodes.push({
        id: `subtopic:${subtopic.id}`,
        kind: "subtopic",
        refId: subtopic.id,
        label: subtopic.name,
        parentId: `chapter:${subtopic.chapterId}`,
        count: subtopic.formulaCount,
        colorIndex: subjectIndex,
      });
      links.push({
        source: `chapter:${subtopic.chapterId}`,
        target: `subtopic:${subtopic.id}`,
      });
    });

    for (const node of nodes) {
      const previous = positions.current.get(node.id);
      if (previous) {
        node.x = previous.x;
        node.y = previous.y;
      }
    }

    const simulation = forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(links)
          .id((node) => node.id)
          .distance((link) => {
            const source = typeof link.source === "object" ? link.source : undefined;
            return source?.kind === "subject" ? 155 : 105;
          })
          .strength(0.55),
      )
      .force("charge", forceManyBody<GraphNode>().strength(-240))
      .force("center", forceCenter(500, 345))
      .force("collide", forceCollide<GraphNode>().radius((node) => nodeRadius(node) + 10))
      .alpha(0.85)
      .alphaDecay(0.035)
      .on("tick", () => {
        for (const node of nodes) {
          if (node.x !== undefined && node.y !== undefined) {
            positions.current.set(node.id, { x: node.x, y: node.y });
          }
        }
        setRendered({ nodes: [...nodes], links: [...links] });
      });

    setRendered({ nodes: [...nodes], links: [...links] });
    return () => {
      simulation.stop();
    };
  }, [tree, expandedSubjectKey, expandedChapterKey]);

  const nodesById = useMemo(
    () => new Map(rendered.nodes.map((node) => [node.id, node])),
    [rendered.nodes],
  );

  const adjustZoom = (factor: number) => {
    setView((current) => ({ ...current, zoom: Math.min(2.4, Math.max(0.45, current.zoom * factor)) }));
  };

  return (
    <div className="formula-graph-shell">
      <div className="formula-graph-controls">
        <IconButton
          label="Zoom in"
          onClick={(event) => {
            event.stopPropagation();
            adjustZoom(1.18);
          }}
        >
          <Plus size={14} />
        </IconButton>
        <IconButton
          label="Zoom out"
          onClick={(event) => {
            event.stopPropagation();
            adjustZoom(1 / 1.18);
          }}
        >
          <Minus size={14} />
        </IconButton>
        <IconButton
          label="Reset view"
          onClick={(event) => {
            event.stopPropagation();
            setView({ x: 0, y: 0, zoom: 1 });
          }}
        >
          <Maximize2 size={14} />
        </IconButton>
      </div>
      <div className="formula-graph-legend">
        <span><i className="legend-subject" /> subject</span>
        <span><i className="legend-chapter" /> chapter</span>
        <span><i className="legend-subtopic" /> topic</span>
      </div>
      <svg
        className="formula-graph-svg"
        viewBox="0 0 1000 680"
        role="img"
        aria-label="Formula topic graph"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          drag.current = {
            startX: event.clientX,
            startY: event.clientY,
            originX: view.x,
            originY: view.y,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const dx = event.clientX - drag.current.startX;
          const dy = event.clientY - drag.current.startY;
          if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
          setView((current) => ({
            ...current,
            x: drag.current!.originX + dx,
            y: drag.current!.originY + dy,
          }));
        }}
        onPointerUp={(event) => {
          drag.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
          {rendered.links.map((link, index) => {
            const source = endpoint(link.source, nodesById);
            const target = endpoint(link.target, nodesById);
            if (!source?.x || !target?.x) return null;
            return (
              <line
                key={`${source.id}-${target.id}-${index}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className="formula-graph-link"
              />
            );
          })}
          {rendered.nodes.map((node) => {
            const active = selected?.kind === node.kind && selected.id === node.refId;
            const radius = nodeRadius(node);
            const color = nodeColor(node);
            return (
              <g
                key={node.id}
                transform={`translate(${node.x ?? 500} ${node.y ?? 340})`}
                className={`formula-graph-node ${node.kind} ${active ? "active" : ""}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onNodeClick({ kind: node.kind, id: node.refId });
                }}
              >
                <title>
                  {node.label} · {node.count} formula{node.count === 1 ? "" : "s"}
                </title>
                <circle r={radius + 8} fill={color} opacity={0.08} />
                <circle
                  r={radius}
                  fill={node.kind === "subject" ? color : "var(--panel)"}
                  stroke={color}
                  strokeWidth={active ? 3 : 1.5}
                  opacity={node.kind === "subject" ? 0.9 : 0.95}
                />
                {active && <circle r={radius + 5} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.75} />}
                <text
                  className={`formula-graph-label ${node.kind}`}
                  y={radius + 15}
                  textAnchor="middle"
                  style={{ fill: node.kind === "subject" ? "var(--text)" : "var(--text-dim)" }}
                >
                  {node.label.length > 26 ? `${node.label.slice(0, 24)}…` : node.label}
                </text>
                {node.kind !== "subtopic" && (
                  <text className="formula-graph-count" y={radius + 27} textAnchor="middle">
                    {node.count}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="formula-graph-hint">
        Drag to pan · click a subject, chapter, then topic · formula counts are shown under larger nodes
      </div>
    </div>
  );
}
