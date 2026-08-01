"use client"

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { timelineApi, TimelineEvent } from "@/lib/api/timeline";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Search, Clock } from "lucide-react";
import CaseAIPanel from "@/components/case/case-ai-panel";

const AI_SUGGESTIONS = ["What happened before this?","Find related entities","Summarize this week","Generate missing events","Identify anomalies"];

const fmtDate = (d: string | null) => {
    if (!d) return "UNDETERMINED";
    try {
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? d.toUpperCase() : dt.toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }).toUpperCase();
    } catch { return d.toUpperCase(); }
};

const confColor = (c: number) => c >= 0.8 ? "text-success border-success/40" : c >= 0.5 ? "text-yellow-400 border-yellow-500/40" : "text-warning border-warning/40";
const dotColor  = (c: number) => c >= 0.8 ? "border-success" : c >= 0.5 ? "border-yellow-500" : "border-warning";



export default function TimelineWorkspacePage() {
    const params = useParams();
    const caseId = params.id as string;

    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [selected, setSelected] = useState<TimelineEvent | null>(null);
    const [isRightCollapsed, setIsRightCollapsed] = useState(false);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try { setEvents(await timelineApi.getTimeline(caseId) ?? []); }
            catch { toast.error("Failed to load timeline"); }
            finally { setLoading(false); }
        })();
    }, [caseId]);

    const filtered = events.filter(e =>
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        e.description.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex h-full w-full bg-black text-white overflow-hidden">
            {/* Main Workspace Area */}
            <div className="flex-grow flex flex-col min-w-0 h-full">
                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between shrink-0 border-b border-zinc-800 h-[45px]">
                    <div className="flex items-center gap-2">
                        <Clock size={13} className="text-muted-foreground" />
                        <span className="font-mono text-xs tracking-widest text-muted-foreground font-bold uppercase">TIMELINE WORKSPACE</span>
                    </div>
                    {filtered && (
                        <span className="font-mono text-xs text-muted-foreground uppercase">
                            {filtered.length} EVENT{filtered.length !== 1 ? "S" : ""}
                        </span>
                    )}
                </div>

                {loading ? (
                    <div className="flex-grow flex items-center justify-center gap-2 text-zinc-500 font-mono text-xs uppercase">
                        <Loader2 size={14} className="animate-spin" /><span>SYNCHRONIZING CHRONOLOGIES...</span>
                    </div>
                ) : !events.length ? (
                    <div className="flex-grow flex flex-col items-center justify-center gap-3 text-zinc-500 font-mono text-xs uppercase select-none">
                        <Clock size={32} className="text-zinc-800" />
                        <span className="tracking-widest font-bold">NO EVENT CHRONOLOGIES DETECTED</span>
                        <span className="text-[10px] max-w-xs text-center leading-relaxed">Ensure evidence is processed and validated to construct a timeline.</span>
                    </div>
                ) : (
                    <div className="flex-grow flex flex-col min-h-0">
                        {/* Search bar */}
                        <div className="px-5 py-3 border-b border-zinc-900 bg-zinc-950/20 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                                <Input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="FILTER TIMELINE EVENTS..."
                                    className="font-mono text-[10px] tracking-widest bg-black border-zinc-800 focus:border-zinc-500 pl-9 h-8 uppercase rounded-none"
                                />
                            </div>
                        </div>

                        {/* Event Feed */}
                        <div className="flex-1 overflow-y-auto p-5">
                            <div className="relative border-l border-zinc-800 pl-6 space-y-6">
                                <AnimatePresence>
                                    {filtered.map(event => {
                                        const isSel = selected?.id === event.id;
                                        return (
                                            <motion.div
                                                key={event.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0 }}
                                                onClick={() => setSelected(isSel ? null : event)}
                                                className={`relative cursor-pointer group transition-all`}
                                            >
                                                {/* Bullet dot */}
                                                <div className={`absolute -left-[31px] top-1.5 w-2 h-2 rounded-none border-2 bg-black transition-all ${
                                                    isSel ? "border-white scale-125" : dotColor(event.confidence)
                                                }`} />

                                                {/* Event card wrapper */}
                                                <div className={`border p-4 bg-zinc-950/10 hover:bg-zinc-900/10 transition-colors uppercase font-mono ${
                                                    isSel ? "border-zinc-500" : "border-zinc-900 hover:border-zinc-800"
                                                }`}>
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="space-y-0.5">
                                                            <span className="text-[10px] text-zinc-500 block font-semibold">{fmtDate(event.occuredAt)}</span>
                                                            <h4 className="text-xs text-white uppercase tracking-wider font-bold">{event.title}</h4>
                                                        </div>
                                                        <span className={`px-1.5 py-0.5 border text-[10px] font-bold shrink-0 ${confColor(event.confidence)}`}>
                                                            {Math.round(event.confidence*100)}%
                                                        </span>
                                                    </div>
                                                    <p className={`text-[11px] text-zinc-400 leading-relaxed mt-2.5 ${expanded[event.id] ? "" : "line-clamp-2"}`}>
                                                        {event.description}
                                                    </p>
                                                    <div className="flex justify-between items-center text-[10px] text-zinc-500 pt-3 mt-1.5 border-t border-zinc-900/60 font-bold">
                                                        <button 
                                                            onClick={e => { e.stopPropagation(); setExpanded(prev => ({ ...prev, [event.id]: !prev[event.id] })); }}
                                                            className="hover:text-white transition-colors bg-transparent border-none text-[9px]"
                                                        >
                                                            {expanded[event.id] ? "[-] COLLAPSE" : "[+] EXPAND"}
                                                        </button>
                                                        <span className="text-[9px]">REF: {event.id.slice(0,8).toUpperCase()}</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Custom AI sidebar panel container */}
            <div className={`transition-all duration-300 ease-in-out shrink-0 h-full ${
                isRightCollapsed ? "w-12" : "w-[320px]"
            }`}>
                <CaseAIPanel
                    title="TIMELINE AI"
                    suggestions={[
                        "What happened before this?",
                        "Find related entities",
                        "Summarize this week",
                        "Generate missing events",
                        "Identify anomalies"
                    ]}
                    placeholder="ASK ABOUT TIMELINE..."
                    selectedItemName={selected?.title}
                    contextType="Chronological Event Reconstructor"
                    isCollapsed={isRightCollapsed}
                    onToggleCollapse={() => setIsRightCollapsed(!isRightCollapsed)}
                />
            </div>
        </div>
    );
}
