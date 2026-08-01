"use client"

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { graphApi, GraphNode, GraphEdge } from "@/lib/api/graph";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Loader2, RefreshCw, ZoomIn, ZoomOut, Maximize2, GitFork, HelpCircle, ChevronLeft, ChevronRight } from "lucide-react";
import CaseAIPanel from "@/components/case/case-ai-panel";

interface Position { x: number; y: number; vx: number; vy: number; }

const NODE_COLORS: Record<string, string> = {
    PERSON:       "stroke-cyan-500 fill-cyan-950/40",
    ORGANIZATION: "stroke-purple-500 fill-purple-950/40",
    LOCATION:     "stroke-emerald-500 fill-emerald-950/40",
    OBJECT:       "stroke-yellow-500 fill-yellow-950/40",
    CONCEPT:      "stroke-pink-500 fill-pink-950/40",
};



export default function GraphWorkspacePage() {
    const params = useParams();
    const caseId = params.id as string;

    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [loading, setLoading] = useState(true);
    const [positions, setPositions] = useState<Record<string, Position>>({});
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
    const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
    const [inspectorTab, setInspectorTab] = useState<"node" | "ai">("node");
    const [isRightCollapsed, setIsRightCollapsed] = useState(false);
    const [rightWidth, setRightWidth] = useState(320);
    const [isResizingRight, setIsResizingRight] = useState(false);

    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizingRight(true);
    };

    useEffect(() => {
        if (!isResizingRight) return;

        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(220, Math.min(500, window.innerWidth - e.clientX));
            setRightWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizingRight(false);
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isResizingRight]);

    const svgRef = useRef<SVGSVGElement>(null);
    const rafRef = useRef<number | null>(null);
    const dragStart = useRef({ x: 0, y: 0 });

    const fetchGraph = async () => {
        setLoading(true);
        try {
            const data = await graphApi.getGraph(caseId);
            setNodes(data.nodes ?? []);
            setEdges(data.edges ?? []);
            const pos: Record<string, Position> = {};
            data.nodes.forEach((n, i) => {
                const a = (i / data.nodes.length) * 2 * Math.PI;
                pos[n.id] = { x: 400 + 200 * Math.cos(a) + (Math.random() - 0.5) * 30, y: 300 + 200 * Math.sin(a) + (Math.random() - 0.5) * 30, vx: 0, vy: 0 };
            });
            setPositions(pos);
            setSelectedNode(null);
        } catch { toast.error("Failed to load graph"); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchGraph(); }, [caseId]);

    useEffect(() => {
        if (loading || !nodes.length) return;
        const run = () => {
            setPositions(prev => {
                const next = { ...prev };
                const f: Record<string, { fx: number; fy: number }> = {};
                nodes.forEach(n => { f[n.id] = { fx: 0, fy: 0 }; });
                nodes.forEach((n1, i) => {
                    const p1 = next[n1.id]; if (!p1) return;
                    for (let j = i + 1; j < nodes.length; j++) {
                        const n2 = nodes[j]; const p2 = next[n2.id]; if (!p2) continue;
                        const dx = p1.x - p2.x, dy = p1.y - p2.y;
                        const d2 = dx * dx + dy * dy + 0.1, d = Math.sqrt(d2);
                        if (d < 220) { const r = 800 / d2; f[n1.id].fx += dx/d*r; f[n1.id].fy += dy/d*r; f[n2.id].fx -= dx/d*r; f[n2.id].fy -= dy/d*r; }
                    }
                });
                edges.forEach(e => {
                    const pf = next[e.from], pt = next[e.to]; if (!pf || !pt) return;
                    const dx = pt.x - pf.x, dy = pt.y - pf.y, d = Math.sqrt(dx*dx+dy*dy)||0.1;
                    const s = 0.08 * (d - 140);
                    f[e.from].fx += dx/d*s; f[e.from].fy += dy/d*s; f[e.to].fx -= dx/d*s; f[e.to].fy -= dy/d*s;
                });
                nodes.forEach(n => { const p = next[n.id]; if (!p) return; f[n.id].fx -= (p.x-400)*0.02; f[n.id].fy -= (p.y-300)*0.02; });
                nodes.forEach(n => {
                    if (n.id === draggedNodeId) return;
                    const p = next[n.id], fn = f[n.id]; if (!p || !fn) return;
                    const vx = (p.vx + fn.fx) * 0.85, vy = (p.vy + fn.fy) * 0.85;
                    next[n.id] = { x: Math.max(20, Math.min(780, p.x+vx)), y: Math.max(20, Math.min(580, p.y+vy)), vx, vy };
                });
                return next;
            });
            rafRef.current = requestAnimationFrame(run);
        };
        rafRef.current = requestAnimationFrame(run);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [nodes, edges, loading, draggedNodeId]);

    const isConnected = (id: string) => !selectedNode || selectedNode.id === id || edges.some(e => (e.from === selectedNode.id && e.to === id) || (e.to === selectedNode.id && e.from === id));
    const selectedConns = selectedNode ? edges.filter(e => e.from === selectedNode.id || e.to === selectedNode.id) : [];

    const mostConnected = (() => {
        if (!nodes.length) return "—";
        const counts: Record<string, number> = {};
        edges.forEach(e => { counts[e.from] = (counts[e.from]||0)+1; counts[e.to] = (counts[e.to]||0)+1; });
        const topId = Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0];
        return nodes.find(n => n.id === topId)?.name ?? "—";
    })();

    return (
        <div className={`flex h-full w-full bg-black text-white overflow-hidden ${isResizingRight ? "select-none cursor-col-resize" : ""}`}>
            {/* Main Canvas Area */}
            <div className="flex-grow flex flex-col min-w-0 h-full relative">
                {/* Toolbar */}
                <div className="absolute top-4 left-4 z-20 flex gap-1.5">
                    {[
                        { icon: RefreshCw, action: fetchGraph, title: "Refresh graph", spin: loading },
                        { icon: ZoomIn,    action: () => setZoom(z => Math.min(3, z+0.2)),  title: "Zoom in" },
                        { icon: ZoomOut,   action: () => setZoom(z => Math.max(0.3, z-0.2)), title: "Zoom out" },
                        { icon: Maximize2, action: () => { setZoom(1); setPan({x:0,y:0}); }, title: "Reset view" },
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

                {/* Label */}
                <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-black/80 border border-zinc-800 px-3 py-2 backdrop-blur-sm">
                    <GitFork size={11} className="text-zinc-500" />
                    <span className="font-mono text-xs tracking-widest text-zinc-500 font-bold uppercase">GRAPH WORKSPACE</span>
                </div>

                {loading ? (
                    <div className="h-full flex items-center justify-center gap-2 text-zinc-500 font-mono text-xs uppercase">
                        <Loader2 size={14} className="animate-spin" /><span>SYNCHRONIZING NODES...</span>
                    </div>
                ) : !nodes.length ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-500 font-mono text-xs uppercase">
                        <HelpCircle size={32} className="text-zinc-800" />
                        <span className="tracking-widest font-bold">NO RELATIONAL EDGES DETECTED</span>
                        <span className="text-[10px] max-w-xs text-center leading-relaxed">Upload and process evidence files to populate the entity network.</span>
                    </div>
                ) : (
                    <svg ref={svgRef} className="w-full h-full bg-black cursor-grab active:cursor-grabbing"
                        onMouseDown={e => { if (e.target === svgRef.current) { setIsDraggingCanvas(true); dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; } }}
                        onMouseMove={e => {
                            if (isDraggingCanvas) { setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }); }
                            else if (draggedNodeId && svgRef.current) {
                                const r = svgRef.current.getBoundingClientRect();
                                setPositions(prev => ({ ...prev, [draggedNodeId]: { x: Math.max(10, Math.min(790, (e.clientX-r.left-pan.x)/zoom)), y: Math.max(10, Math.min(590, (e.clientY-r.top-pan.y)/zoom)), vx:0, vy:0 } }));
                            }
                        }}
                        onMouseUp={() => { setIsDraggingCanvas(false); setDraggedNodeId(null); }}
                        onMouseLeave={() => { setIsDraggingCanvas(false); setDraggedNodeId(null); }}
                        onWheel={e => { e.preventDefault(); setZoom(z => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001))); }}
                        viewBox="0 0 800 600">
                        <defs>
                            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                            {edges.map((edge, i) => {
                                const fp = positions[edge.from], tp = positions[edge.to];
                                if (!fp || !tp) return null;
                                const dimmed = selectedNode && edge.from !== selectedNode.id && edge.to !== selectedNode.id;
                                const hi = selectedNode && (edge.from === selectedNode.id || edge.to === selectedNode.id);
                                return (
                                    <g key={i}>
                                        <line x1={fp.x} y1={fp.y} x2={tp.x} y2={tp.y}
                                            className={`transition-all duration-300 ${hi ? "stroke-white/40 stroke-[1.5px]" : "stroke-zinc-800 stroke-[1px]"} ${dimmed ? "opacity-10" : "opacity-100"}`} />
                                        {hi && <text x={(fp.x+tp.x)/2} y={(fp.y+tp.y)/2-4} textAnchor="middle" className="fill-zinc-500 font-mono text-[7px] uppercase tracking-wider pointer-events-none select-none">{edge.type}</text>}
                                    </g>
                                );
                            })}
                            {nodes.map(node => {
                                const pos = positions[node.id]; if (!pos) return null;
                                const isSel = selectedNode?.id === node.id;
                                const dimmed = !isConnected(node.id);
                                return (
                                    <g key={node.id} transform={`translate(${pos.x},${pos.y})`}
                                        onClick={e => { e.stopPropagation(); setSelectedNode(isSel ? null : node); }}
                                        onMouseEnter={() => setHoveredNode(node.id)}
                                        onMouseLeave={() => setHoveredNode(null)}
                                        onMouseDown={e => { e.stopPropagation(); setDraggedNodeId(node.id); }}
                                        className="cursor-pointer">
                                        <circle r={isSel ? 10 : 8} className={`${NODE_COLORS[node.type.toUpperCase()] ?? "stroke-zinc-500 fill-zinc-950"} stroke-2 transition-all duration-200 ${dimmed ? "opacity-20" : "opacity-100"}`} />
                                        <text y={-14} textAnchor="middle" className={`font-mono text-[9px] uppercase tracking-wider fill-white select-none pointer-events-none ${dimmed ? "opacity-20" : ""}`}>{node.name}</text>
                                        {(hoveredNode === node.id || isSel) && <text y={20} textAnchor="middle" className="fill-zinc-500 font-mono text-[7px] tracking-widest uppercase select-none pointer-events-none">{node.type}</text>}
                                    </g>
                                );
                            })}
                        </g>
                    </svg>
                )}

                {/* Stats */}
                {!loading && nodes.length > 0 && (
                    <div className="absolute bottom-4 left-4 bg-black/80 border border-zinc-800 px-3 py-2 backdrop-blur-sm font-mono text-[10px] text-zinc-500 uppercase">
                        {nodes.length} ENTITIES · {edges.length} RELATIONSHIPS · ZOOM {Math.round(zoom*100)}%
                    </div>
                )}
            </div>

            {/* Custom AI sidebar resize handle */}
            {!isRightCollapsed && (
                <div 
                    onMouseDown={startResizing}
                    className={`w-[3px] hover:w-[5px] cursor-col-resize bg-zinc-900 hover:bg-zinc-700 transition-all shrink-0 select-none ${
                        isResizingRight ? "bg-zinc-500 w-[5px]" : ""
                    }`}
                />
            )}
            {isRightCollapsed && (
                <div className="w-[1px] bg-zinc-900 shrink-0" />
            )}

            {/* Custom AI sidebar / Inspector panel container */}
            <div 
                style={{ width: isRightCollapsed ? 48 : rightWidth }}
                className="shrink-0 h-full overflow-hidden border-l border-zinc-900 bg-zinc-950/10"
            >
                {isRightCollapsed ? (
                    <div className="flex flex-col items-center py-4 w-full h-full text-center select-none">
                        <button
                            onClick={() => setIsRightCollapsed(false)}
                            title="EXPAND PANEL"
                            className="p-1 text-zinc-500 hover:text-white transition-colors shrink-0 mb-6"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <div className="w-7 h-7 rounded-none border border-zinc-800 flex items-center justify-center text-zinc-455 bg-black shrink-0">
                            <GitFork size={13} className="text-zinc-500 animate-pulse" />
                        </div>
                        <div className="flex-1 flex items-center justify-center w-full overflow-hidden mt-10">
                            <span 
                                className="font-mono text-[9px] tracking-[0.25em] text-zinc-500 font-bold uppercase whitespace-nowrap block"
                                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                            >
                                {inspectorTab === "node" ? "GRAPH INSPECTOR" : "GRAPH AI"}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col h-full w-full overflow-hidden">
                        {/* Tabs Header */}
                        <div className="flex shrink-0 items-center bg-black/40 border-b border-zinc-800 h-[45px]">
                            <button
                                onClick={() => setIsRightCollapsed(true)}
                                title="COLLAPSE PANEL"
                                className="px-3 h-full flex items-center justify-center text-zinc-500 hover:text-white transition-colors border-r border-zinc-900"
                            >
                                <ChevronRight size={14} />
                            </button>
                            {(["node", "ai"] as const).map(tab => (
                                <button key={tab} onClick={() => setInspectorTab(tab)}
                                    className={`flex-1 h-full font-mono text-[10px] tracking-widest uppercase transition-colors border-b-2 ${
                                        inspectorTab === tab ? "text-white border-b-white font-bold" : "text-zinc-500 hover:text-white border-b-transparent"
                                    }`}>
                                    {tab === "node" ? "INSPECTOR" : "AI"}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-hidden">
                            {inspectorTab === "node" ? (
                                <div className="h-full overflow-y-auto p-4 space-y-4 font-mono text-xs">
                                    {selectedNode ? (
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-zinc-500 tracking-widest uppercase font-semibold text-[9px] mb-1">ENTITY</p>
                                                <h4 className="text-white uppercase tracking-wide break-words font-bold">{selectedNode.name}</h4>
                                            </div>
                                            <div>
                                                <p className="text-zinc-500 tracking-widest uppercase font-semibold text-[9px] mb-1">TYPE</p>
                                                <span className="px-1.5 py-0.5 border border-zinc-800 text-zinc-400 font-mono text-[10px] uppercase font-bold tracking-wider leading-none">
                                                    {selectedNode.type}
                                                </span>
                                            </div>
                                            <div className="h-px bg-zinc-900 w-full" />
                                            <div>
                                                <p className="text-zinc-500 tracking-widest uppercase font-semibold text-[9px] mb-2">CONNECTIONS ({selectedConns.length})</p>
                                                {selectedConns.length === 0 ? (
                                                    <p className="text-zinc-650 text-[10px] uppercase font-medium">No connections indexed.</p>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        {selectedConns.map((edge, i) => {
                                                            const otherId = edge.from === selectedNode.id ? edge.to : edge.from;
                                                            const other = nodes.find(n => n.id === otherId);
                                                            return (
                                                                <div key={i} onClick={() => other && setSelectedNode(other)}
                                                                    className="border border-zinc-900 p-2.5 hover:border-zinc-700 bg-zinc-950/20 hover:bg-zinc-900/10 cursor-pointer transition-colors space-y-0.5">
                                                                    <div className="flex justify-between text-zinc-500 text-[10px]">
                                                                        <span className="uppercase font-bold">{edge.type}</span>
                                                                        <span className="font-semibold">CONF: {Math.round(edge.confidence*100)}%</span>
                                                                    </div>
                                                                    <p className="text-white text-xs truncate uppercase font-bold">{edge.from === selectedNode.id ? "→" : "←"} {other?.name ?? "UNKNOWN"}</p>
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
                                    suggestions={[
                                        "Explain this relationship",
                                        "Find suspicious links",
                                        "Summarize entity",
                                        "Who is connected?",
                                        "Find hidden patterns"
                                    ]}
                                    placeholder="ASK ABOUT GRAPH..."
                                    selectedItemName={selectedNode?.name}
                                    contextType="Entity Topology Resolver"
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
