"use client"

import React, { useState, useEffect, useRef } from "react";
import { graphApi, GraphNode, GraphEdge } from "@/lib/api/graph";
import { Loader2, RefreshCw, ZoomIn, ZoomOut, Maximize2, Info, HelpCircle } from "lucide-react";
import { toast } from "sonner";

interface Position {
    x: number;
    y: number;
    vx: number;
    vy: number;
}

interface GraphVisualizerProps {
    caseId: string;
}

export default function GraphVisualizer({ caseId }: GraphVisualizerProps) {
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [loading, setLoading] = useState(true);
    const [positions, setPositions] = useState<Record<string, Position>>({});
    
    // UI state
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
    const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
    
    const svgRef = useRef<SVGSVGElement>(null);
    const requestRef = useRef<number | null>(null);
    const dragStart = useRef({ x: 0, y: 0 });

    const fetchGraphData = async () => {
        setLoading(true);
        try {
            const data = await graphApi.getGraph(caseId);
            setNodes(data.nodes || []);
            setEdges(data.edges || []);
            
            // Initialize positions
            const newPositions: Record<string, Position> = {};
            const center = { x: 300, y: 250 };
            const radius = Math.min(center.x, center.y) * 0.7;
            
            data.nodes.forEach((node, i) => {
                const angle = (i / data.nodes.length) * 2 * Math.PI;
                newPositions[node.id] = {
                    x: center.x + radius * Math.cos(angle) + (Math.random() - 0.5) * 20,
                    y: center.y + radius * Math.sin(angle) + (Math.random() - 0.5) * 20,
                    vx: 0,
                    vy: 0,
                };
            });
            setPositions(newPositions);
            setSelectedNode(null);
        } catch (error) {
            console.error("Failed to load graph data:", error);
            toast.error("FAILED TO LOAD RELATIONAL GRAPH DATA");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGraphData();
    }, [caseId]);

    // Force simulation loop
    useEffect(() => {
        if (loading || nodes.length === 0) return;

        const runSimulation = () => {
            setPositions((prev) => {
                const next = { ...prev };
                const k = 0.08; // Spring stiffness
                const repulsion = 800; // Repulsive force coefficient
                const gravity = 0.02; // Pull to center
                const center = { x: 300, y: 250 };
                const friction = 0.85;

                // 1. Initialize forces
                const forces: Record<string, { fx: number; fy: number }> = {};
                nodes.forEach((n) => {
                    forces[n.id] = { fx: 0, fy: 0 };
                });

                // 2. Repulsion between all node pairs
                nodes.forEach((n1, i) => {
                    const pos1 = next[n1.id];
                    if (!pos1) return;
                    for (let j = i + 1; j < nodes.length; j++) {
                        const n2 = nodes[j];
                        const pos2 = next[n2.id];
                        if (!pos2) continue;

                        const dx = pos1.x - pos2.x;
                        const dy = pos1.y - pos2.y;
                        const distSq = dx * dx + dy * dy + 0.1;
                        const dist = Math.sqrt(distSq);

                        if (dist < 220) {
                            const force = repulsion / distSq;
                            const fx = (dx / dist) * force;
                            const fy = (dy / dist) * force;

                            forces[n1.id].fx += fx;
                            forces[n1.id].fy += fy;
                            forces[n2.id].fx -= fx;
                            forces[n2.id].fy -= fy;
                        }
                    }
                });

                // 3. Spring forces along edges
                edges.forEach((edge) => {
                    const posFrom = next[edge.from];
                    const posTo = next[edge.to];
                    if (!posFrom || !posTo) return;

                    const dx = posTo.x - posFrom.x;
                    const dy = posTo.y - posFrom.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
                    const restLength = 140;

                    // Spring force: F = k * (x - L)
                    const force = k * (dist - restLength);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;

                    forces[edge.from].fx += fx;
                    forces[edge.from].fy += fy;
                    forces[edge.to].fx -= fx;
                    forces[edge.to].fy -= fy;
                });

                // 4. Center gravity
                nodes.forEach((node) => {
                    const pos = next[node.id];
                    if (!pos) return;
                    forces[node.id].fx -= (pos.x - center.x) * gravity;
                    forces[node.id].fy -= (pos.y - center.y) * gravity;
                });

                // 5. Update positions & velocities
                nodes.forEach((node) => {
                    if (node.id === draggedNodeId) return; // Don't move if dragging

                    const pos = next[node.id];
                    const force = forces[node.id];
                    if (!pos || !force) return;

                    const vx = (pos.vx + force.fx) * friction;
                    const vy = (pos.vy + force.fy) * friction;

                    next[node.id] = {
                        x: Math.max(20, Math.min(580, pos.x + vx)),
                        y: Math.max(20, Math.min(480, pos.y + vy)),
                        vx,
                        vy,
                    };
                });

                return next;
            });

            requestRef.current = requestAnimationFrame(runSimulation);
        };

        requestRef.current = requestAnimationFrame(runSimulation);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [nodes, edges, loading, draggedNodeId]);

    // Color mapper for entity types
    const getNodeStyle = (type: string, isSelected: boolean, isDimmed: boolean) => {
        let color = "stroke-zinc-500 fill-zinc-950";
        let labelColor = "text-zinc-400";
        
        switch (type.toUpperCase()) {
            case "PERSON":
                color = "stroke-cyan-500 fill-cyan-950/40";
                break;
            case "ORGANIZATION":
                color = "stroke-purple-500 fill-purple-950/40";
                break;
            case "LOCATION":
                color = "stroke-emerald-500 fill-emerald-950/40";
                break;
            case "OBJECT":
                color = "stroke-yellow-500 fill-yellow-950/40";
                break;
            case "CONCEPT":
                color = "stroke-pink-500 fill-pink-950/40";
                break;
        }

        return {
            circleClass: `${color} stroke-2 transition-all duration-300 ${
                isSelected ? "stroke-[3px] scale-125 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" : ""
            } ${isDimmed ? "opacity-30" : "opacity-100"}`,
            textClass: `font-mono text-[9px] uppercase tracking-wider fill-white select-none pointer-events-none transition-all duration-300 ${
                isDimmed ? "opacity-20" : "opacity-100"
            }`
        };
    };

    // Canvas panning handlers
    const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
        if (e.target === svgRef.current) {
            setIsDraggingCanvas(true);
            dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        }
    };

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (isDraggingCanvas) {
            setPan({
                x: e.clientX - dragStart.current.x,
                y: e.clientY - dragStart.current.y,
            });
        } else if (draggedNodeId && positions[draggedNodeId]) {
            // Drag node
            if (!svgRef.current) return;
            const rect = svgRef.current.getBoundingClientRect();
            
            // Convert page coordinates to SVG viewbox coordinates (accounting for zoom & pan)
            const x = (e.clientX - rect.left - pan.x) / zoom;
            const y = (e.clientY - rect.top - pan.y) / zoom;

            setPositions((prev) => ({
                ...prev,
                [draggedNodeId]: {
                    x: Math.max(10, Math.min(590, x)),
                    y: Math.max(10, Math.min(490, y)),
                    vx: 0,
                    vy: 0,
                },
            }));
        }
    };

    const handleMouseUp = () => {
        setIsDraggingCanvas(false);
        setDraggedNodeId(null);
    };

    const handleNodeDragStart = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDraggedNodeId(id);
    };

    // Connections checking for dimming unselected elements
    const isNodeConnected = (id: string) => {
        if (!selectedNode) return true;
        if (selectedNode.id === id) return true;
        return edges.some(
            (edge) => (edge.from === selectedNode.id && edge.to === id) || (edge.to === selectedNode.id && edge.from === id)
        );
    };

    const isEdgeConnected = (edge: GraphEdge) => {
        if (!selectedNode) return true;
        return edge.from === selectedNode.id || edge.to === selectedNode.id;
    };

    // Render node details list
    const selectedNodeConnections = selectedNode
        ? edges.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id)
        : [];

    return (
        <div className="border border-hairline bg-zinc-950/10 grid grid-cols-1 md:grid-cols-4 select-none relative overflow-hidden">
            {/* Action buttons overlay */}
            <div className="absolute top-4 left-4 z-20 flex space-x-2">
                <button
                    onClick={fetchGraphData}
                    className="p-2 border border-hairline bg-black/60 hover:bg-black text-zinc-400 hover:text-white transition-colors"
                    title="Recalculate layout"
                >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
                <button
                    onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
                    className="p-2 border border-hairline bg-black/60 hover:bg-black text-zinc-400 hover:text-white transition-colors"
                    title="Zoom in"
                >
                    <ZoomIn size={14} />
                </button>
                <button
                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
                    className="p-2 border border-hairline bg-black/60 hover:bg-black text-zinc-400 hover:text-white transition-colors"
                    title="Zoom out"
                >
                    <ZoomOut size={14} />
                </button>
                <button
                    onClick={() => {
                        setZoom(1);
                        setPan({ x: 0, y: 0 });
                    }}
                    className="p-2 border border-hairline bg-black/60 hover:bg-black text-zinc-400 hover:text-white transition-colors"
                    title="Recenter view"
                >
                    <Maximize2 size={14} />
                </button>
            </div>

            {/* SVG Visualizer Canvas */}
            <div className="md:col-span-3 h-[500px] border-r border-hairline relative bg-black/40 overflow-hidden cursor-grab active:cursor-grabbing">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center space-x-2 text-zinc-400 font-mono text-xs">
                        <Loader2 size={14} className="animate-spin" />
                        <span>SYNCHRONIZING RELATIONAL NODES...</span>
                    </div>
                ) : nodes.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-zinc-400 font-mono text-xs space-y-2 select-none">
                        <HelpCircle size={28} className="text-zinc-600" />
                        <span className="uppercase font-bold tracking-wider">NO RELATIONAL EDGES DETECTED</span>
                        <span className="text-[11px] text-zinc-500 max-w-xs leading-relaxed">
                            Upload evidence files to trigger entity extraction and populate the case network.
                        </span>
                    </div>
                ) : (
                    <svg
                        ref={svgRef}
                        className="w-full h-full"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        viewBox="0 0 600 500"
                    >
                        {/* Grid Pattern Background */}
                        <defs>
                            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />

                        {/* Transform Group */}
                        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                            {/* Render relationship edges */}
                            {edges.map((edge, index) => {
                                const fromPos = positions[edge.from];
                                const toPos = positions[edge.to];
                                if (!fromPos || !toPos) return null;

                                const isDimmed = !isEdgeConnected(edge);
                                const isHighlighted = selectedNode && isEdgeConnected(edge);

                                return (
                                    <g key={`edge-${index}`} className="transition-all duration-300">
                                        <line
                                            x1={fromPos.x}
                                            y1={fromPos.y}
                                            x2={toPos.x}
                                            y2={toPos.y}
                                            className={`stroke-zinc-800 transition-all duration-300 ${
                                                isHighlighted ? "stroke-white/40 stroke-[1.5px]" : "stroke-[1px]"
                                            } ${isDimmed ? "opacity-10" : "opacity-100"}`}
                                        />
                                        {/* Dynamic link type annotation */}
                                        {isHighlighted && (
                                            <text
                                                x={(fromPos.x + toPos.x) / 2}
                                                y={(fromPos.y + toPos.y) / 2 - 4}
                                                className="fill-zinc-400 font-mono text-[7px] uppercase tracking-wider text-center pointer-events-none select-none"
                                                textAnchor="middle"
                                            >
                                                {edge.type}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}

                            {/* Render entity nodes */}
                            {nodes.map((node) => {
                                const pos = positions[node.id];
                                if (!pos) return null;

                                const isSelected = selectedNode?.id === node.id;
                                const isDimmed = !isNodeConnected(node.id);
                                const { circleClass, textClass } = getNodeStyle(node.type, isSelected, isDimmed);

                                return (
                                    <g
                                        key={node.id}
                                        transform={`translate(${pos.x}, ${pos.y})`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedNode(isSelected ? null : node);
                                        }}
                                        onMouseEnter={() => setHoveredNode(node.id)}
                                        onMouseLeave={() => setHoveredNode(null)}
                                        onMouseDown={(e) => handleNodeDragStart(e, node.id)}
                                        className="cursor-pointer"
                                    >
                                        <circle r={8} className={circleClass} />
                                        
                                        {/* Label text */}
                                        <text
                                            y={-14}
                                            textAnchor="middle"
                                            className={textClass}
                                        >
                                            {node.name}
                                        </text>

                                        {/* Hover type indicator */}
                                        {(hoveredNode === node.id || isSelected) && (
                                            <text
                                                y={20}
                                                textAnchor="middle"
                                                className="fill-zinc-500 font-mono text-[7px] tracking-widest uppercase select-none pointer-events-none"
                                            >
                                                {node.type}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </g>
                    </svg>
                )}
            </div>

            {/* Inspector Panel */}
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
                                <h4 className="text-sm font-bold text-white uppercase tracking-wide break-words">
                                    {selectedNode.name}
                                </h4>
                            </div>

                            <div className="space-y-1">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">CLASSIFICATION</span>
                                <span className="inline-block px-2.5 py-0.5 border border-zinc-700 text-zinc-300 font-semibold uppercase text-[10px]">
                                    {selectedNode.type}
                                </span>
                            </div>

                            <div className="space-y-3 pt-2">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block border-b border-hairline-strong pb-1">
                                    RELATIONSHIPS ({selectedNodeConnections.length})
                                </span>
                                {selectedNodeConnections.length === 0 ? (
                                    <p className="text-zinc-500 text-[11px] leading-relaxed uppercase">
                                        No connections indexed.
                                    </p>
                                ) : (
                                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                        {selectedNodeConnections.map((edge, i) => {
                                            const otherNodeId = edge.from === selectedNode.id ? edge.to : edge.from;
                                            const otherNode = nodes.find((n) => n.id === otherNodeId);
                                            const direction = edge.from === selectedNode.id ? "→" : "←";
                                            return (
                                                <div
                                                    key={i}
                                                    onClick={() => otherNode && setSelectedNode(otherNode)}
                                                    className="border border-hairline-strong p-2.5 hover:border-zinc-500 hover:bg-zinc-950/40 cursor-pointer transition-all text-[11px] space-y-1 leading-snug"
                                                >
                                                    <div className="flex justify-between text-zinc-400">
                                                        <span className="uppercase text-[9px] font-bold text-zinc-500">
                                                            {edge.type}
                                                        </span>
                                                        <span>CONF: {Math.round(edge.confidence * 100)}%</span>
                                                    </div>
                                                    <p className="text-white font-bold truncate">
                                                        {direction} {otherNode ? otherNode.name : "UNKNOWN"}
                                                    </p>
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

                {/* Help guide footer */}
                <div className="border-t border-hairline pt-4 font-mono text-[10px] text-zinc-500 leading-relaxed uppercase text-left">
                    <p className="text-zinc-400 font-semibold mb-1">Interactive controls:</p>
                    <p>• Click drag canvas to pan</p>
                    <p>• Scroll wheel to zoom</p>
                    <p>• Drag nodes to reposition</p>
                    <p>• Click node to lock details</p>
                </div>
            </div>
        </div>
    );
}
