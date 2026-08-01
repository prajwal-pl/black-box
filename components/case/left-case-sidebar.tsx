"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { casesApi, Case } from "@/lib/api/cases";
import { evidenceApi } from "@/lib/api/evidence";
import {
    ArrowLeft, Layers, GitFork, Clock, BrainCircuit,
    ShieldAlert, Lock, FileText, Settings, Activity,
    ChevronLeft, ChevronRight
} from "lucide-react";

const NAV_ITEMS = [
    { label: "OVERVIEW",        href: "",               icon: Layers },
    { label: "EVIDENCE",        href: "/evidence",      icon: FileText },
    { label: "GRAPH",           href: "/graph",         icon: GitFork },
    { label: "TIMELINE",        href: "/timeline",      icon: Clock },
    { label: "HYPOTHESES",      href: "/hypotheses",    icon: BrainCircuit },
    { label: "CONTRADICTIONS",  href: "/contradictions",icon: ShieldAlert },
];

interface LeftCaseSidebarProps {
    caseId: string;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

export default function LeftCaseSidebar({ caseId, isCollapsed, onToggleCollapse }: LeftCaseSidebarProps) {
    const pathname = usePathname();
    const base = `/cases/${caseId}`;

    const { data: caseData, isLoading } = useQuery<Case>({
        queryKey: ["case", caseId],
        queryFn: () => casesApi.getById(caseId),
        enabled: !!caseId,
    });

    const { data: evidenceList } = useQuery({
        queryKey: ["evidence", caseId],
        queryFn: () => evidenceApi.getByCase(caseId),
        enabled: !!caseId,
        refetchInterval: (query) => {
            const list = query.state.data as any[] | undefined;
            return list?.some((e) => e.status === "PENDING" || e.status === "PROCESSING") ? 3000 : false;
        },
    });

    const processingCount = evidenceList?.filter(
        (e) => e.status === "PENDING" || e.status === "PROCESSING"
    ).length ?? 0;

    const isActive = (href: string) =>
        href === "" ? pathname === base : pathname.startsWith(`${base}${href}`);

    return (
        <div className="flex flex-col h-full bg-black border-r border-zinc-800 select-none overflow-hidden">
            {/* Back to archive navigation */}
            <div className="px-4 py-4 shrink-0 flex items-center justify-between">
                {!isCollapsed ? (
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-zinc-400 hover:text-white transition-colors uppercase font-bold"
                    >
                        <ArrowLeft size={12} />
                        <span>RETURN TO ARCHIVE</span>
                    </Link>
                ) : (
                    <Link
                        href="/dashboard"
                        title="RETURN TO ARCHIVE"
                        className="mx-auto flex items-center justify-center p-1.5 rounded-none text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={14} />
                    </Link>
                )}
            </div>

            <div className="h-px bg-zinc-800 w-full" />

            {/* Case metadata section */}
            {!isCollapsed ? (
                <div className="px-4 py-4 shrink-0 space-y-3 bg-zinc-950/40">
                    {isLoading ? (
                        <div className="space-y-2 animate-pulse">
                            <div className="h-3 bg-zinc-800 w-3/4" />
                            <div className="h-2 bg-zinc-800 w-1/2" />
                        </div>
                    ) : caseData ? (
                        <>
                            <span className="font-mono text-[9px] tracking-widest text-zinc-500 font-bold block uppercase">
                                CASE FILE
                            </span>
                            <h2 className="font-mono text-xs text-white uppercase tracking-wider break-words leading-relaxed font-bold">
                                {caseData.name}
                            </h2>
                            <div className="space-y-1.5 font-mono text-[10px] text-zinc-400">
                                {[
                                    { label: "SEVERITY", value: caseData.severity, warn: caseData.severity === "CRITICAL" },
                                    { label: "STATUS",   value: caseData.status },
                                    { label: "HASH",     value: caseData.id.slice(0, 8).toUpperCase() },
                                ].map(({ label, value, warn }) => (
                                    <div key={label} className="flex justify-between uppercase">
                                        <span className="text-zinc-500 font-semibold">{label}</span>
                                        <span className={warn ? "text-warning font-bold" : "text-white"}>{value}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-1.5 pt-1">
                                <Lock size={10} className="text-success animate-pulse" />
                                <span className="font-mono text-[9px] tracking-widest text-zinc-500 font-bold uppercase">
                                    PARTITION SECURE
                                </span>
                            </div>
                        </>
                    ) : null}
                </div>
            ) : (
                <div className="py-4 flex justify-center shrink-0" title={caseData?.name}>
                    <Lock size={12} className="text-success animate-pulse" />
                </div>
            )}

            <div className="h-px bg-zinc-800 w-full" />

            {/* Custom scrollable navigation area */}
            <div className="flex-grow overflow-y-auto overflow-x-hidden py-2 bg-black/20">
                <nav className="space-y-0.5 px-1.5">
                    {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
                        const active = isActive(href);
                        return (
                            <Link
                                key={href}
                                href={`${base}${href}`}
                                title={isCollapsed ? label : undefined}
                                className={`flex items-center transition-colors border-l-2 py-3 ${
                                    isCollapsed ? "justify-center px-1" : "px-3.5 gap-3"
                                } ${
                                    active
                                        ? "text-white bg-zinc-900/60 border-l-white font-bold"
                                        : "text-zinc-400 hover:text-white hover:bg-zinc-900/20 border-l-transparent"
                                }`}
                            >
                                <Icon size={14} className="shrink-0" />
                                {!isCollapsed && (
                                    <span className="font-mono text-[10px] tracking-widest uppercase flex-1">
                                        {label}
                                    </span>
                                )}
                                {!isCollapsed && label === "EVIDENCE" && processingCount > 0 && (
                                    <span className="px-1.5 py-0.5 border border-success/40 text-success font-mono text-[9px] uppercase font-bold tracking-wider leading-none animate-pulse">
                                        {processingCount}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="h-px bg-zinc-800 w-full" />

            {/* Pipeline activity indicator */}
            {!isCollapsed && processingCount > 0 && (
                <>
                    <div className="px-4 py-3 flex items-center gap-2 bg-zinc-950/20 shrink-0">
                        <Activity size={11} className="text-success animate-pulse shrink-0" />
                        <span className="font-mono text-[9px] tracking-widest text-success font-bold uppercase">
                            {processingCount} PIPELINE ACTIVE
                        </span>
                    </div>
                    <div className="h-px bg-zinc-800 w-full" />
                </>
            )}

            {/* Footer buttons (Settings and Expand/Collapse) */}
            <div className="p-1.5 shrink-0 space-y-1 bg-zinc-950/40">
                <button
                    title="CASE SETTINGS"
                    className={`flex items-center font-mono text-[10px] tracking-widest text-zinc-400 hover:text-white transition-colors uppercase font-bold py-2 ${
                        isCollapsed ? "justify-center px-1" : "px-3 gap-3"
                    } w-full`}
                >
                    <Settings size={12} className="shrink-0" />
                    {!isCollapsed && <span>CASE SETTINGS</span>}
                </button>
                
                <button
                    onClick={onToggleCollapse}
                    title={isCollapsed ? "EXPAND PANEL" : "COLLAPSE PANEL"}
                    className={`flex items-center justify-center text-zinc-500 hover:text-white transition-colors py-2 border-t border-zinc-900 w-full`}
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </div>
        </div>
    );
}
