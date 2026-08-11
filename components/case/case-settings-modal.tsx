"use client"

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { casesApi, Case } from "@/lib/api/cases";
import {
    X, Settings, SlidersHorizontal, ShieldAlert, Check,
    Loader2, ChevronDown, Trash2, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ─────────────────────────────────────────── types */
type Tab = "general" | "danger";

interface Props {
    caseData: Case;
    isOpen: boolean;
    onClose: () => void;
}

/* ─────────────────────────────────────────── small helpers */
const STATUS_OPTIONS: Case["status"][] = ["ACTIVE", "ARCHIVED", "CLOSED"];
const SEVERITY_OPTIONS: Case["severity"][] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function severityColor(v: Case["severity"]) {
    return v === "CRITICAL" ? "text-red-400" :
           v === "HIGH"     ? "text-orange-400" :
           v === "MEDIUM"   ? "text-yellow-400" : "text-zinc-300";
}

function statusColor(v: Case["status"]) {
    return v === "ACTIVE"   ? "text-green-400" :
           v === "CLOSED"   ? "text-zinc-500"  : "text-blue-400";
}

interface SelectFieldProps<T extends string> {
    label: string;
    value: T;
    options: T[];
    onChange: (v: T) => void;
    colorFn?: (v: T) => string;
    disabled?: boolean;
}

function SelectField<T extends string>({ label, value, options, onChange, colorFn, disabled }: SelectFieldProps<T>) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div className="space-y-1.5">
            <label className="font-mono text-[9px] tracking-widest text-zinc-500 uppercase font-bold block">
                {label}
            </label>
            <div ref={ref} className="relative">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setOpen(!open)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 border border-zinc-800 bg-zinc-950 hover:border-zinc-600 transition-colors font-mono text-xs tracking-wider uppercase ${colorFn ? colorFn(value) : "text-white"} disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                    <span>{value}</span>
                    <ChevronDown size={12} className={`text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                    {open && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.12 }}
                            className="absolute z-50 left-0 right-0 top-full mt-0.5 border border-zinc-800 bg-zinc-950 shadow-xl overflow-hidden"
                        >
                            {options.map(opt => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => { onChange(opt); setOpen(false); }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 font-mono text-xs tracking-wider uppercase hover:bg-zinc-900 transition-colors ${colorFn ? colorFn(opt) : "text-white"}`}
                                >
                                    <span>{opt}</span>
                                    {opt === value && <Check size={10} className="text-white" />}
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────── main component */
export default function CaseSettingsModal({ caseData, isOpen, onClose }: Props) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<Tab>("general");

    // General tab state
    const [name, setName] = useState(caseData.name);
    const [status, setStatus] = useState<Case["status"]>(caseData.status);
    const [severity, setSeverity] = useState<Case["severity"]>(caseData.severity);

    // Danger zone state
    const [deleteConfirm, setDeleteConfirm] = useState("");
    const [deleteError, setDeleteError] = useState("");

    // Reset form when modal opens or caseData changes
    useEffect(() => {
        if (isOpen) {
            setName(caseData.name);
            setStatus(caseData.status);
            setSeverity(caseData.severity);
            setTab("general");
            setDeleteConfirm("");
            setDeleteError("");
        }
    }, [isOpen, caseData]);

    // Escape to close
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        if (isOpen) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen, onClose]);

    /* mutations */
    const updateMutation = useMutation({
        mutationFn: () => casesApi.update(caseData.id, { name: name.trim(), status, severity }),
        onSuccess: (updated) => {
            queryClient.setQueryData(["case", caseData.id], updated);
            queryClient.invalidateQueries({ queryKey: ["cases"] });
            onClose();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => casesApi.deleteCase(caseData.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cases"] });
            router.push("/dashboard");
        },
        onError: () => {
            setDeleteError("Failed to delete case. Please try again.");
        },
    });

    const isDirty =
        name.trim() !== caseData.name ||
        status !== caseData.status ||
        severity !== caseData.severity;

    const canDelete = deleteConfirm === caseData.name;

    const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
        { id: "general",  label: "GENERAL",    icon: SlidersHorizontal },
        { id: "danger",   label: "DANGER ZONE", icon: AlertTriangle },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
                        onClick={onClose}
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.97, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 8 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div
                            className="pointer-events-auto w-full max-w-md bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
                                <div className="flex items-center gap-2.5">
                                    <Settings size={13} className="text-zinc-400" />
                                    <span className="font-mono text-[10px] tracking-widest text-white uppercase font-bold">
                                        CASE SETTINGS
                                    </span>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-1 text-zinc-500 hover:text-white transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Case name badge */}
                            <div className="px-5 py-3 border-b border-zinc-900 bg-zinc-950/60 shrink-0">
                                <p className="font-mono text-[9px] tracking-widest text-zinc-500 uppercase font-bold mb-0.5">CASE</p>
                                <p className="font-mono text-xs text-zinc-300 tracking-wider truncate">{caseData.name}</p>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-zinc-800 shrink-0">
                                {TABS.map(({ id, label, icon: Icon }) => (
                                    <button
                                        key={id}
                                        onClick={() => setTab(id)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 font-mono text-[9px] tracking-widest uppercase font-bold transition-colors border-b-2 -mb-px ${
                                            tab === id
                                                ? id === "danger"
                                                    ? "text-red-400 border-red-500"
                                                    : "text-white border-white"
                                                : "text-zinc-500 border-transparent hover:text-zinc-300"
                                        }`}
                                    >
                                        <Icon size={11} />
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* Tab content */}
                            <div className="flex-1 overflow-y-auto">
                                <AnimatePresence mode="wait">
                                    {tab === "general" && (
                                        <motion.div
                                            key="general"
                                            initial={{ opacity: 0, x: -6 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 6 }}
                                            transition={{ duration: 0.14 }}
                                            className="p-5 space-y-5"
                                        >
                                            {/* Name field */}
                                            <div className="space-y-1.5">
                                                <label
                                                    htmlFor="case-name"
                                                    className="font-mono text-[9px] tracking-widest text-zinc-500 uppercase font-bold block"
                                                >
                                                    CASE NAME
                                                </label>
                                                <input
                                                    id="case-name"
                                                    type="text"
                                                    value={name}
                                                    onChange={e => setName(e.target.value)}
                                                    disabled={updateMutation.isPending}
                                                    maxLength={120}
                                                    className="w-full px-3 py-2.5 border border-zinc-800 bg-zinc-950 text-white font-mono text-xs tracking-wider focus:outline-none focus:border-zinc-500 placeholder-zinc-600 transition-colors disabled:opacity-40"
                                                    placeholder="Enter case name…"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <SelectField
                                                    label="STATUS"
                                                    value={status}
                                                    options={STATUS_OPTIONS}
                                                    onChange={setStatus}
                                                    colorFn={statusColor}
                                                    disabled={updateMutation.isPending}
                                                />
                                                <SelectField
                                                    label="SEVERITY"
                                                    value={severity}
                                                    options={SEVERITY_OPTIONS}
                                                    onChange={setSeverity}
                                                    colorFn={severityColor}
                                                    disabled={updateMutation.isPending}
                                                />
                                            </div>

                                            {/* Meta info */}
                                            <div className="border border-zinc-900 bg-zinc-950/40 p-3 space-y-2">
                                                {[
                                                    { label: "CASE ID", value: caseData.id.slice(0, 16).toUpperCase() },
                                                    { label: "CREATED", value: new Date(caseData.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) },
                                                    { label: "LAST MODIFIED", value: new Date(caseData.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) },
                                                ].map(({ label, value }) => (
                                                    <div key={label} className="flex justify-between font-mono text-[10px] tracking-wider">
                                                        <span className="text-zinc-500 font-bold uppercase">{label}</span>
                                                        <span className="text-zinc-300">{value}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {updateMutation.isError && (
                                                <p className="font-mono text-[10px] tracking-wider text-red-400 uppercase">
                                                    {(updateMutation.error as Error)?.message ?? "Update failed. Try again."}
                                                </p>
                                            )}
                                        </motion.div>
                                    )}

                                    {tab === "danger" && (
                                        <motion.div
                                            key="danger"
                                            initial={{ opacity: 0, x: 6 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -6 }}
                                            transition={{ duration: 0.14 }}
                                            className="p-5 space-y-5"
                                        >
                                            <div className="border border-red-900/50 bg-red-950/20 p-4 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <AlertTriangle size={12} className="text-red-400 shrink-0" />
                                                    <span className="font-mono text-[9px] tracking-widest text-red-400 uppercase font-bold">
                                                        IRREVERSIBLE ACTION
                                                    </span>
                                                </div>
                                                <p className="font-mono text-[10px] tracking-wider text-zinc-400 leading-relaxed">
                                                    Deleting this case will permanently remove all associated evidence, timeline events, hypotheses, and analysis data. This action cannot be undone.
                                                </p>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label
                                                    htmlFor="delete-confirm"
                                                    className="font-mono text-[9px] tracking-widest text-zinc-500 uppercase font-bold block"
                                                >
                                                    TYPE CASE NAME TO CONFIRM
                                                </label>
                                                <div className="font-mono text-[10px] tracking-wider text-zinc-500 mb-2 break-all">
                                                    <span className="text-zinc-300">"{caseData.name}"</span>
                                                </div>
                                                <input
                                                    id="delete-confirm"
                                                    type="text"
                                                    value={deleteConfirm}
                                                    onChange={e => { setDeleteConfirm(e.target.value); setDeleteError(""); }}
                                                    disabled={deleteMutation.isPending}
                                                    className="w-full px-3 py-2.5 border border-zinc-800 bg-zinc-950 text-white font-mono text-xs tracking-wider focus:outline-none focus:border-red-700 placeholder-zinc-600 transition-colors disabled:opacity-40"
                                                    placeholder="Type exact case name…"
                                                />
                                                {deleteError && (
                                                    <p className="font-mono text-[10px] tracking-wider text-red-400 uppercase">{deleteError}</p>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Footer actions */}
                            <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-800 shrink-0 bg-zinc-950/60">
                                <button
                                    onClick={onClose}
                                    className="font-mono text-[10px] tracking-widest text-zinc-500 hover:text-white transition-colors uppercase font-bold px-3 py-2"
                                >
                                    CANCEL
                                </button>

                                {tab === "general" && (
                                    <button
                                        onClick={() => updateMutation.mutate()}
                                        disabled={!isDirty || !name.trim() || updateMutation.isPending}
                                        className="flex items-center gap-2 px-4 py-2 bg-white text-black font-mono text-[10px] tracking-widest uppercase font-bold hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        {updateMutation.isPending ? (
                                            <Loader2 size={11} className="animate-spin" />
                                        ) : (
                                            <Check size={11} />
                                        )}
                                        {updateMutation.isPending ? "SAVING…" : "SAVE CHANGES"}
                                    </button>
                                )}

                                {tab === "danger" && (
                                    <button
                                        onClick={() => deleteMutation.mutate()}
                                        disabled={!canDelete || deleteMutation.isPending}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white font-mono text-[10px] tracking-widest uppercase font-bold hover:bg-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        {deleteMutation.isPending ? (
                                            <Loader2 size={11} className="animate-spin" />
                                        ) : (
                                            <Trash2 size={11} />
                                        )}
                                        {deleteMutation.isPending ? "DELETING…" : "DELETE CASE"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
