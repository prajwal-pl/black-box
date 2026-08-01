"use client"

import React, { useState, useEffect } from "react";
import { hypothesisApi, Hypothesis, HypothesisStatus } from "@/lib/api/hypothesis";
import { Loader2, BrainCircuit, RefreshCw, Check, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface HypothesesLabProps {
    caseId: string;
}

export default function HypothesesLab({ caseId }: HypothesesLabProps) {
    const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
    const [loading, setLoading] = useState(true);
    const [triggering, setTriggering] = useState(false);
    
    // Status update mapping to prevent duplicate updates
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const fetchHypotheses = async () => {
        setLoading(true);
        try {
            const data = await hypothesisApi.getByCase(caseId);
            setHypotheses(data || []);
        } catch (error) {
            console.error("Failed to load hypotheses:", error);
            toast.error("FAILED TO RETRIEVE HYPOTHESES SCHEMATICS");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHypotheses();
    }, [caseId]);

    const handleUpdateStatus = async (id: string, newStatus: HypothesisStatus) => {
        setUpdatingId(id);
        try {
            const updated = await hypothesisApi.updateStatus(id, newStatus);
            setHypotheses((prev) =>
                prev.map((h) => (h.id === id ? updated : h))
            );
            toast.success(`HYPOTHESIS STATE MOVED TO ${newStatus}`);
        } catch (error) {
            console.error("Failed to update status:", error);
            toast.error("FAILED TO CHANGE HYPOTHESIS STATE");
        } finally {
            setUpdatingId(null);
        }
    };

    const handleTriggerReasoning = async () => {
        setTriggering(true);
        try {
            await hypothesisApi.triggerUpdate(caseId);
            toast.success("REASONING ENGINE INGESTION DISPATCHED");
            // Wait 4 seconds then refetch to give background queue worker time to process
            setTimeout(fetchHypotheses, 4000);
        } catch (error) {
            console.error("Failed to trigger update:", error);
            toast.error("FAILED TO ENQUEUE REASONING TASK");
            setTriggering(false);
        }
    };

    const getStatusStyle = (status: HypothesisStatus) => {
        switch (status) {
            case "CONFIRMED":
                return "border-success text-success bg-success/5";
            case "REJECTED":
                return "border-warning text-warning bg-warning/5";
            default:
                return "border-zinc-700 text-zinc-400";
        }
    };

    return (
        <div className="border border-hairline bg-zinc-950/10 p-6 space-y-6 text-left relative">
            <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 border-t border-l border-white/30" />
            <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 border-t border-r border-white/30" />

            {/* Title / Controls Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-hairline pb-4 select-none">
                <h3 className="font-mono text-xs tracking-wider text-zinc-400 uppercase flex items-center space-x-1.5">
                    <BrainCircuit size={12} />
                    <span>HYPOTHESES INFERENCE LAB ({hypotheses.length})</span>
                </h3>

                <button
                    onClick={handleTriggerReasoning}
                    disabled={triggering || loading}
                    className="flex items-center space-x-2 font-mono text-xs tracking-wider text-white hover:bg-white hover:text-black transition-all bg-transparent border border-hairline py-1.5 px-3 uppercase disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-white"
                >
                    {triggering ? (
                        <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>COMPUTING INFERENCES...</span>
                        </>
                    ) : (
                        <>
                            <RefreshCw size={12} />
                            <span>RE-EVALUATE HYPOTHESES</span>
                        </>
                    )}
                </button>
            </div>

            {loading && !triggering ? (
                <div className="py-20 flex items-center justify-center space-x-2 text-zinc-400 font-mono text-xs select-none">
                    <Loader2 size={14} className="animate-spin" />
                    <span>SYNCHRONIZING INFERENCE SYSTEM...</span>
                </div>
            ) : hypotheses.length === 0 ? (
                <div className="py-16 text-center text-zinc-500 font-mono text-xs space-y-2 select-none">
                    <BrainCircuit size={28} className="text-zinc-700 mx-auto" />
                    <p className="uppercase font-bold tracking-wider">NO HYPOTHESES FORMULATED</p>
                    <p className="text-[11px] text-zinc-600 max-w-xs mx-auto leading-relaxed">
                        The reasoning engine hasn't parsed the document cluster or generated any predictions. Ingest payload resources.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {hypotheses.map((hypothesis) => {
                        const isUpdating = updatingId === hypothesis.id;
                        
                        return (
                            <div 
                                key={hypothesis.id}
                                className="border border-hairline bg-zinc-950/20 p-5 space-y-4 hover:bg-zinc-950/40 transition-colors"
                            >
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                    <div className="space-y-3 pr-2 flex-grow">
                                        <p className="font-mono text-xs text-white leading-relaxed uppercase break-words select-text">
                                            {hypothesis.content}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-3 font-mono text-[9px] text-zinc-400 select-none">
                                            <span>PROPOSED: {new Date(hypothesis.createdAt).toLocaleDateString()}</span>
                                            <span>•</span>
                                            <span>REF_ID: {hypothesis.id.slice(0, 8).toUpperCase()}</span>
                                        </div>
                                    </div>

                                    {/* Actions & Status details */}
                                    <div className="shrink-0 space-y-3 w-full sm:w-auto font-mono text-xs">
                                        {/* Confidence meter */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] text-zinc-400">
                                                <span>CONFIDENCE</span>
                                                <span className="font-bold text-white">
                                                    {Math.round(hypothesis.confidence * 100)}%
                                                </span>
                                            </div>
                                            <div className="w-full sm:w-36 h-2 bg-hairline-strong rounded-none overflow-hidden border border-hairline">
                                                <div 
                                                    className={`h-full transition-all duration-500 ${
                                                        hypothesis.confidence >= 0.75 ? "bg-success" :
                                                        hypothesis.confidence >= 0.5 ? "bg-yellow-500" : "bg-warning"
                                                    }`}
                                                    style={{ width: `${hypothesis.confidence * 100}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Status and Action Buttons */}
                                        <div className="flex items-center justify-between sm:justify-end gap-2.5">
                                            <span className={`px-2 py-0.5 border font-semibold text-[9px] uppercase tracking-wider ${getStatusStyle(hypothesis.status)}`}>
                                                {hypothesis.status}
                                            </span>

                                            {isUpdating ? (
                                                <Loader2 size={12} className="animate-spin text-zinc-400" />
                                            ) : (
                                                <div className="flex items-center space-x-1">
                                                    {hypothesis.status !== "CONFIRMED" && (
                                                        <button
                                                            onClick={() => handleUpdateStatus(hypothesis.id, "CONFIRMED")}
                                                            className="p-1 border border-zinc-800 hover:border-success hover:bg-success/10 text-zinc-400 hover:text-success transition-all"
                                                            title="Confirm hypothesis"
                                                        >
                                                            <Check size={12} />
                                                        </button>
                                                    )}
                                                    {hypothesis.status !== "REJECTED" && (
                                                        <button
                                                            onClick={() => handleUpdateStatus(hypothesis.id, "REJECTED")}
                                                            className="p-1 border border-zinc-800 hover:border-warning hover:bg-warning/10 text-zinc-400 hover:text-warning transition-all"
                                                            title="Reject hypothesis"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                    {hypothesis.status !== "ACTIVE" && (
                                                        <button
                                                            onClick={() => handleUpdateStatus(hypothesis.id, "ACTIVE")}
                                                            className="px-2 py-0.5 border border-zinc-800 hover:border-white text-zinc-400 hover:text-white transition-all text-[9px]"
                                                        >
                                                            ACTIVATE
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
