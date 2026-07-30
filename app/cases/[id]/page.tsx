"use client"

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { casesApi, Case } from "@/lib/api/cases";
import { evidenceApi, Evidence } from "@/lib/api/evidence";
import TopNav from "@/components/layout/top-nav";
import { 
    ArrowLeft, 
    Upload, 
    FileText, 
    Trash2, 
    AlertTriangle, 
    CheckCircle, 
    Clock, 
    RefreshCw, 
    X,
    Loader2,
    Lock,
    Terminal,
    Cpu,
    Activity
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { DecryptText } from "@/components/landing/decrypt-text";

interface UploadingFile {
    tempId: string;
    file: File;
    name: string;
    size: number;
    progress: number;
    status: "queued" | "uploading" | "processing" | "completed" | "failed";
    error?: string;
    xhr?: XMLHttpRequest;
}

export default function CaseWorkspacePage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const caseId = params.id as string;
    
    const [uploadQueue, setUploadQueue] = useState<UploadingFile[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Redirect to login if token is missing
    useEffect(() => {
        const token = localStorage.getItem("bb_token");
        if (!token) {
            router.push("/login");
        }
    }, [router]);

    // Query for Case Details
    const { data: caseData, isLoading: caseLoading, error: caseError } = useQuery<Case>({
        queryKey: ["case", caseId],
        queryFn: () => casesApi.getById(caseId),
        enabled: !!caseId,
    });

    // Query for Evidence List (with auto-polling if any evidence is processing or pending)
    const { data: evidenceList, isLoading: evidenceLoading, error: evidenceError } = useQuery<Evidence[]>({
        queryKey: ["evidence", caseId],
        queryFn: () => evidenceApi.getByCase(caseId),
        enabled: !!caseId,
        refetchInterval: (query) => {
            const list = query.state.data as Evidence[] | undefined;
            if (list && list.some(e => e.status === "PENDING" || e.status === "PROCESSING")) {
                return 3000;
            }
            return false;
        }
    });

    // Delete Evidence Mutation
    const deleteMutation = useMutation({
        mutationFn: evidenceApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["evidence", caseId] });
            toast.success("EVIDENCE FILE DELETED");
        },
        onError: (err: any) => {
            toast.error(err?.message || "FAILED TO DELETE EVIDENCE");
        }
    });

    // Handle Drag & Drop events
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFiles(e.target.files);
        }
    };

    const handleFiles = (files: FileList) => {
        const token = localStorage.getItem("bb_token");
        if (!token) return;

        const newFiles: UploadingFile[] = Array.from(files).map(file => {
            const tempId = Math.random().toString(36).substring(7);
            return {
                tempId,
                file,
                name: file.name,
                size: file.size,
                progress: 0,
                status: "queued"
            };
        });

        setUploadQueue(prev => [...prev, ...newFiles]);
        
        // Trigger uploads for queued items
        newFiles.forEach(fileObj => {
            handleUpload(fileObj, token);
        });
    };

    const handleUpload = (fileObj: UploadingFile, token: string) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append("file", fileObj.file);

        xhr.open("POST", `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/evidence/upload/${caseId}`, true);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        // Update progress handler
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                setUploadQueue(prev => 
                    prev.map(f => f.tempId === fileObj.tempId ? { ...f, progress: percentComplete } : f)
                );
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                setUploadQueue(prev => prev.filter(f => f.tempId !== fileObj.tempId));
                queryClient.invalidateQueries({ queryKey: ["evidence", caseId] });
                toast.success(`INGESTED: ${fileObj.name}`);
            } else {
                let errMsg = "Upload failed";
                try {
                    const res = JSON.parse(xhr.responseText);
                    errMsg = res.message || errMsg;
                } catch (_) {}
                setUploadQueue(prev => 
                    prev.map(f => f.tempId === fileObj.tempId ? { ...f, status: "failed", error: errMsg } : f)
                );
                toast.error(`Ingestion error on ${fileObj.name}`);
            }
        };

        xhr.onerror = () => {
            setUploadQueue(prev => 
                prev.map(f => f.tempId === fileObj.tempId ? { ...f, status: "failed", error: "Network error occurred" } : f)
            );
        };

        setUploadQueue(prev => 
            prev.map(f => f.tempId === fileObj.tempId ? { ...f, status: "uploading", xhr } : f)
        );

        xhr.send(formData);
    };

    const handleCancelUpload = (tempId: string) => {
        const fileObj = uploadQueue.find(f => f.tempId === tempId);
        if (fileObj && fileObj.xhr) {
            fileObj.xhr.abort();
        }
        setUploadQueue(prev => prev.filter(f => f.tempId !== tempId));
    };

    const handleRetryUpload = (tempId: string) => {
        const token = localStorage.getItem("bb_token");
        const fileObj = uploadQueue.find(f => f.tempId === tempId);
        if (!fileObj || !token) return;

        setUploadQueue(prev => 
            prev.map(f => f.tempId === tempId ? { ...f, status: "queued", progress: 0, error: undefined } : f)
        );
        handleUpload(fileObj, token);
    };

    const handleClearQueue = () => {
        uploadQueue.forEach(f => {
            if (f.status === "uploading" && f.xhr) {
                f.xhr.abort();
            }
        });
        setUploadQueue([]);
    };

    const formatBytes = (bytes: number, decimals = 2) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    };

    return (
        <div className="flex flex-col min-h-screen bg-black text-white font-sans relative select-none">
            <TopNav />

            {/* Workspace Area */}
            <div className="flex-1 flex flex-col lg:flex-row max-w-[1440px] w-full mx-auto px-6 py-12 gap-8 z-10 relative">
                
                {/* Left Panel: Case Specs */}
                <aside className="w-full lg:w-[320px] shrink-0 space-y-8 select-none">
                    
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="flex items-center space-x-2 font-mono text-xs tracking-wider text-zinc-400 hover:text-white transition-colors bg-transparent border border-hairline py-3.5 px-4 hover:border-white w-full justify-center rounded-none uppercase"
                    >
                        <ArrowLeft size={14} />
                        <span>RETURN TO ARCHIVE</span>
                    </button>

                    {caseLoading ? (
                        <div className="border border-hairline bg-zinc-950/20 p-6 space-y-4 animate-pulse relative">
                            <div className="h-6 bg-hairline-strong w-2/3" />
                            <div className="h-4 bg-hairline-strong w-1/3" />
                            <div className="h-[1px] bg-hairline" />
                            <div className="h-4 bg-hairline-strong w-1/2" />
                        </div>
                    ) : caseError ? (
                        <div className="border border-warning/20 bg-zinc-950/40 p-6 text-center relative">
                            <AlertTriangle className="text-warning mx-auto mb-2" size={24} />
                            <p className="font-mono text-xs tracking-wider text-warning uppercase">
                                CASE RETRIEVAL ERROR
                            </p>
                        </div>
                    ) : caseData ? (
                        <div className="border border-hairline bg-zinc-950/20 p-6 space-y-6 relative">
                            <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 border-t border-l border-white/30" />
                            <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 border-t border-r border-white/30" />
                            <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 border-b border-l border-white/30" />
                            <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 border-b border-r border-white/30" />
                            
                            <div className="space-y-2 text-left">
                                <span className="font-mono text-xs tracking-wider text-zinc-400 block">
                                    CASE FILE PROFILE
                                </span>
                                <h2 className="font-mono text-base font-bold tracking-wide text-white uppercase break-words">
                                    {caseData.name}
                                </h2>
                            </div>

                            <div className="border-t border-hairline pt-6 space-y-4 font-mono text-xs tracking-wide text-zinc-400 text-left">
                                <div className="flex justify-between py-1.5 border-b border-hairline-strong">
                                    <span>SEVERITY:</span>
                                    <span className={caseData.severity === "CRITICAL" ? "text-warning font-bold" : "text-white font-bold"}>
                                        {caseData.severity}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-hairline-strong">
                                    <span>STATUS:</span>
                                    <span className="text-white font-bold">{caseData.status}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-hairline-strong">
                                    <span>RECORD_HASH:</span>
                                    <span className="text-white font-bold">{caseData.id.slice(0, 8).toUpperCase()}</span>
                                </div>
                                <div className="flex justify-between py-1.5">
                                    <span>CREATED:</span>
                                    <span className="text-white font-bold">{new Date(caseData.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <div className="border-t border-hairline pt-6">
                                <div className="flex items-center space-x-2 text-zinc-400">
                                    <Lock size={12} className="text-success animate-pulse" />
                                    <span className="font-mono text-xs tracking-wider">
                                        ISOLATION PARTITION SECURE
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* Pending Feature Info */}
                    <div className="border border-hairline bg-zinc-950/20 p-6 space-y-4 relative text-left">
                        <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 border-t border-l border-white/30" />
                        <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 border-t border-r border-white/30" />
                        
                        <h4 className="font-mono text-xs tracking-wider text-zinc-400 uppercase flex items-center space-x-1.5">
                            <Cpu size={12} />
                            <span>COGNITIVE ENCLAVES</span>
                        </h4>
                        <div className="space-y-2 font-mono text-xs text-zinc-400 tracking-wide">
                            <p className="border-l border-hairline pl-3 py-0.5">
                                ✓ Text Extraction [INGESTED]
                            </p>
                            <p className="border-l border-hairline pl-3 py-0.5">
                                ✓ Queue Manager [ACTIVE]
                            </p>
                            <p className="border-l border-warning/50 pl-3 py-0.5 text-zinc-400">
                                ⧗ Relational Graph [PENDING]
                            </p>
                            <p className="border-l border-warning/50 pl-3 py-0.5 text-zinc-400">
                                ⧗ Inference Lab [PENDING]
                            </p>
                        </div>
                    </div>
                </aside>

                {/* Right Panel: Upload & Files */}
                <main className="flex-grow flex flex-col space-y-12 text-left">
                    {/* Drag & Drop Upload Zone */}
                    <section className="space-y-4">
                        <h3 className="font-mono text-xs tracking-wider text-zinc-400 uppercase flex items-center space-x-1.5 select-none">
                            <Activity size={12} />
                            <span>FILE INGESTION SCANNER</span>
                        </h3>
                        
                        <div
                          onDragEnter={handleDrag}
                          onDragOver={handleDrag}
                          onDragLeave={handleDrag}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`border border-dashed transition-all duration-300 py-12 px-6 flex flex-col items-center justify-center space-y-4 cursor-pointer text-center relative overflow-hidden ${
                              dragActive 
                                  ? "border-white bg-zinc-950/45" 
                                  : "border-hairline bg-zinc-950/10 hover:bg-zinc-950/20 hover:border-white/30"
                          }`}
                        >
                            {/* Scanning laser sweep when drag is active */}
                            {dragActive && (
                                <div className="absolute left-0 right-0 h-[2px] bg-white z-10 pointer-events-none animate-scan" />
                            )}

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileInput}
                                multiple
                                className="hidden"
                                accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv,.txt"
                            />
                            
                            <Upload size={32} className={dragActive ? "text-white animate-bounce" : "text-zinc-500"} />
                            
                            <div className="space-y-2 select-none">
                                <p className="font-mono text-sm tracking-wider text-white uppercase font-bold">
                                    DRAG & DROP OR SELECT EVIDENCE PORTFOLIO
                                </p>
                                <p className="font-mono text-xs text-zinc-400 uppercase tracking-wide leading-relaxed max-w-sm mx-auto">
                                    Supported payload: PDF, PNG, JPG, JPEG, DOCX, XLSX, CSV, TXT (Max 100MB)
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Active Upload Queue */}
                    {uploadQueue.length > 0 && (
                        <section className="border border-hairline bg-zinc-950/20 p-6 space-y-6 relative">
                            <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 border-t border-l border-white/30" />
                            <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 border-t border-r border-white/30" />

                            <div className="flex justify-between items-center border-b border-hairline pb-4 font-mono text-xs tracking-wider select-none">
                                <h3 className="text-white font-bold flex items-center space-x-2">
                                    <Activity size={12} className="text-success animate-pulse" />
                                    <span>ACTIVE INGESTION QUEUE ({uploadQueue.length})</span>
                                </h3>
                                <button
                                    onClick={handleClearQueue}
                                    className="text-zinc-400 hover:text-white transition-colors bg-transparent border-none uppercase font-semibold"
                                >
                                    [CLEAR ALL]
                                </button>
                            </div>

                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                <AnimatePresence initial={false}>
                                    {uploadQueue.map((item) => (
                                        <motion.div
                                            key={item.tempId}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="border border-hairline bg-black/40 p-4 space-y-3 relative text-left"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1 pr-4 min-w-0 font-mono">
                                                    <h4 className="text-xs font-bold text-white truncate pr-4">
                                                        {item.name}
                                                    </h4>
                                                    <p className="text-xs text-zinc-400">
                                                        SIZE: {formatBytes(item.size)}
                                                    </p>
                                                </div>

                                                <div className="flex items-center space-x-3 shrink-0 select-none">
                                                    <span className={`font-mono text-xs tracking-wider px-2.5 py-1 border ${
                                                        item.status === "failed" ? "border-warning text-warning" : 
                                                        item.status === "processing" ? "border-success text-success animate-pulse" :
                                                        item.status === "uploading" ? "border-white text-white" :
                                                        "border-hairline-strong text-zinc-400"
                                                    }`}>
                                                        {item.status.toUpperCase()}
                                                    </span>

                                                    {item.status === "failed" && (
                                                        <button 
                                                            onClick={() => handleRetryUpload(item.tempId)}
                                                            className="text-zinc-400 hover:text-white transition-colors"
                                                            title="Retry upload"
                                                        >
                                                            <RefreshCw size={14} />
                                                        </button>
                                                    )}

                                                    {(item.status === "uploading" || item.status === "queued") && (
                                                        <button 
                                                            onClick={() => handleCancelUpload(item.tempId)}
                                                            className="text-zinc-400 hover:text-white transition-colors"
                                                            title="Cancel upload"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Progress bar */}
                                            {item.status !== "failed" && (
                                                <div className="space-y-1">
                                                    <div className="w-full h-[3px] bg-hairline-strong rounded-none overflow-hidden">
                                                        <div 
                                                            className="h-full bg-white transition-all duration-300"
                                                            style={{ width: `${item.progress}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex justify-between font-mono text-xs text-zinc-400">
                                                        <span>{item.progress}% UPLOADED</span>
                                                    </div>
                                                </div>
                                            )}

                                            {item.error && (
                                                <p className="font-mono text-xs text-warning uppercase">
                                                    ERROR: {item.error}
                                                </p>
                                            )}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </section>
                    )}

                    {/* Evidence Files Archive (POST-processing) */}
                    <section className="space-y-4">
                        <h3 className="font-mono text-xs tracking-wider text-zinc-400 uppercase flex items-center space-x-1.5 select-none">
                            <Terminal size={12} />
                            <span>SECURE EVIDENCE ARCHIVE</span>
                        </h3>

                        {evidenceLoading ? (
                            <div className="space-y-4">
                                {[1, 2].map((i) => (
                                    <div key={i} className="h-16 border border-hairline animate-pulse bg-zinc-950/20" />
                                ))}
                            </div>
                        ) : evidenceError ? (
                            <div className="border border-warning/20 bg-zinc-950/40 p-6 text-center text-warning font-mono text-xs uppercase select-none">
                                FAILED TO RETRIEVE EVIDENCE LOGS
                            </div>
                        ) : evidenceList && evidenceList.length > 0 ? (
                            <div className="border border-hairline bg-zinc-950/20 divide-y divide-hairline">
                                {evidenceList.map((e) => (
                                    <div 
                                        key={e.id}
                                        className="p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-zinc-950/60 transition-colors gap-4"
                                    >
                                        <div className="flex items-start space-x-3.5 min-w-0 text-left">
                                            <FileText size={16} className="text-zinc-400 shrink-0 mt-0.5" />
                                            <div className="min-w-0 space-y-1.5 font-mono">
                                                <h4 className="text-sm font-bold text-white truncate pr-4" title={e.fileName}>
                                                    {e.fileName}
                                                </h4>
                                                <div className="flex space-x-4 text-xs text-zinc-400">
                                                    <span>MIME: {e.mimeType.toUpperCase()}</span>
                                                    <span>DATE: {new Date(e.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end space-x-6 shrink-0 select-none">
                                            {/* Status logic */}
                                            <div className="flex items-center space-x-2">
                                                {e.status === "COMPLETED" && (
                                                    <span className="flex items-center space-x-1.5 font-mono text-xs text-success tracking-wider font-bold">
                                                        <CheckCircle size={12} />
                                                        <span>COMPLETED</span>
                                                    </span>
                                                )}
                                                {e.status === "PROCESSING" && (
                                                    <span className="flex items-center space-x-1.5 font-mono text-xs text-success tracking-wider font-bold animate-pulse">
                                                        <Loader2 size={12} className="animate-spin" />
                                                        <span>PROCESSING</span>
                                                    </span>
                                                )}
                                                {e.status === "PENDING" && (
                                                    <span className="flex items-center space-x-1.5 font-mono text-xs text-zinc-400 tracking-wider font-bold">
                                                        <Clock size={12} />
                                                        <span>IN QUEUE</span>
                                                    </span>
                                                )}
                                                {e.status === "FAILED" && (
                                                    <span className="flex items-center space-x-1.5 font-mono text-xs text-warning tracking-wider font-bold">
                                                        <AlertTriangle size={12} />
                                                        <span>FAILED</span>
                                                    </span>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => deleteMutation.mutate(e.id)}
                                                disabled={deleteMutation.isPending && deleteMutation.variables === e.id}
                                                className="text-zinc-400 hover:text-white transition-colors p-1.5 border border-transparent hover:border-hairline hover:bg-zinc-950"
                                                title="Delete archive log"
                                            >
                                                {deleteMutation.isPending && deleteMutation.variables === e.id ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <Trash2 size={14} />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="border border-dashed border-hairline py-12 flex flex-col items-center justify-center space-y-2.5 text-center select-none">
                                <p className="font-mono text-xs tracking-wider text-zinc-400 uppercase">
                                    NO EVIDENCE INGESTED FOR THIS SEGMENT
                                </p>
                                <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
                                    Ingest document payload feeds to trigger parser engines and contextualize node vectors securely.
                                </p>
                            </div>
                        )}
                    </section>
                </main>
            </div>
        </div>
    );
}
