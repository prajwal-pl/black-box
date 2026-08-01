"use client"

import React, { useState, useEffect } from "react";
import { contradictionsApi, Contradiction, Severity, ContradictionStatus } from "@/lib/api/contradictions";
import { Evidence } from "@/lib/api/evidence";
import { Loader2, AlertTriangle, RefreshCw, CheckCircle2, ShieldAlert, FileText, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface ContradictionsPanelProps {
    caseId: string;
    evidenceList: Evidence[];
}

export default function ContradictionsPanel({ caseId, evidenceList }: ContradictionsPanelProps) {
    const [contradictions, setContradictions] = useState<Contradiction[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [selectedEvidenceId, setSelectedEvidenceId] = useState("");
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const fetchContradictions = async () => {
        setLoading(true);
        try {
            const data = await contradictionsApi.getByCase(caseId);
            setContradictions(data || []);
        } catch (error) {
            console.error("Failed to load contradictions:", error);
            toast.error("FAILED TO LOAD CONTRADICTION CONTEXTS");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContradictions();
    }, [caseId]);

    const handleUpdateStatus = async (id: string, newStatus: ContradictionStatus) => {
        setUpdatingId(id);
        try {
            const updated = await contradictionsApi.updateStatus(id, newStatus);
            setContradictions((prev) =>
                prev.map((c) => (c.id === id ? updated : c))
            );
            toast.success(`CONTRADICTION IS NOW ${newStatus}`);
        } catch (error) {
            console.error("Failed to update status:", error);
            toast.error("FAILED TO UPDATE STATUS");
        } finally {
            setUpdatingId(null);
        }
    };

    const handleTriggerScan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEvidenceId) {
            toast.error("PLEASE SELECT EVIDENCE SOURCE TO SCAN");
            return;
        }

        setScanning(true);
        try {
            await contradictionsApi.triggerScan(caseId, selectedEvidenceId);
            toast.success("CONTRADICTION SCAN ENQUEUED");
            // Wait 5 seconds to query again
            setTimeout(fetchContradictions, 5000);
        } catch (error) {
            console.error("Failed to scan contradictions:", error);
            toast.error("FAILED TO INITIATE CONTRADICTION SCAN");
            setScanning(false);
        }
    };

    const getSeverityStyle = (severity: Severity) => {
        switch (severity) {
            case "CRITICAL":
                return "border-warning text-warning bg-warning/5 font-bold";
            case "HIGH":
                return "border-orange-500/50 text-orange-400 bg-orange-950/5";
            case "MEDIUM":
                return "border-yellow-500/30 text-yellow-500 bg-yellow-950/5";
            default:
                return "border-zinc-700 text-zinc-500";
        }
    };

    const getStatusBadgeStyle = (status: ContradictionStatus) => {
        switch (status) {
            case "RESOLVED":
                return "border-success text-success bg-success/5";
            case "DISMISSED":
                return "border-zinc-700 text-zinc-500 bg-zinc-950/20";
            default:
                return "border-warning text-warning bg-warning/5";
        }
    };

    // Helper to match evidence ID to fileName
    const getEvidenceFileName = (id: string) => {
        const file = evidenceList.find((e) => e.id === id);
        return file ? file.fileName : `EVIDENCE_${id.slice(0, 6).toUpperCase()}`;
    };

    // Filter active/completed files available for contradiction scans
    const completedEvidence = evidenceList.filter((e) => e.status === "COMPLETED");

    return (
        <div className="border border-hairline bg-zinc-950/10 p-6 space-y-6 text-left relative">
            <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 border-t border-l border-white/30" />
            <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 border-t border-r border-white/30" />

            {/* Header / Trigger Scan area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-hairline pb-4 select-none">
                <h3 className="font-mono text-xs tracking-wider text-zinc-400 uppercase flex items-center space-x-1.5">
                    <ShieldAlert size={12} />
                    <span>CONTRADICTIONS ALERT PANEL ({contradictions.length})</span>
                </h3>

                {/* Scan Trigger Form */}
                {completedEvidence.length > 0 && (
                    <form onSubmit={handleTriggerScan} className="flex flex-wrap items-center gap-2 w-full md:w-auto font-mono text-xs">
                        <select
                            value={selectedEvidenceId}
                            onChange={(e) => setSelectedEvidenceId(e.target.value)}
                            className="bg-black border border-hairline py-1.5 px-3 text-xs text-white max-w-xs focus:outline-none focus:border-white rounded-none cursor-pointer"
                        >
                            <option value="">SELECT EVIDENCE FOR SCAN...</option>
                            {completedEvidence.map((e) => (
                                <option key={e.id} value={e.id}>
                                    {e.fileName.toUpperCase()}
                                </option>
                            ))}
                        </select>
                        <button
                            type="submit"
                            disabled={scanning || !selectedEvidenceId}
                            className="flex items-center space-x-2 border border-hairline hover:bg-white hover:text-black py-1.5 px-3 bg-transparent text-white transition-all uppercase disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-white"
                        >
                            {scanning ? (
                                <>
                                    <Loader2 size={12} className="animate-spin" />
                                    <span>SCANNING INDEX...</span>
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={12} />
                                    <span>RUN CONTRADICTION SCAN</span>
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>

            {loading && !scanning ? (
                <div className="py-20 flex items-center justify-center space-x-2 text-zinc-400 font-mono text-xs select-none">
                    <Loader2 size={14} className="animate-spin" />
                    <span>SYNCHRONIZING DISCREPANCY INDEX...</span>
                </div>
            ) : contradictions.length === 0 ? (
                <div className="py-16 text-center text-zinc-500 font-mono text-xs space-y-2 select-none">
                    <CheckCircle2 size={28} className="text-success mx-auto" />
                    <p className="uppercase font-bold tracking-wider text-success">NO CONTRADICTIONS DETECTED</p>
                    <p className="text-[11px] text-zinc-600 max-w-xs mx-auto leading-relaxed">
                        Factual indexes align correctly. No contradictions have been logged across current evidence documents.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {contradictions.map((c) => {
                        const isUpdating = updatingId === c.id;
                        
                        return (
                            <div 
                                key={c.id}
                                className={`border p-5 space-y-4 hover:bg-zinc-950/40 transition-colors ${
                                    c.status === "OPEN" 
                                        ? c.severity === "CRITICAL" 
                                            ? "border-warning/30 bg-warning/5"
                                            : "border-hairline"
                                        : "border-hairline opacity-65"
                                }`}
                            >
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                    <div className="space-y-3 flex-grow text-left">
                                        <div className="space-y-1 font-mono">
                                            {/* Severity and Status Tag */}
                                            <div className="flex flex-wrap items-center gap-2 select-none">
                                                <span className={`px-2 py-0.5 border text-[9px] uppercase tracking-wider ${getSeverityStyle(c.severity)}`}>
                                                    {c.severity} SEVERITY
                                                </span>
                                                <span className={`px-2 py-0.5 border text-[9px] uppercase tracking-wider ${getStatusBadgeStyle(c.status)}`}>
                                                    {c.status}
                                                </span>
                                            </div>
                                            <h4 className="text-xs font-bold text-white uppercase tracking-wide pt-1.5">
                                                {c.title}
                                            </h4>
                                        </div>

                                        <p className="font-sans text-xs text-zinc-300 leading-relaxed uppercase select-text">
                                            {c.description}
                                        </p>

                                        {/* Linked evidence items list */}
                                        {c.evidenceIds && c.evidenceIds.length > 0 && (
                                            <div className="space-y-1.5 pt-2 select-none">
                                                <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest block font-bold">
                                                    CONFLICTING SOURCES:
                                                </span>
                                                <div className="flex flex-wrap gap-2">
                                                    {c.evidenceIds.map((eid, idx) => (
                                                        <div 
                                                            key={idx} 
                                                            className="flex items-center space-x-1.5 bg-black border border-hairline-strong px-2 py-1 font-mono text-[9px] text-zinc-400"
                                                        >
                                                            <FileText size={10} />
                                                            <span className="truncate max-w-[150px] uppercase font-semibold">
                                                                {getEvidenceFileName(eid)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action controls */}
                                    <div className="shrink-0 font-mono text-xs select-none">
                                        {isUpdating ? (
                                            <Loader2 size={12} className="animate-spin text-zinc-400" />
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                {c.status === "OPEN" && (
                                                    <>
                                                        <button
                                                            onClick={() => handleUpdateStatus(c.id, "RESOLVED")}
                                                            className="px-3 py-1.5 border border-zinc-800 hover:border-success hover:bg-success/10 text-zinc-400 hover:text-success transition-all text-center uppercase tracking-wide text-[10px]"
                                                        >
                                                            RESOLVED
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdateStatus(c.id, "DISMISSED")}
                                                            className="px-3 py-1.5 border border-zinc-800 hover:border-white hover:bg-white/10 text-zinc-400 hover:text-white transition-all text-center uppercase tracking-wide text-[10px]"
                                                        >
                                                            DISMISS
                                                        </button>
                                                    </>
                                                )}
                                                {c.status !== "OPEN" && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(c.id, "OPEN")}
                                                        className="px-3 py-1.5 border border-zinc-800 hover:border-white text-zinc-400 hover:text-white transition-all text-center uppercase tracking-wide text-[10px]"
                                                    >
                                                        RE-OPEN
                                                    </button>
                                                )}
                                            </div>
                                        )}
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
