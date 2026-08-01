"use client"

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { casesApi, Case } from "@/lib/api/cases";
import { evidenceApi } from "@/lib/api/evidence";
import { FileText, GitFork, Clock, BrainCircuit, ShieldAlert, ArrowRight } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const WORKSPACES = [
    { label: "EVIDENCE WORKSPACE", desc: "Ingest, manage, and analyze evidence files", href: "/evidence", icon: FileText },
    { label: "GRAPH WORKSPACE", desc: "Explore entity relationships and network topology", href: "/graph", icon: GitFork },
    { label: "TIMELINE WORKSPACE", desc: "Chronological event reconstruction", href: "/timeline", icon: Clock },
    { label: "HYPOTHESIS LAB", desc: "AI-generated inference chains and confidence scoring", href: "/hypotheses", icon: BrainCircuit },
    { label: "CONTRADICTION CENTER", desc: "Factual conflict detection and resolution", href: "/contradictions", icon: ShieldAlert },
];

export default function CaseOverviewPage() {
    const params = useParams();
    const caseId = params.id as string;

    const { data: caseData } = useQuery<Case>({
        queryKey: ["case", caseId],
        queryFn: () => casesApi.getById(caseId),
        enabled: !!caseId,
    });

    const { data: evidenceList } = useQuery({
        queryKey: ["evidence", caseId],
        queryFn: () => evidenceApi.getByCase(caseId),
        enabled: !!caseId,
    });

    const base = `/cases/${caseId}`;

    return (
        <div className="h-full overflow-y-auto p-8 space-y-10">
            {/* Case header */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-2 border-b border-hairline pb-8"
            >
                <span className="font-mono text-sm tracking-widest text-muted">INVESTIGATION OVERVIEW</span>
                <h1 className="font-display text-3xl text-white">
                    {caseData?.name ?? "LOADING..."}
                </h1>
                <div className="flex items-center space-x-6 font-mono text-sm tracking-widest text-muted pt-2">
                    <span>EVIDENCE: {evidenceList?.length ?? "—"}</span>
                    <span>STATUS: {caseData?.status ?? "—"}</span>
                    <span>SEVERITY: <span className={caseData?.severity === "CRITICAL" ? "text-warning" : "text-white"}>{caseData?.severity ?? "—"}</span></span>
                </div>
            </motion.div>

            {/* Workspace grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {WORKSPACES.map(({ label, desc, href, icon: Icon }, i) => (
                    <motion.div
                        key={href}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                    >
                        <Link
                            href={`${base}${href}`}
                            className="group block border border-hairline bg-surface-soft hover:bg-surface-card hover:border-white/30 transition-all p-6 space-y-4 relative"
                        >
                            <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 border-t border-l border-white/20" />
                            <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 border-t border-r border-white/20" />
                            <div className="flex items-center justify-between">
                                <Icon size={18} className="text-muted group-hover:text-white transition-colors" />
                                <ArrowRight size={14} className="text-muted group-hover:text-white transition-colors opacity-0 group-hover:opacity-100" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-mono text-xs tracking-widest text-white">{label}</h3>
                                <p className="font-mono text-sm tracking-wider text-muted leading-relaxed">{desc}</p>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
