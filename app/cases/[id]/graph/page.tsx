"use client"

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import cytoscape, { type Core, type NodeSingular, type EventObject } from "cytoscape";
import { graphApi, type GraphNode, type GraphEdge } from "@/lib/api/graph";
import { Loader2, RefreshCw, ZoomIn, ZoomOut, Maximize2, GitFork, HelpCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import CaseAIPanel from "@/components/case/case-ai-panel";

// ─── Theme constants ────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, { bg: string; border: string; label: string }> = {
    PERSON:       { bg: "#0a1a1f", border: "#06b6d4", label: "#67e8f9" },
    ORGANIZATION: { bg: "#130a1f", border: "#a855f7", label: "#d8b4fe" },
    LOCATION:     { bg: "#0a1a0f", border: "#10b981", label: "#6ee7b7" },
    OBJECT:       { bg: "#1a160a", border: "#eab308", label: "#fde047" },
    CONCEPT:      { bg: "#1a0a14", border: "#ec4899", label: "#f9a8d4" },
    DEFAULT:      { bg: "#111111", border: "#3f3f46", label: "#a1a1aa" },
};

function nodeColor(type: string) {
    return NODE_COLORS[type?.toUpperCase()] ?? NODE_COLORS.DEFAULT;
}

// ─── Cytoscape stylesheet ────────────────────────────────────────────────────

