"use client"

import { useEffect, useRef, useState } from "react";
import cytoscape, { type Core, type NodeSingular, type EventObject } from "cytoscape";
import { graphApi, type GraphNode, type GraphEdge } from "@/lib/api/graph";
import { Loader2, RefreshCw, ZoomIn, ZoomOut, Maximize2, Info, HelpCircle } from "lucide-react";
import { toast } from "sonner";

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

const STYLESHEET: cytoscape.StylesheetJson = [
    {
        selector: "node",
        style: {
            "width": 18,
            "height": 18,
            "background-color": (ele: NodeSingular) => nodeColor(ele.data("type")).bg,
            "border-width": 2,
            "border-color": (ele: NodeSingular) => nodeColor(ele.data("type")).border,
            "label": "data(name)",
            "color": (ele: NodeSingular) => nodeColor(ele.data("type")).label,
            "font-family": "ui-monospace, monospace",
            "font-size": "8px",
            "text-valign": "top",
            "text-halign": "center",
            "text-margin-y": -5,
            "text-transform": "uppercase",
            "text-max-width": "70px",
            "text-wrap": "ellipsis",
            "text-background-color": "#000000",
            "text-background-opacity": 0.7,
            "text-background-padding": "2px",
            "text-background-shape": "rectangle",
            "transition-property": "border-color, border-width, width, height, opacity",
            "transition-duration": 200,
        },
    },
    {
        selector: "node:selected",
        style: { "border-width": 3, "width": 24, "height": 24, "border-color": "#ffffff" },
    },
    {
        selector: "node.dimmed",
        style: { "opacity": 0.15 },
    },
    {
        selector: "node.highlighted",
        style: { "border-width": 3, "width": 22, "height": 22 },
    },
    {
        selector: "edge",
        style: {
            "width": 1,
            "line-color": "#27272a",
            "target-arrow-color": "#27272a",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.6,
            "curve-style": "bezier",
            "transition-property": "line-color, opacity, width",
            "transition-duration": 200,
        },
    },
    {
        selector: "edge.highlighted",
        style: {
            "line-color": "rgba(255,255,255,0.3)",
            "target-arrow-color": "rgba(255,255,255,0.3)",
            "width": 1.5,
            "label": "data(type)",
            "font-family": "ui-monospace, monospace",
            "font-size": "7px",
            "color": "#71717a",
            "text-rotation": "autorotate",
            "text-background-color": "#000000",
            "text-background-opacity": 0.8,
            "text-background-padding": "2px",
            "text-background-shape": "rectangle",
        },
    },
    {
        selector: "edge.dimmed",
        style: { "opacity": 0.06 },
    },
];

interface GraphVisualizerProps {
    caseId: string;
}

