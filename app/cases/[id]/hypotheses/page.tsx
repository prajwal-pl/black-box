"use client"

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { hypothesisApi, Hypothesis, HypothesisStatus } from "@/lib/api/hypothesis";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, BrainCircuit, RefreshCw, Check, X } from "lucide-react";
import CaseAIPanel from "@/components/case/case-ai-panel";

const AI_SUGGESTIONS = ["Generate new hypothesis","Challenge this hypothesis","Explain confidence score","Suggest missing evidence","Generate report"];

const statusVariant = (s: HypothesisStatus): "outline" => "outline";
const statusClass   = (s: HypothesisStatus) => ({
    CONFIRMED: "text-success border-success/40",
    REJECTED:  "text-warning border-warning/40",
    ACTIVE:    "text-muted-foreground border-border",
}[s]);



export default function HypothesesWorkspacePage() {
    const params = useParams();
    const caseId = params.id as string;

    const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
    const [loading, setLoading] = useState(true);
    const [triggering, setTriggering] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [selected, setSelected] = useState<Hypothesis | null>(null);
    const [isRightCollapsed, setIsRightCollapsed] = useState(false);

    const fetch = async () => {
        setLoading(true);
        try { setHypotheses(await hypothesisApi.getByCase(caseId) ?? []); }
        catch { toast.error("Failed to retrieve hypotheses"); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetch(); }, [caseId]);

    const updateStatus = async (id: string, status: HypothesisStatus) => {
        setUpdatingId(id);
        try {
            const updated = await hypothesisApi.updateStatus(id, status);
            setHypotheses(prev => prev.map(h => h.id === id ? updated : h));
            toast.success(`Hypothesis → ${status}`);
        } catch { toast.error("Failed to update hypothesis"); }
        finally { setUpdatingId(null); }
    };

    const triggerReasoning = async () => {
        setTriggering(true);
        try { await hypothesisApi.triggerUpdate(caseId); setTimeout(fetch, 4000); }
        catch { setTriggering(false); }
    };

    return (
        <div className="flex h-full w-full bg-black text-white overflow-hidden">
            {/* Main Workspace Area */}
            <div className="flex-grow flex flex-col min-w-0 h-full">
                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between shrink-0 border-b border-zinc-800 h-[45px]">
                    <div className="flex items-center gap-2">
                        <BrainCircuit size={13} className="text-muted-foreground" />
                        <span className="font-mono text-xs tracking-widest text-muted-foreground font-bold uppercase">HYPOTHESIS LAB</span>
                        {!loading && <span className="font-mono text-xs text-zinc-500 font-semibold">({hypotheses.length})</span>}
                    </div>
                    <button
                        onClick={triggerReasoning}
                        disabled={triggering || loading}
                        className="px-3 py-1 bg-transparent hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-colors font-mono text-[10px] tracking-widest uppercase font-bold"
                    >
                        {triggering ? "COMPUTING..." : "RE-EVALUATE"}
                    </button>
                </div>

                {loading ? (
                    <div className="flex-grow flex items-center justify-center gap-2 text-zinc-500 font-mono text-xs uppercase">
                        <Loader2 size={14} className="animate-spin" /><span>SYNCHRONIZING INFERENCE SYSTEM...</span>
                    </div>
                ) : !hypotheses.length ? (
                    <div className="flex-grow flex flex-col items-center justify-center gap-3 text-zinc-500 font-mono text-xs uppercase select-none">
                        <BrainCircuit size={32} className="text-zinc-800" />
                        <span className="tracking-widest font-bold">NO HYPOTHESES FORMULATED</span>
                        <span className="text-[10px] max-w-xs text-center leading-relaxed">The reasoning engine requires processed evidence to generate inference chains.</span>
                        <button
                            onClick={triggerReasoning}
                            disabled={triggering}
                            className="px-3.5 py-1.5 bg-transparent hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-450 hover:text-white transition-colors font-mono text-[10px] tracking-widest uppercase font-bold mt-2"
                        >
                            TRIGGER REASONING ENGINE
                        </button>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-5 space-y-3">
                        <AnimatePresence>
                            {hypotheses.map((h, i) => {
                                const isSel = selected?.id === h.id;
                                const isUpd = updatingId === h.id;
                                return (
                                    <motion.div
                                        key={h.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2, delay: i * 0.04 }}
                                        onClick={() => setSelected(isSel ? null : h)}
                                        className={`border p-4 space-y-3 cursor-pointer transition-colors uppercase font-mono ${
                                            isSel ? "border-zinc-500 bg-zinc-950/20" : "border-zinc-900 hover:border-zinc-800"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <p className="text-xs text-white leading-relaxed flex-1 font-semibold">{h.content}</p>
                                            <span className={`px-1.5 py-0.5 border text-[10px] font-bold shrink-0 ${statusClass(h.status)}`}>
                                                {h.status}
                                            </span>
                                        </div>
                                        {/* Confidence bar */}
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-[10px] text-zinc-500 font-bold">
                                                <span>CONFIDENCE</span>
                                                <span className="text-white">{Math.round(h.confidence*100)}%</span>
                                            </div>
                                            <div className="h-[2px] bg-zinc-900 overflow-hidden">
                                                <div 
                                                    className={`h-full transition-all duration-500 ${
                                                        h.confidence >= 0.75 ? "bg-emerald-500" : h.confidence >= 0.5 ? "bg-yellow-500" : "bg-red-500"
                                                    }`}
                                                    style={{ width: `${h.confidence*100}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold pt-2 border-t border-zinc-900/60" onClick={e => e.stopPropagation()}>
                                            <span>{new Date(h.createdAt).toLocaleDateString()} · REF: {h.id.slice(0,8).toUpperCase()}</span>
                                            {isUpd ? (
                                                <Loader2 size={12} className="animate-spin text-zinc-500" />
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    {h.status !== "CONFIRMED" && (
                                                        <button
                                                            onClick={() => updateStatus(h.id, "CONFIRMED")}
                                                            className="px-2 py-1 border border-zinc-850 hover:border-emerald-500 hover:text-emerald-500 transition-colors font-bold text-[9px]"
                                                        >
                                                            CONFIRM
                                                        </button>
                                                    )}
                                                    {h.status !== "REJECTED" && (
                                                        <button
                                                            onClick={() => updateStatus(h.id, "REJECTED")}
                                                            className="px-2 py-1 border border-zinc-850 hover:border-red-500 hover:text-red-500 transition-colors font-bold text-[9px]"
                                                        >
                                                            REJECT
                                                        </button>
                                                    )}
                                                    {h.status !== "ACTIVE" && (
                                                        <button
                                                            onClick={() => updateStatus(h.id, "ACTIVE")}
                                                            className="px-2 py-1 border border-zinc-850 hover:border-white hover:text-white transition-colors font-bold text-[9px]"
                                                        >
                                                            ACTIVATE
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Custom AI sidebar panel container */}
            <div className={`transition-all duration-300 ease-in-out shrink-0 h-full ${
                isRightCollapsed ? "w-12" : "w-[320px]"
            }`}>
                <CaseAIPanel
                    title="HYPOTHESIS AI"
                    suggestions={[
                        "Generate new hypothesis",
                        "Challenge this hypothesis",
                        "Explain confidence score",
                        "Suggest missing evidence",
                        "Generate report"
                    ]}
                    placeholder="ASK ABOUT HYPOTHESES..."
                    selectedItemName={selected ? `HYPOTHESIS ${selected.id.slice(0, 6)}` : null}
                    contextType="Hypothesis Lab Reasoning Engine"
                    isCollapsed={isRightCollapsed}
                    onToggleCollapse={() => setIsRightCollapsed(!isRightCollapsed)}
                />
            </div>
        </div>
    );
}