const STYLESHEET: cytoscape.StylesheetJson = [
    {
        selector: "node",
        style: {
            "width": 22,
            "height": 22,
            "background-color": (ele: NodeSingular) => nodeColor(ele.data("type")).bg,
            "border-width": 2,
            "border-color": (ele: NodeSingular) => nodeColor(ele.data("type")).border,
            "label": "data(name)",
            "color": (ele: NodeSingular) => nodeColor(ele.data("type")).label,
            "font-family": "ui-monospace, monospace",
            "font-size": "9px",
            "text-valign": "top",
            "text-halign": "center",
            "text-margin-y": -6,
            "text-transform": "uppercase",
            "text-max-width": "80px",
            "text-wrap": "ellipsis",
            "text-background-color": "#000000",
            "text-background-opacity": 0.7,
            "text-background-padding": "2px",
            "text-background-shape": "rectangle",
            "transition-property": "border-color, border-width, width, height, background-color, opacity",
            "transition-duration": 200,
        },
    },
    {
        selector: "node:selected",
        style: {
            "border-width": 3,
            "width": 28,
            "height": 28,
            "border-color": "#ffffff",
        },
    },
    {
        selector: "node.dimmed",
        style: {
            "opacity": 0.15,
        },
    },
    {
        selector: "node.highlighted",
        style: {
            "border-width": 3,
            "width": 26,
            "height": 26,
        },
    },
    {
        selector: "edge",
        style: {
            "width": 1,
            "line-color": "#27272a",
            "target-arrow-color": "#27272a",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.7,
            "curve-style": "bezier",
            "label": "",
            "font-family": "ui-monospace, monospace",
            "font-size": "7px",
            "color": "#52525b",
            "text-rotation": "autorotate",
            "text-background-color": "#000000",
            "text-background-opacity": 0.8,
            "text-background-padding": "2px",
            "text-background-shape": "rectangle",
            "transition-property": "line-color, opacity, width",
            "transition-duration": 200,
        },
    },
    {
        selector: "edge.highlighted",
        style: {
            "line-color": "rgba(255,255,255,0.35)",
            "target-arrow-color": "rgba(255,255,255,0.35)",
            "width": 1.5,
            "label": "data(type)",
            "color": "#71717a",
        },
    },
    {
        selector: "edge.dimmed",
        style: {
            "opacity": 0.06,
        },
    },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function GraphWorkspacePage() {
    const params = useParams();
    const caseId = params.id as string;

    const containerRef = useRef<HTMLDivElement>(null);
    const cyRef = useRef<Core | null>(null);

    const [loading, setLoading] = useState(true);
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [selectedConns, setSelectedConns] = useState<GraphEdge[]>([]);
    const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
    const [inspectorTab, setInspectorTab] = useState<"node" | "ai">("node");
    const [isRightCollapsed, setIsRightCollapsed] = useState(false);
    const [rightWidth, setRightWidth] = useState(320);
    const [isResizingRight, setIsResizingRight] = useState(false);

    // ── Sidebar resize ──────────────────────────────────────────────────────
    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizingRight(true);
    };

    useEffect(() => {
        if (!isResizingRight) return;
        const onMove = (e: MouseEvent) => setRightWidth(Math.max(220, Math.min(500, window.innerWidth - e.clientX)));
        const onUp = () => setIsResizingRight(false);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    }, [isResizingRight]);

    // ── Fetch + build graph ─────────────────────────────────────────────────
    const fetchGraph = useCallback(async () => {
        setLoading(true);
        setSelectedNode(null);
        setSelectedConns([]);
        try {
            const data = await graphApi.getGraph(caseId);
            setNodes(data.nodes ?? []);
            setEdges(data.edges ?? []);
        } catch {
            toast.error("Failed to load graph");
        } finally {
            setLoading(false);
        }
    }, [caseId]);

    useEffect(() => { fetchGraph(); }, [fetchGraph]);

    // ── Init / update Cytoscape ─────────────────────────────────────────────
    useEffect(() => {
        if (loading || !containerRef.current) return;

        // Destroy previous instance cleanly before touching the DOM
        if (cyRef.current && !cyRef.current.destroyed()) {
            cyRef.current.destroy();
        }
        cyRef.current = null;

        if (!nodes.length) return;

        const cy = cytoscape({
            container: containerRef.current,
            elements: [
                ...nodes.map(n => ({
                    data: { id: n.id, name: n.name, type: n.type },
                })),
                ...edges.map((e, i) => ({
                    data: {
                        id: `edge-${i}`,
                        source: e.from,
                        target: e.to,
                        type: e.type,
                        confidence: e.confidence,
                    },
                })),
            ],
            style: STYLESHEET,
            layout: {
                name: "cose",
                animate: true,
                animationThreshold: 250,
                randomize: true,
                nodeRepulsion: () => 8000,
                idealEdgeLength: () => 120,
                edgeElasticity: () => 100,
                gravity: 1.2,
                numIter: 1000,
                fit: true,
                padding: 40,
            },
            minZoom: 0.2,
            maxZoom: 4,
            wheelSensitivity: 0.3,
            boxSelectionEnabled: false,
            selectionType: "single",
            // Renderer options for performance
            textureOnViewport: false,
            motionBlur: false,
        });

        // ── Events ────────────────────────────────────────────────────────

        // Tap on node → select + highlight neighbourhood
        cy.on("tap", "node", (evt: EventObject) => {
            const node = evt.target;
            const nodeData = node.data() as GraphNode;

            // If already selected, deselect
            if (selectedNode?.id === nodeData.id) {
                cy.elements().removeClass("dimmed highlighted");
                setSelectedNode(null);
                setSelectedConns([]);
                return;
            }

            const neighbourhood = node.closedNeighborhood();
            const rest = cy.elements().not(neighbourhood);

            cy.elements().removeClass("dimmed highlighted");
            rest.addClass("dimmed");
            neighbourhood.addClass("highlighted");
            node.addClass("highlighted");

            const connEdges = edges.filter(e => e.from === nodeData.id || e.to === nodeData.id);
            setSelectedNode(nodeData);
            setSelectedConns(connEdges);
        });

        // Tap on edge → select edge for AI explanation
        cy.on("tap", "edge", (evt: EventObject) => {
            const edge = evt.target;
            const edgeData = edge.data();
            const fromNode = nodes.find(n => n.id === edgeData.source);
            const toNode = nodes.find(n => n.id === edgeData.target);
            if (fromNode && toNode) {
                const graphEdge: GraphEdge = {
                    from: fromNode.id,
                    to: toNode.id,
                    type: edgeData.type,
                    confidence: edgeData.confidence,
                };
                setSelectedEdge(graphEdge);
                setSelectedNode(null);
                setSelectedConns([]);
                // Also highlight the edge visually
                cy.elements().removeClass("dimmed highlighted");
                edge.addClass("highlighted");
                cy.getElementById(edgeData.source).addClass("highlighted");
                cy.getElementById(edgeData.target).addClass("highlighted");
            }
        });
        
        // Tap on background → deselect
        cy.on("tap", (evt: EventObject) => {
            if (evt.target === cy) {
                cy.elements().removeClass("dimmed highlighted");
                setSelectedNode(null);
                setSelectedEdge(null);
                setSelectedConns([]);
            }
        });

        // Hover glow
        cy.on("mouseover", "node", (evt: EventObject) => {
            evt.target.style("border-color", "#ffffff");
        });
        cy.on("mouseout", "node", (evt: EventObject) => {
            const type = evt.target.data("type") as string;
            const isSelected = evt.target.selected();
            if (!isSelected) {
                evt.target.style("border-color", nodeColor(type).border);
            }
        });

        cyRef.current = cy;

        return () => {
            // Guard: only destroy if not already destroyed
            if (!cy.destroyed()) cy.destroy();
            cyRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, nodes, edges]);

    // ── Toolbar actions ─────────────────────────────────────────────────────
    const zoomIn  = () => cyRef.current?.zoom({ level: Math.min(4, (cyRef.current.zoom() + 0.2)), renderedPosition: { x: containerRef.current!.offsetWidth / 2, y: containerRef.current!.offsetHeight / 2 } });
    const zoomOut = () => cyRef.current?.zoom({ level: Math.max(0.2, (cyRef.current.zoom() - 0.2)), renderedPosition: { x: containerRef.current!.offsetWidth / 2, y: containerRef.current!.offsetHeight / 2 } });
    const fitView = () => cyRef.current?.fit(undefined, 40);

    // ── Stats ───────────────────────────────────────────────────────────────
    const mostConnected = (() => {
        if (!nodes.length) return "—";
        const counts: Record<string, number> = {};
        edges.forEach(e => { counts[e.from] = (counts[e.from] || 0) + 1; counts[e.to] = (counts[e.to] || 0) + 1; });
        const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
        return nodes.find(n => n.id === topId)?.name ?? "—";
    })();

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <div className={`flex h-full w-full bg-black text-white overflow-hidden ${isResizingRight ? "select-none cursor-col-resize" : ""}`}>

            {/* ── Canvas area ─────────────────────────────────────────────── */}
            <div className="flex-grow flex flex-col min-w-0 h-full relative">

                {/* Toolbar */}
                <div className="absolute top-4 left-4 z-20 flex gap-1.5">
                    {[
                        { icon: RefreshCw, action: fetchGraph,  title: "Refresh graph", spin: loading },
                        { icon: ZoomIn,    action: zoomIn,       title: "Zoom in" },
                        { icon: ZoomOut,   action: zoomOut,      title: "Zoom out" },
                        { icon: Maximize2, action: fitView,      title: "Fit to view" },
                    ].map(({ icon: Icon, action, title, spin }) => (
                        <Tooltip key={title}>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="icon-sm" onClick={action} className="bg-black/80 backdrop-blur-sm">
                                    <Icon size={13} className={spin ? "animate-spin" : ""} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{title}</TooltipContent>
                        </Tooltip>
                    ))}
                </div>

                {/* Workspace label */}
                <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-black/80 border border-zinc-800 px-3 py-2 backdrop-blur-sm">
                    <GitFork size={11} className="text-zinc-500" />
                    <span className="font-mono text-xs tracking-widest text-zinc-500 font-bold uppercase">GRAPH WORKSPACE</span>
                </div>

                {/* Legend */}
                {!loading && nodes.length > 0 && (
                    <div className="absolute bottom-12 left-4 z-20 bg-black/80 border border-zinc-800 px-3 py-2 backdrop-blur-sm flex flex-col gap-1">
                        {Object.entries(NODE_COLORS).filter(([k]) => k !== "DEFAULT").map(([type, colors]) => (
                            <div key={type} className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors.border }} />
                                <span className="font-mono text-[9px] tracking-widest text-zinc-500 uppercase">{type}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Cytoscape container — always mounted so the DOM node is stable */}
                <div ref={containerRef} className="w-full h-full" />

                {/* Loading overlay */}
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 text-zinc-500 font-mono text-xs uppercase bg-black/80 z-10">
                        <Loader2 size={14} className="animate-spin" /><span>SYNCHRONIZING NODES...</span>
                    </div>
                )}

                {/* Empty state overlay */}
                {!loading && !nodes.length && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500 font-mono text-xs uppercase z-10">
                        <HelpCircle size={32} className="text-zinc-800" />
                        <span className="tracking-widest font-bold">NO RELATIONAL EDGES DETECTED</span>
                        <span className="text-[10px] max-w-xs text-center leading-relaxed">Upload and process evidence files to populate the entity network.</span>
                    </div>
                )}

                {/* Stats bar */}
                {!loading && nodes.length > 0 && (
                    <div className="absolute bottom-4 left-4 bg-black/80 border border-zinc-800 px-3 py-2 backdrop-blur-sm font-mono text-[10px] text-zinc-500 uppercase">
                        {nodes.length} ENTITIES · {edges.length} RELATIONSHIPS
                    </div>
                )}
            </div>

            {/* ── Resize handle ────────────────────────────────────────────── */}
            {!isRightCollapsed ? (
                <div
                    onMouseDown={startResizing}
                    className={`w-[3px] hover:w-[5px] cursor-col-resize bg-zinc-900 hover:bg-zinc-700 transition-all shrink-0 select-none ${isResizingRight ? "bg-zinc-500 w-[5px]" : ""}`}
                />
            ) : (
                <div className="w-[1px] bg-zinc-900 shrink-0" />
            )}

            {/* ── Right panel ──────────────────────────────────────────────── */}
            <div
                style={{ width: isRightCollapsed ? 48 : rightWidth }}
                className="shrink-0 h-full overflow-hidden border-l border-zinc-900 bg-zinc-950/10"
            >
                {isRightCollapsed ? (
                    <div className="flex flex-col items-center py-4 w-full h-full text-center select-none">
                        <button onClick={() => setIsRightCollapsed(false)} title="EXPAND PANEL" className="p-1 text-zinc-500 hover:text-white transition-colors shrink-0 mb-6">
                            <ChevronLeft size={14} />
                        </button>
                        <div className="w-7 h-7 border border-zinc-800 flex items-center justify-center bg-black shrink-0">
                            <GitFork size={13} className="text-zinc-500 animate-pulse" />
                        </div>
                        <div className="flex-1 flex items-center justify-center w-full overflow-hidden mt-10">
                            <span className="font-mono text-[9px] tracking-[0.25em] text-zinc-500 font-bold uppercase whitespace-nowrap block" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                                {inspectorTab === "node" ? "GRAPH INSPECTOR" : "GRAPH AI"}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col h-full w-full overflow-hidden">
                        {/* Tab header */}
                        <div className="flex shrink-0 items-center bg-black/40 border-b border-zinc-800 h-[45px]">
                            <button onClick={() => setIsRightCollapsed(true)} title="COLLAPSE PANEL" className="px-3 h-full flex items-center justify-center text-zinc-500 hover:text-white transition-colors border-r border-zinc-900">
                                <ChevronRight size={14} />
                            </button>
                            {(["node", "ai"] as const).map(tab => (
                                <button key={tab} onClick={() => setInspectorTab(tab)}
                                    className={`flex-1 h-full font-mono text-[10px] tracking-widest uppercase transition-colors border-b-2 ${inspectorTab === tab ? "text-white border-b-white font-bold" : "text-zinc-500 hover:text-white border-b-transparent"}`}>
                                    {tab === "node" ? "INSPECTOR" : "AI"}
                                </button>
                            ))}
                        </div>

                        {/* Tab content */}
                        <div className="flex-1 overflow-hidden">
                            {inspectorTab === "node" ? (
                                <div className="h-full overflow-y-auto p-4 space-y-4 font-mono text-xs">
                                    {selectedNode ? (
                                        <div className="space-y-4">
                                            {/* Entity name */}
                                            <div>
                                                <p className="text-zinc-500 tracking-widest uppercase font-semibold text-[9px] mb-1">ENTITY</p>
                                                <h4 className="text-white uppercase tracking-wide break-words font-bold">{selectedNode.name}</h4>
                                            </div>

                                            {/* Type badge */}
                                            <div>
                                                <p className="text-zinc-500 tracking-widest uppercase font-semibold text-[9px] mb-1">TYPE</p>
                                                <span
                                                    className="px-1.5 py-0.5 border font-mono text-[10px] uppercase font-bold tracking-wider leading-none"
                                                    style={{
                                                        borderColor: nodeColor(selectedNode.type).border,
                                                        color: nodeColor(selectedNode.type).label,
                                                        backgroundColor: nodeColor(selectedNode.type).bg,
                                                    }}
                                                >
                                                    {selectedNode.type}
                                                </span>
                                            </div>

                                            <div className="h-px bg-zinc-900 w-full" />

                                            {/* Connections */}
                                            <div>
                                                <p className="text-zinc-500 tracking-widest uppercase font-semibold text-[9px] mb-2">CONNECTIONS ({selectedConns.length})</p>
                                                {selectedConns.length === 0 ? (
                                                    <p className="text-zinc-600 text-[10px] uppercase font-medium">No connections indexed.</p>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        {selectedConns.map((edge, i) => {
                                                            const otherId = edge.from === selectedNode.id ? edge.to : edge.from;
                                                            const other = nodes.find(n => n.id === otherId);
                                                            const dir = edge.from === selectedNode.id ? "→" : "←";
                                                            return (
                                                                <div
                                                                    key={i}
                                                                    onClick={() => {
                                                                        if (!other || !cyRef.current) return;
                                                                        const cyNode = cyRef.current.getElementById(other.id);
                                                                        cyNode.emit("tap");
                                                                    }}
                                                                    className="border border-zinc-900 p-2.5 hover:border-zinc-700 bg-zinc-950/20 hover:bg-zinc-900/10 cursor-pointer transition-colors space-y-0.5"
                                                                >
                                                                    <div className="flex justify-between text-zinc-500 text-[10px]">
                                                                        <span className="uppercase font-bold">{edge.type}</span>
                                                                        <span className="font-semibold">CONF: {Math.round(edge.confidence * 100)}%</span>
                                                                    </div>
                                                                    <p className="text-white text-xs truncate uppercase font-bold">{dir} {other?.name ?? "UNKNOWN"}</p>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-12 text-center space-y-4">
                                            <p className="font-mono text-[10px] tracking-widest text-zinc-500 font-bold uppercase">SELECT A NODE TO INSPECT</p>
                                            {nodes.length > 0 && (
                                                <div className="text-left space-y-1.5 font-mono text-[10px] bg-zinc-950/20 p-3 border border-zinc-900 uppercase">
                                                    <p className="text-zinc-500 font-semibold tracking-widest text-[9px] mb-1">GRAPH STATS</p>
                                                    <p className="text-white">{nodes.length} ENTITIES</p>
                                                    <p className="text-white">{edges.length} RELATIONSHIPS</p>
                                                    <p className="text-white truncate">TOP NODE: {mostConnected}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <CaseAIPanel
                                    title="GRAPH AI"
                                    suggestions={["Explain this relationship", "Find suspicious links", "Summarize entity", "Who is connected?", "Find hidden patterns"]}
                                    placeholder="ASK ABOUT GRAPH..."
                                    selectedItemName={selectedNode?.name}
                                    selectedEdge={selectedEdge ? {
                                        ...selectedEdge,
                                        fromName: nodes.find(n => n.id === selectedEdge.from)?.name,
                                        toName: nodes.find(n => n.id === selectedEdge.to)?.name,
                                    } : null}
                                    contextType="Entity Topology Resolver"
                                    caseId={caseId}
                                    isCollapsed={false}
                                    onToggleCollapse={() => setIsRightCollapsed(true)}
                                />
                            )}
                        </div>

                        <div className="h-px bg-zinc-900 w-full shrink-0" />
                        <p className="px-4 py-2.5 font-mono text-[9px] tracking-wider text-zinc-500 font-semibold uppercase shrink-0 bg-black/40">
                            DRAG CANVAS · SCROLL ZOOM · CLICK NODE
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