export default function GraphVisualizer({ caseId }: GraphVisualizerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const cyRef = useRef<Core | null>(null);

    const [loading, setLoading] = useState(true);
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [selectedConns, setSelectedConns] = useState<GraphEdge[]>([]);

    const fetchGraphData = async () => {
        setLoading(true);
        setSelectedNode(null);
        setSelectedConns([]);
        try {
            const data = await graphApi.getGraph(caseId);
            setNodes(data.nodes ?? []);
            setEdges(data.edges ?? []);
        } catch {
            toast.error("FAILED TO LOAD RELATIONAL GRAPH DATA");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchGraphData(); }, [caseId]);

    useEffect(() => {
        if (loading || !containerRef.current) return;

        if (cyRef.current && !cyRef.current.destroyed()) {
            cyRef.current.destroy();
        }
        cyRef.current = null;

        if (!nodes.length) return;

        const cy = cytoscape({
            container: containerRef.current,
            elements: [
                ...nodes.map(n => ({ data: { id: n.id, name: n.name, type: n.type } })),
                ...edges.map((e, i) => ({ data: { id: `e${i}`, source: e.from, target: e.to, type: e.type, confidence: e.confidence } })),
            ],
            style: STYLESHEET,
            layout: {
                name: "cose",
                animate: true,
                animationThreshold: 250,
                randomize: true,
                nodeRepulsion: () => 6000,
                idealEdgeLength: () => 100,
                gravity: 1.5,
                numIter: 800,
                fit: true,
                padding: 30,
            },
            minZoom: 0.2,
            maxZoom: 4,
            wheelSensitivity: 0.3,
            boxSelectionEnabled: false,
            selectionType: "single",
        });

        cy.on("tap", "node", (evt: EventObject) => {
            const node = evt.target;
            const data = node.data() as GraphNode;
            if (selectedNode?.id === data.id) {
                cy.elements().removeClass("dimmed highlighted");
                setSelectedNode(null);
                setSelectedConns([]);
                return;
            }
            const neighbourhood = node.closedNeighborhood();
            cy.elements().removeClass("dimmed highlighted");
            cy.elements().not(neighbourhood).addClass("dimmed");
            neighbourhood.addClass("highlighted");
            node.addClass("highlighted");
            setSelectedNode(data);
            setSelectedConns(edges.filter(e => e.from === data.id || e.to === data.id));
        });

        cy.on("tap", (evt: EventObject) => {
            if (evt.target === cy) {
                cy.elements().removeClass("dimmed highlighted");
                setSelectedNode(null);
                setSelectedConns([]);
            }
        });

        cy.on("mouseover", "node", (evt: EventObject) => evt.target.style("border-color", "#ffffff"));
        cy.on("mouseout", "node", (evt: EventObject) => {
            if (!evt.target.selected()) evt.target.style("border-color", nodeColor(evt.target.data("type")).border);
        });

        cyRef.current = cy;
        return () => { if (!cy.destroyed()) cy.destroy(); cyRef.current = null; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, nodes, edges]);

    const zoomIn  = () => cyRef.current?.zoom({ level: Math.min(4, cyRef.current.zoom() + 0.2), renderedPosition: { x: (containerRef.current?.offsetWidth ?? 300) / 2, y: (containerRef.current?.offsetHeight ?? 250) / 2 } });
    const zoomOut = () => cyRef.current?.zoom({ level: Math.max(0.2, cyRef.current.zoom() - 0.2), renderedPosition: { x: (containerRef.current?.offsetWidth ?? 300) / 2, y: (containerRef.current?.offsetHeight ?? 250) / 2 } });
    const fitView = () => cyRef.current?.fit(undefined, 30);

    return (
        <div className="border border-hairline bg-zinc-950/10 grid grid-cols-1 md:grid-cols-4 select-none relative overflow-hidden">
            {/* Toolbar */}
            <div className="absolute top-4 left-4 z-20 flex space-x-2">
                {[
                    { icon: RefreshCw, action: fetchGraphData, title: "Refresh", spin: loading },
                    { icon: ZoomIn,    action: zoomIn,          title: "Zoom in" },
                    { icon: ZoomOut,   action: zoomOut,         title: "Zoom out" },
                    { icon: Maximize2, action: fitView,         title: "Fit view" },
                ].map(({ icon: Icon, action, title, spin }) => (
                    <button key={title} onClick={action} title={title}
                        className="p-2 border border-hairline bg-black/60 hover:bg-black text-zinc-400 hover:text-white transition-colors">
                        <Icon size={14} className={spin ? "animate-spin" : ""} />
                    </button>
                ))}
            </div>

            {/* Canvas */}
            <div className="md:col-span-3 h-[500px] border-r border-hairline relative bg-black/40 overflow-hidden">
                {/* Cytoscape container — always mounted */}
                <div ref={containerRef} className="w-full h-full" />

                {/* Loading overlay */}
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center space-x-2 text-zinc-400 font-mono text-xs bg-black/80 z-10">
                        <Loader2 size={14} className="animate-spin" />
                        <span>SYNCHRONIZING RELATIONAL NODES...</span>
                    </div>
                )}

                {/* Empty state overlay */}
                {!loading && !nodes.length && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-zinc-400 font-mono text-xs space-y-2 select-none z-10">
                        <HelpCircle size={28} className="text-zinc-600" />
                        <span className="uppercase font-bold tracking-wider">NO RELATIONAL EDGES DETECTED</span>
                        <span className="text-[11px] text-zinc-500 max-w-xs leading-relaxed">
                            Upload evidence files to trigger entity extraction and populate the case network.
                        </span>
                    </div>
                )}
            </div>

            {/* Inspector */}
            <div className="h-[500px] bg-black/20 p-6 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-6 text-left">
                    <h3 className="font-mono text-xs tracking-wider text-zinc-400 uppercase flex items-center space-x-1.5 border-b border-hairline pb-3">
                        <Info size={12} />
                        <span>NODE INSPECTOR</span>
                    </h3>

                    {selectedNode ? (
                        <div className="space-y-6 font-mono text-xs">
                            <div className="space-y-1">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">ENTITY NAME</span>
                                <h4 className="text-sm font-bold text-white uppercase tracking-wide break-words">{selectedNode.name}</h4>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">CLASSIFICATION</span>
                                <span
                                    className="inline-block px-2.5 py-0.5 border font-semibold uppercase text-[10px]"
                                    style={{ borderColor: nodeColor(selectedNode.type).border, color: nodeColor(selectedNode.type).label, backgroundColor: nodeColor(selectedNode.type).bg }}
                                >
                                    {selectedNode.type}
                                </span>
                            </div>
                            <div className="space-y-3 pt-2">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block border-b border-hairline-strong pb-1">
                                    RELATIONSHIPS ({selectedConns.length})
                                </span>
                                {selectedConns.length === 0 ? (
                                    <p className="text-zinc-500 text-[11px] leading-relaxed uppercase">No connections indexed.</p>
                                ) : (
                                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                        {selectedConns.map((edge, i) => {
                                            const otherId = edge.from === selectedNode.id ? edge.to : edge.from;
                                            const other = nodes.find(n => n.id === otherId);
                                            const dir = edge.from === selectedNode.id ? "→" : "←";
                                            return (
                                                <div key={i}
                                                    onClick={() => {
                                                        if (!other || !cyRef.current) return;
                                                        cyRef.current.getElementById(other.id).emit("tap");
                                                    }}
                                                    className="border border-hairline-strong p-2.5 hover:border-zinc-500 hover:bg-zinc-950/40 cursor-pointer transition-all text-[11px] space-y-1 leading-snug"
                                                >
                                                    <div className="flex justify-between text-zinc-400">
                                                        <span className="uppercase text-[9px] font-bold text-zinc-500">{edge.type}</span>
                                                        <span>CONF: {Math.round(edge.confidence * 100)}%</span>
                                                    </div>
                                                    <p className="text-white font-bold truncate">{dir} {other?.name ?? "UNKNOWN"}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="py-12 text-center text-zinc-500 font-mono text-[11px] leading-relaxed uppercase space-y-1">
                            <p>SELECT A NETWORK NODE</p>
                            <p className="text-[10px] text-zinc-600">TO AUDIT PROPERTIES & LINKED RELATIONS</p>
                        </div>
                    )}
                </div>

                <div className="border-t border-hairline pt-4 font-mono text-[10px] text-zinc-500 leading-relaxed uppercase text-left">
                    <p className="text-zinc-400 font-semibold mb-1">Interactive controls:</p>
                    <p>• Drag canvas to pan</p>
                    <p>• Scroll wheel to zoom</p>
                    <p>• Drag nodes to reposition</p>
                    <p>• Click node to inspect</p>
                </div>
            </div>
        </div>
    );
}
