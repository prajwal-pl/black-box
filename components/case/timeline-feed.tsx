"use client"

import React, { useState, useEffect } from "react";
import { timelineApi, TimelineEvent } from "@/lib/api/timeline";
import { Loader2, Search, Calendar, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface TimelineFeedProps {
    caseId: string;
}

export default function TimelineFeed({ caseId }: TimelineFeedProps) {
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

    const fetchTimeline = async () => {
        setLoading(true);
        try {
            const data = await timelineApi.getTimeline(caseId);
            setEvents(data || []);
        } catch (error) {
            console.error("Failed to load timeline events:", error);
            toast.error("FAILED TO LOAD CHRONOLOGICAL EVENT LOGS");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTimeline();
    }, [caseId]);

    const toggleExpand = (id: string) => {
        setExpandedEvents((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "UNDETERMINED DATE";
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr.toUpperCase();
            return d.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            }).toUpperCase();
        } catch {
            return dateStr.toUpperCase();
        }
    };

    const getConfidenceBadge = (confidence: number) => {
        if (confidence >= 0.8) {
            return "border-emerald-500/50 text-emerald-400 fill-emerald-950/20";
        } else if (confidence >= 0.5) {
            return "border-yellow-500/50 text-yellow-400 fill-yellow-950/20";
        }
        return "border-warning/50 text-warning fill-zinc-950";
    };

    const filteredEvents = events.filter((e) =>
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="border border-hairline bg-zinc-950/10 p-6 space-y-6 text-left relative">
            <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 border-t border-l border-white/30" />
            <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 border-t border-r border-white/30" />

            {/* Header controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-hairline pb-4 select-none">
                <h3 className="font-mono text-xs tracking-wider text-zinc-400 uppercase flex items-center space-x-1.5">
                    <Calendar size={12} />
                    <span>CHRONOLOGICAL CHRONOLOGY LOGS ({filteredEvents.length})</span>
                </h3>

                {/* Filter input */}
                <div className="relative w-full sm:w-64 font-mono">
                    <input
                        type="text"
                        placeholder="FILTER EVENTS..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-black border border-hairline py-1.5 pl-8 pr-3 text-xs text-white placeholder-zinc-500 rounded-none focus:outline-none focus:border-white transition-colors"
                    />
                    <Search size={12} className="absolute left-2.5 top-2.5 text-zinc-500" />
                </div>
            </div>

            {loading ? (
                <div className="py-20 flex items-center justify-center space-x-2 text-zinc-400 font-mono text-xs select-none">
                    <Loader2 size={14} className="animate-spin" />
                    <span>SYNCHRONIZING CHRONOLOGY SEQUENCE...</span>
                </div>
            ) : filteredEvents.length === 0 ? (
                <div className="py-16 text-center text-zinc-500 font-mono text-xs space-y-2 select-none">
                    <Clock size={28} className="text-zinc-700 mx-auto" />
                    <p className="uppercase font-bold tracking-wider">NO TIMELINE LOGS RECORDED</p>
                    <p className="text-[11px] text-zinc-600 max-w-xs mx-auto leading-relaxed">
                        No events have been parsed or matched your filter query. Complete ingestion of case documents.
                    </p>
                </div>
            ) : (
                <div className="relative pl-6 space-y-6">
                    {/* Vertical timeline axis */}
                    <div className="absolute left-2 top-2 bottom-2 w-[1px] bg-zinc-800" />

                    {filteredEvents.map((event) => {
                        const isExpanded = !!expandedEvents[event.id];
                        const badgeStyle = getConfidenceBadge(event.confidence);
                        
                        return (
                            <div key={event.id} className="relative group">
                                {/* Bullet indicator on the line */}
                                <div className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 border rounded-none bg-black transition-all group-hover:scale-125 ${
                                    event.confidence >= 0.8 ? "border-emerald-500" :
                                    event.confidence >= 0.5 ? "border-yellow-500" : "border-warning"
                                }`} />

                                <div className="border border-hairline bg-zinc-950/20 p-4 space-y-3 relative hover:bg-zinc-950/40 transition-colors">
                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                                        <div className="space-y-1 font-mono">
                                            {/* Date / timestamp header */}
                                            <span className="text-[10px] tracking-wider text-zinc-500 block font-semibold">
                                                {formatDate(event.occuredAt)}
                                            </span>
                                            <h4 
                                                onClick={() => toggleExpand(event.id)}
                                                className="text-xs font-bold text-white uppercase tracking-wide cursor-pointer hover:underline"
                                            >
                                                {event.title}
                                            </h4>
                                        </div>

                                        <div className="flex items-center space-x-2 shrink-0 font-mono text-[9px] uppercase select-none">
                                            {/* Confidence tag */}
                                            <span className={`px-2 py-0.5 border font-bold ${badgeStyle}`}>
                                                CONF: {Math.round(event.confidence * 100)}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Description body */}
                                    <p className={`font-sans text-xs text-zinc-300 leading-relaxed uppercase select-text ${
                                        isExpanded ? "" : "line-clamp-2"
                                    }`}>
                                        {event.description}
                                    </p>

                                    {/* Details footer */}
                                    <div className="flex justify-between items-center font-mono text-[9px] text-zinc-500 pt-1 select-none">
                                        <button
                                            onClick={() => toggleExpand(event.id)}
                                            className="hover:text-white transition-colors bg-transparent border-none uppercase"
                                        >
                                            {isExpanded ? "[COLLAPSE DETAILS]" : "[EXPAND DETAILS]"}
                                        </button>
                                        <span className="text-[8px] text-zinc-600">
                                            REF_ID: {event.id.slice(0, 8).toUpperCase()}
                                        </span>
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
