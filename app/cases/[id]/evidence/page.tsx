"use client"

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { evidenceApi, Evidence } from "@/lib/api/evidence";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
    Upload, FileText, Trash2, AlertTriangle, CheckCircle,
    Clock, RefreshCw, X, Loader2, Activity,
} from "lucide-react";
import CaseAIPanel from "@/components/case/case-ai-panel";

interface UploadingFile {
    tempId: string;
    file: File;
    name: string;
    size: number;
    progress: number;
    status: "queued" | "uploading" | "failed";
    error?: string;
    xhr?: XMLHttpRequest;
}

const formatBytes = (b: number) => {
    if (!b) return "0 B";
    const i = Math.floor(Math.log(b) / Math.log(1024));
    return `${(b / Math.pow(1024, i)).toFixed(1)} ${["B","KB","MB","GB"][i]}`;
};



export default function EvidenceWorkspacePage() {
    const params = useParams();
    const caseId = params.id as string;
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [uploadQueue, setUploadQueue] = useState<UploadingFile[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [selected, setSelected] = useState<Evidence | null>(null);
    const [isRightCollapsed, setIsRightCollapsed] = useState(false);

    const { data: evidenceList, isLoading, error } = useQuery<Evidence[]>({
        queryKey: ["evidence", caseId],
        queryFn: () => evidenceApi.getByCase(caseId),
        enabled: !!caseId,
        refetchInterval: (query) => {
            const list = query.state.data as Evidence[] | undefined;
            return list?.some(e => e.status === "PENDING" || e.status === "PROCESSING") ? 3000 : false;
        },
    });

    const deleteMutation = useMutation({
        mutationFn: evidenceApi.delete,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["evidence", caseId] }); toast.success("Evidence deleted"); },
        onError: (err: any) => toast.error(err?.message ?? "Delete failed"),
    });

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        setDragActive(e.type === "dragenter" || e.type === "dragover");
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files[0]) handleFiles(e.dataTransfer.files);
    };

    const handleFiles = (files: FileList) => {
        const token = localStorage.getItem("bb_token");
        if (!token) return;
        const newFiles: UploadingFile[] = Array.from(files).map(file => ({
            tempId: Math.random().toString(36).slice(2, 8),
            file, name: file.name, size: file.size, progress: 0, status: "queued",
        }));
        setUploadQueue(prev => [...prev, ...newFiles]);
        newFiles.forEach(f => startUpload(f, token));
    };

    const startUpload = (fileObj: UploadingFile, token: string) => {
        const xhr = new XMLHttpRequest();
        const fd = new FormData();
        fd.append("file", fileObj.file);
        xhr.open("POST", `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/cases/${caseId}/evidence`, true);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.onprogress = e => {
            if (e.lengthComputable)
                setUploadQueue(prev => prev.map(f => f.tempId === fileObj.tempId ? { ...f, progress: Math.round(e.loaded / e.total * 100) } : f));
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                setUploadQueue(prev => prev.filter(f => f.tempId !== fileObj.tempId));
                queryClient.invalidateQueries({ queryKey: ["evidence", caseId] });
                toast.success(`Ingested: ${fileObj.name}`);
            } else {
                let msg = "Upload failed";
                try { msg = JSON.parse(xhr.responseText).message ?? msg; } catch (_) {}
                setUploadQueue(prev => prev.map(f => f.tempId === fileObj.tempId ? { ...f, status: "failed", error: msg } : f));
                toast.error(`Failed: ${fileObj.name}`);
            }
        };
        xhr.onerror = () => setUploadQueue(prev => prev.map(f => f.tempId === fileObj.tempId ? { ...f, status: "failed", error: "Network error" } : f));
        setUploadQueue(prev => prev.map(f => f.tempId === fileObj.tempId ? { ...f, status: "uploading", xhr } : f));
        xhr.send(fd);
    };

    const cancelUpload = (tempId: string) => {
        uploadQueue.find(f => f.tempId === tempId)?.xhr?.abort();
        setUploadQueue(prev => prev.filter(f => f.tempId !== tempId));
    };

    const retryUpload = (tempId: string) => {
        const token = localStorage.getItem("bb_token");
        const fileObj = uploadQueue.find(f => f.tempId === tempId);
        if (!fileObj || !token) return;
        setUploadQueue(prev => prev.map(f => f.tempId === tempId ? { ...f, status: "queued", progress: 0, error: undefined } : f));
        startUpload(fileObj, token);
    };

    return (
        <div className="flex h-full w-full bg-black text-white overflow-hidden">
            {/* Main Workspace Area */}
            <div className="flex-grow flex flex-col min-w-0 h-full">
                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between shrink-0 border-b border-zinc-800 h-[45px]">
                    <div className="flex items-center gap-2">
                        <FileText size={13} className="text-muted-foreground" />
                        <span className="font-mono text-xs tracking-widest text-muted-foreground font-bold uppercase">EVIDENCE WORKSPACE</span>
                    </div>
                    {evidenceList && (
                        <span className="font-mono text-xs text-muted-foreground uppercase">
                            {evidenceList.length} FILE{evidenceList.length !== 1 ? "S" : ""}
                        </span>
                    )}
                </div>

                {/* Scrollable Main Area */}
                <div className="flex-grow overflow-y-auto p-5 space-y-6">
                    {/* Drop zone */}
                    <div
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border border-dashed py-10 flex flex-col items-center gap-3 cursor-pointer relative overflow-hidden transition-colors ${
                            dragActive ? "border-white bg-zinc-900/40" : "border-zinc-800 hover:border-zinc-700"
                        }`}
                    >
                        {dragActive && <div className="absolute inset-x-0 h-px bg-white/60 animate-scan" />}
                        <input ref={fileInputRef} type="file" multiple className="hidden"
                            accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv,.txt"
                            onChange={e => e.target.files && handleFiles(e.target.files)} />
                        <Upload size={22} className={dragActive ? "text-white" : "text-zinc-500"} />
                        <div className="text-center space-y-1">
                            <p className="font-mono text-xs tracking-widest text-white uppercase font-bold">DRAG & DROP EVIDENCE FILES</p>
                            <p className="font-mono text-[10px] text-zinc-500 uppercase">PDF · PNG · JPG · DOCX · XLSX · CSV · TXT — MAX 100MB</p>
                        </div>
                    </div>

                    {/* Upload Queue */}
                    <AnimatePresence>
                        {uploadQueue.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="border border-zinc-800 overflow-hidden bg-zinc-950/20"
                            >
                                <div className="px-4 py-2.5 flex items-center justify-between bg-zinc-900/60 border-b border-zinc-850">
                                    <div className="flex items-center gap-2">
                                        <Activity size={11} className="text-success animate-pulse" />
                                        <span className="font-mono text-xs tracking-widest text-white uppercase font-bold">INGESTION QUEUE ({uploadQueue.length})</span>
                                    </div>
                                    <button
                                        onClick={() => { uploadQueue.forEach(f => f.xhr?.abort()); setUploadQueue([]); }}
                                        className="font-mono text-[10px] tracking-widest text-zinc-500 hover:text-white uppercase font-bold"
                                    >
                                        CLEAR ALL
                                    </button>
                                </div>
                                <div className="divide-y divide-zinc-900 max-h-44 overflow-y-auto">
                                    <AnimatePresence>
                                        {uploadQueue.map(item => (
                                            <motion.div key={item.tempId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                                                className="px-4 py-3 flex items-center gap-4">
                                                <div className="flex-1 min-w-0 space-y-1.5 font-mono text-xs">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-white truncate uppercase font-bold">{item.name}</span>
                                                        <span className={`text-[10px] shrink-0 font-bold ${item.status === "failed" ? "text-warning" : "text-zinc-500"}`}>
                                                            {item.status.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    {item.status !== "failed" && (
                                                        <div className="h-1 bg-zinc-900 overflow-hidden">
                                                            <div className="h-full bg-white transition-all duration-200" style={{ width: `${item.progress}%` }} />
                                                        </div>
                                                    )}
                                                    {item.error && <p className="text-[10px] text-warning uppercase font-semibold">{item.error}</p>}
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {item.status === "failed" && (
                                                        <button
                                                            onClick={() => retryUpload(item.tempId)}
                                                            className="p-1.5 border border-zinc-800 hover:border-white transition-colors text-zinc-400 hover:text-white"
                                                            title="Retry"
                                                        >
                                                            <RefreshCw size={12} />
                                                        </button>
                                                    )}
                                                    {(item.status === "uploading" || item.status === "queued") && (
                                                        <button
                                                            onClick={() => cancelUpload(item.tempId)}
                                                            className="p-1.5 border border-zinc-800 hover:border-white transition-colors text-zinc-400 hover:text-white"
                                                            title="Cancel"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Evidence list */}
                    <div className="space-y-3">
                        <span className="font-mono text-xs tracking-widest text-zinc-500 font-bold uppercase block">
                            SECURE EVIDENCE ARCHIVE
                        </span>
                        {isLoading ? (
                            <div className="space-y-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-14 border border-zinc-900 bg-zinc-950/20 animate-pulse" />
                                ))}
                            </div>
                        ) : error ? (
                            <div className="border border-warning/20 p-6 text-center font-mono text-xs text-warning uppercase font-bold">
                                FAILED TO RETRIEVE EVIDENCE ARCHIVE
                            </div>
                        ) : evidenceList?.length ? (
                            <div className="border border-zinc-800 divide-y divide-zinc-900 bg-zinc-950/10">
                                {evidenceList.map(e => {
                                    const isSel = selected?.id === e.id;
                                    return (
                                        <div 
                                            key={e.id} 
                                            onClick={() => setSelected(selected?.id === e.id ? null : e)}
                                            className={`px-4 py-3 flex items-center justify-between hover:bg-zinc-900/40 transition-colors cursor-pointer border-l-2 ${
                                                isSel ? "bg-zinc-900/60 border-l-white" : "border-l-transparent"
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <FileText size={13} className="text-zinc-500 shrink-0" />
                                                <div className="min-w-0 font-mono text-xs">
                                                    <p className="text-white truncate uppercase font-bold">{e.fileName}</p>
                                                    <p className="text-[10px] text-zinc-500 uppercase mt-0.5">
                                                        {e.mimeType.toUpperCase()} · {new Date(e.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 shrink-0">
                                                <span className={`text-[10px] px-1.5 py-0.5 border leading-none font-bold font-mono tracking-wider ${
                                                    e.status === "COMPLETED"
                                                        ? "text-success border-success/40 bg-success/5"
                                                        : e.status === "PROCESSING"
                                                        ? "text-success border-success/40 bg-success/5 animate-pulse"
                                                        : e.status === "PENDING"
                                                        ? "text-zinc-400 border-zinc-700 bg-zinc-950"
                                                        : "text-warning border-warning/40 bg-warning/5"
                                                }`}>
                                                    {e.status}
                                                </span>
                                                <button
                                                    onClick={ev => { 
                                                        ev.stopPropagation(); 
                                                        if (confirm("Delete this evidence source?")) deleteMutation.mutate(e.id); 
                                                    }}
                                                    disabled={deleteMutation.isPending && deleteMutation.variables === e.id}
                                                    className="p-1 text-zinc-500 hover:text-white transition-colors disabled:opacity-40"
                                                    title="Delete evidence"
                                                >
                                                    {deleteMutation.isPending && deleteMutation.variables === e.id ? (
                                                        <Loader2 size={12} className="animate-spin" />
                                                    ) : (
                                                        <Trash2 size={12} />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="border border-zinc-800 border-dashed py-16 flex flex-col items-center gap-2 text-center select-none bg-zinc-950/5">
                                <p className="font-mono text-xs tracking-widest text-zinc-400 uppercase font-bold">NO EVIDENCE INGESTED</p>
                                <p className="font-mono text-[10px] text-zinc-500 max-w-xs leading-relaxed uppercase font-semibold">
                                    Upload files to trigger parser engines and populate the case archive.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Custom AI sidebar panel container */}
            <div className={`transition-all duration-300 ease-in-out shrink-0 h-full ${
                isRightCollapsed ? "w-12" : "w-[320px]"
            }`}>
                <CaseAIPanel
                    title="EVIDENCE AI"
                    suggestions={[
                        "Summarize all evidence",
                        "Find key entities",
                        "Compare documents",
                        "Explain OCR results",
                        "Suggest missing evidence"
                    ]}
                    placeholder="ASK ABOUT EVIDENCE..."
                    selectedItemName={selected?.fileName}
                    contextType="Evidence Ingestion Pipeline"
                    isCollapsed={isRightCollapsed}
                    onToggleCollapse={() => setIsRightCollapsed(!isRightCollapsed)}
                />
            </div>
        </div>
    );
}
