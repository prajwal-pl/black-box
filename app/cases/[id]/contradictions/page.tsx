"use client"

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { contradictionsApi, Contradiction, ContradictionStatus, Severity } from "@/lib/api/contradictions";
import { evidenceApi, Evidence } from "@/lib/api/evidence";
import { useQuery } from "@tanstack/react-query";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ShieldAlert, RefreshCw, CheckCircle2, FileText } from "lucide-react";
import CaseAIPanel from "@/components/case/case-ai-panel";

const AI_SUGGESTIONS = ["Explain this contradiction","Find the source","Suggest resolution","Determine confidence","Search similar contradictions"];

const sevClass = (s: Severity) => ({
    CRITICAL: "text-warning border-warning/40",
    HIGH:     "text-orange-400 border-orange-500/40",
    MEDIUM:   "text-yellow-400 border-yellow-500/40",
    LOW:      "text-muted-foreground border-border",
}[s]);

const statusClass = (s: ContradictionStatus) => ({
    OPEN:      "text-warning border-warning/40",
    RESOLVED:  "text-success border-success/40",
    DISMISSED: "text-muted-foreground border-border",
}[s]);



export default function ContradictionsWorkspacePage() {
    const params = useParams();
    const caseId = params.id as string;

    const [contradictions, setContradictions] = useState<Contradiction[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [selectedEvidenceId, setSelectedEvidenceId] = useState("");
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [selected, setSelected] = useState<Contradiction | null>(null);
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

    const { data: evidenceList } = useQuery<Evidence[]>({
        queryKey: ["evidence", caseId],
        queryFn: () => evidenceApi.getByCase(caseId),
        enabled: !!caseId,
    });
    const completedEvidence = evidenceList?.filter(e => e.status === "COMPLETED") ?? [];

    const fetchContradictions = async () => {
        setLoading(true);
        try { setContradictions(await contradictionsApi.getByCase(caseId) ?? []); }
        catch { toast.error("Failed to load contradictions"); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchContradictions(); }, [caseId]);

    const updateStatus = async (id: string, status: ContradictionStatus) => {
        setUpdatingId(id);
        try {
            const updated = await contradictionsApi.updateStatus(id, status);
            setContradictions(prev => prev.map(c => c.id === id ? updated : c));
            toast.success(`Contradiction → ${status}`);
        } catch { toast.error("Failed to update status"); }
        finally { setUpdatingId(null); }
    };

    const triggerScan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEvidenceId) { toast.error("Select an evidence source"); return; }
        setScanning(true);
        try { await contradictionsApi.triggerScan(caseId, selectedEvidenceId); toast.success("Contradiction scan enqueued"); setTimeout(fetchContradictions, 5000); }
        catch { toast.error("Failed to initiate scan"); setScanning(false); }
    };

    const getEvidenceName = (id: string) => evidenceList?.find(e => e.id === id)?.fileName ?? `EVIDENCE_${id.slice(0,6).toUpperCase()}`;

    return (
        <div className={`flex h-full w-full bg-black text-white overflow-hidden ${isResizingRight ? "select-none cursor-col-resize" : ""}`}>
            {/* Main Workspace Area */}
            <div className="flex-grow flex flex-col min-w-0 h-full">
                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between gap-4 shrink-0 flex-wrap border-b border-zinc-800 h-[45px]">
                    <div className="flex items-center gap-2">
                        <ShieldAlert size={13} className="text-muted-foreground" />
                        <span className="font-mono text-xs tracking-widest text-muted-foreground font-bold uppercase">CONTRADICTION CENTER</span>
                        {!loading && <span className="font-mono text-xs text-zinc-500 font-semibold">({contradictions.length})</span>}
                    </div>
                    {completedEvidence.length > 0 && (
                        <form onSubmit={triggerScan} className="flex items-center gap-2">
                            <select value={selectedEvidenceId} onChange={e => setSelectedEvidenceId(e.target.value)}
                                className="bg-black border border-zinc-800 py-1 px-3 font-mono text-[10px] text-white focus:outline-none focus:border-zinc-500 transition-colors cursor-pointer h-[26px]">
                                <option value="">SELECT EVIDENCE...</option>
                                {completedEvidence.map(e => <option key={e.id} value={e.id}>{e.fileName.toUpperCase()}</option>)}
                            </select>
                            <button 
                                type="submit" 
                                disabled={scanning || !selectedEvidenceId} 
                                className="px-3 h-[26px] bg-transparent hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-colors font-mono text-[10px] tracking-widest uppercase font-bold"
                            >
                                {scanning ? "SCANNING..." : "RUN SCAN"}
                            </button>
                        </form>
                    )}
                </div>

                {loading ? (
                    <div className="flex-grow flex items-center justify-center gap-2 text-zinc-500 font-mono text-xs uppercase">
                        <Loader2 size={14} className="animate-spin" /><span>SYNCHRONIZING DISCREPANCY INDEX...</span>
                    </div>
                ) : !contradictions.length ? (
                    <div className="flex-grow flex flex-col items-center justify-center gap-3 text-zinc-500 font-mono text-xs uppercase select-none">
                        <CheckCircle2 size={32} className="text-success" />
                        <span className="tracking-widest font-bold text-success">NO CONTRADICTIONS DETECTED</span>
                        <span className="text-[10px] max-w-xs text-center leading-relaxed">Factual indexes align. Run a scan on processed evidence to detect conflicts.</span>
                    </div>
                ) : (
                    <div className="flex-grow overflow-y-auto p-5 space-y-3">
                        <AnimatePresence>
                            {contradictions.map((c, i) => {
                                const isSel = selected?.id === c.id;
                                const isUpd = updatingId === c.id;
                                return (
                                    <motion.div 
                                        key={c.id} 
                                        initial={{ opacity: 0, y: 8 }} 
                                        animate={{ opacity: 1, y: 0 }} 
                                        transition={{ duration: 0.2, delay: i * 0.04 }}
                                        onClick={() => setSelected(isSel ? null : c)}
                                        className={`border p-4 space-y-3 cursor-pointer transition-colors uppercase font-mono ${
                                            isSel ? "border-zinc-500 bg-zinc-950/20" :
                                            c.status === "OPEN" && c.severity === "CRITICAL" ? "border-red-950/60 bg-red-950/5 hover:border-red-900/60" :
                                            "border-zinc-900 hover:border-zinc-800"
                                        } ${c.status !== "OPEN" ? "opacity-60" : ""}`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-2 flex-1">
                                                <div className="flex flex-wrap gap-2">
                                                    <span className={`px-1.5 py-0.5 border text-[10px] font-bold ${sevClass(c.severity)}`}>
                                                        {c.severity}
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 border text-[10px] font-bold ${statusClass(c.status)}`}>
                                                        {c.status}
                                                    </span>
                                                </div>
                                                <h4 className="text-xs text-white uppercase tracking-wider font-bold">{c.title}</h4>
                                            </div>
                                            {isUpd ? (
                                                <Loader2 size={12} className="animate-spin text-zinc-500 shrink-0" />
                                            ) : (
                                                <div className="flex flex-col gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                                                    {c.status === "OPEN" && (
                                                        <>
                                                            <button 
                                                                onClick={() => updateStatus(c.id, "RESOLVED")} 
                                                                className="px-2 py-1 border border-zinc-850 hover:border-success hover:text-success transition-colors font-bold text-[9px]"
                                                            >
                                                                RESOLVE
                                                            </button>
                                                            <button 
                                                                onClick={() => updateStatus(c.id, "DISMISSED")} 
                                                                className="px-2 py-1 border border-zinc-850 hover:border-white hover:text-white transition-colors font-bold text-[9px]"
                                                            >
                                                                DISMISS
                                                            </button>
                                                        </>
                                                    )}
                                                    {c.status !== "OPEN" && (
                                                        <button 
                                                            onClick={() => updateStatus(c.id, "OPEN")} 
                                                            className="px-2 py-1 border border-zinc-850 hover:border-white hover:text-white transition-colors font-bold text-[9px]"
                                                        >
                                                            RE-OPEN
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-zinc-400 leading-relaxed">{c.description}</p>
                                        {c.evidenceIds?.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {c.evidenceIds.map((eid, idx) => (
                                                    <div key={idx} className="flex items-center gap-1.5 border border-zinc-900 px-2 py-1 text-[10px] text-zinc-500 font-bold">
                                                        <FileText size={10} />
                                                        <span className="truncate max-w-[140px]">{getEvidenceName(eid)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Resize Handle */}
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

            {/* Custom AI sidebar panel container */}
            <div 
                style={{ width: isRightCollapsed ? 48 : rightWidth }}
                className="shrink-0 h-full overflow-hidden"
            >
                <CaseAIPanel
                    title="CONTRADICTION AI"
                    suggestions={[
                        "Explain this contradiction",
                        "Find the source",
                        "Suggest resolution",
                        "Determine confidence",
                        "Search similar contradictions"
                    ]}
                    placeholder="ASK ABOUT CONTRADICTIONS..."
                    selectedItemName={selected?.title}
                    contextType="Factual Contradiction Analyzer"
                    caseId={caseId}
                    isCollapsed={isRightCollapsed}
                    onToggleCollapse={() => setIsRightCollapsed(!isRightCollapsed)}
                />
            </div>
        </div>
    );
}
