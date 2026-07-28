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
    Lock
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

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
                return 3000; // Poll every 3 seconds if active jobs exist
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
            handleFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFiles(Array.from(e.target.files));
        }
    };

    // Filter and add files to the local queue
    const handleFiles = (files: File[]) => {
        const allowedExtensions = ["pdf", "png", "jpg", "jpeg", "docx", "xlsx", "csv", "txt"];
        
        const newUploadingFiles: UploadingFile[] = [];

        files.forEach(file => {
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (!ext || !allowedExtensions.includes(ext)) {
                toast.error(`UNSUPPORTED FILE: ${file.name}`);
                return;
            }

            const tempId = Math.random().toString(36).substring(2, 9);
            newUploadingFiles.push({
                tempId,
                file,
                name: file.name,
                size: file.size,
                progress: 0,
                status: "queued"
            });
        });

        if (newUploadingFiles.length > 0) {
            setUploadQueue(prev => [...prev, ...newUploadingFiles]);
        }
    };

    // Trigger sequential or parallel uploads
    useEffect(() => {
        const queuedFile = uploadQueue.find(f => f.status === "queued");
        if (queuedFile) {
            uploadFile(queuedFile);
        }
    }, [uploadQueue]);

    // Perform actual upload with progress callback
    const uploadFile = (uploadingFile: UploadingFile) => {
        // Mark as uploading
        setUploadQueue(prev => 
            prev.map(f => f.tempId === uploadingFile.tempId ? { ...f, status: "uploading" } : f)
        );

        let xhrRef: XMLHttpRequest;

        // Custom promise to capture XHR reference for abort
        const performUpload = () => {
            return new Promise<any>((resolve, reject) => {
                const token = localStorage.getItem("bb_token");
                const xhr = new XMLHttpRequest();
                xhrRef = xhr;

                // Update queue state with XHR ref
                setUploadQueue(prev => 
                    prev.map(f => f.tempId === uploadingFile.tempId ? { ...f, xhr } : f)
                );

                const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
                xhr.open("POST", `${BASE_URL}/cases/${caseId}/evidence`, true);
                
                if (token) {
                    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
                }

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = Math.round((event.loaded / event.total) * 100);
                        setUploadQueue(prev => 
                            prev.map(f => f.tempId === uploadingFile.tempId ? { ...f, progress: percentComplete } : f)
                        );
                    }
                };

                xhr.onload = () => {
                    let data: any = null;
                    const contentType = xhr.getResponseHeader("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        try {
                            data = JSON.parse(xhr.responseText);
                        } catch {
                            data = xhr.responseText;
                        }
                    } else {
                        data = xhr.responseText;
                    }

                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(data?.message || data?.error || `Upload failed (${xhr.status})`));
                    }
                };

                xhr.onerror = () => reject(new Error("Network connection lost."));
                xhr.onabort = () => reject(new Error("Upload cancelled by operator."));

                const formData = new FormData();
                formData.append("file", uploadingFile.file);
                xhr.send(formData);
            });
        };

        performUpload()
            .then((res) => {
                setUploadQueue(prev => 
                    prev.map(f => f.tempId === uploadingFile.tempId ? { ...f, status: "processing", progress: 100 } : f)
                );
                toast.success(`UPLOAD COMPLETE: ${uploadingFile.name}`);
                queryClient.invalidateQueries({ queryKey: ["evidence", caseId] });
            })
            .catch((err) => {
                // If aborted, don't show error toast unless it's an actual failure
                if (xhrRef.status === 0 && xhrRef.readyState === 4) {
                    // Aborted
                    return;
                }
                setUploadQueue(prev => 
                    prev.map(f => f.tempId === uploadingFile.tempId ? { ...f, status: "failed", error: err.message } : f)
                );
                toast.error(`UPLOAD FAILED: ${uploadingFile.name}`);
            });
    };

    const handleCancelUpload = (tempId: string) => {
        const file = uploadQueue.find(f => f.tempId === tempId);
        if (file) {
            if (file.xhr) {
                file.xhr.abort();
            }
            setUploadQueue(prev => prev.filter(f => f.tempId !== tempId));
            toast.info("UPLOAD CANCELLED");
        }
    };

    const handleRetryUpload = (tempId: string) => {
        setUploadQueue(prev => 
            prev.map(f => f.tempId === tempId ? { ...f, status: "queued", progress: 0, error: undefined } : f)
        );
    };

    const handleClearQueue = () => {
        // Abort any running uploads first
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
        <div className="flex flex-col min-h-screen bg-black text-white font-sans-body">
            <TopNav />

            {/* Workspace Area */}
            <div className="flex-1 flex flex-col lg:flex-row max-w-[1440px] w-full mx-auto px-6 py-[40px] lg:py-[64px] gap-8">
                {/* Left Panel: Case Specs */}
                <aside className="w-full lg:w-[320px] shrink-0 space-y-8 select-none">
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="flex items-center space-x-2 font-mono-precision text-[10px] tracking-[0.2em] text-muted hover:text-white transition-colors bg-transparent border border-hairline py-2 px-4 hover:border-white w-full justify-center"
                    >
                        <ArrowLeft size={12} />
                        <span>RETURN TO ARCHIVE</span>
                    </button>

                    {caseLoading ? (
                        <div className="border border-hairline bg-surface-soft p-6 space-y-4 animate-pulse">
                            <div className="h-6 bg-hairline-strong w-2/3" />
                            <div className="h-4 bg-hairline-strong w-1/3" />
                            <div className="h-[1px] bg-hairline" />
                            <div className="h-4 bg-hairline-strong w-1/2" />
                        </div>
                    ) : caseError ? (
                        <div className="border border-warning/20 bg-surface-soft p-6 text-center">
                            <AlertTriangle className="text-warning mx-auto mb-2" size={24} />
                            <p className="font-mono-precision text-[10px] tracking-[0.15em] text-warning uppercase">
                                CASE RETRIEVAL ERROR
                            </p>
                        </div>
                    ) : caseData ? (
                        <div className="border border-hairline bg-surface-soft p-6 space-y-6">
                            <div className="space-y-2">
                                <span className="font-mono-precision text-[9px] tracking-[0.25em] text-muted block">
                                    CASE FILE PROFILE
                                </span>
                                <h2 className="font-display text-xl tracking-[0.1em] text-white uppercase break-words">
                                    {caseData.name}
                                </h2>
                            </div>

                            <div className="border-t border-hairline pt-6 space-y-4 font-mono-precision text-[10px] tracking-[0.15em] text-muted">
                                <div className="flex justify-between">
                                    <span>SEVERITY:</span>
                                    <span className={caseData.severity === "CRITICAL" ? "text-warning" : "text-white"}>
                                        {caseData.severity}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>STATUS:</span>
                                    <span className="text-white">{caseData.status}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>RECORD_ID:</span>
                                    <span className="text-white">{caseData.id.slice(0, 8).toUpperCase()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>CREATED:</span>
                                    <span className="text-white">{new Date(caseData.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <div className="border-t border-hairline pt-6">
                                <div className="flex items-center space-x-2 text-muted-soft">
                                    <Lock size={12} />
                                    <span className="font-mono-precision text-[9px] tracking-[0.15em]">
                                        ISOLATION PARTITION ON
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* Pending Feature Info */}
                    <div className="border border-hairline border-dashed p-6 space-y-4">
                        <h4 className="font-mono-precision text-[10px] tracking-[0.2em] text-muted uppercase">
                            SYSTEM CAPABILITIES
                        </h4>
                        <div className="space-y-2 text-xs text-muted-soft">
                            <p className="border-l border-hairline pl-3 py-1">
                                ✓ Text Extraction (Ingested)
                            </p>
                            <p className="border-l border-hairline pl-3 py-1">
                                ✓ Queue Management (Active)
                            </p>
                            <p className="border-l border-warning pl-3 py-1 text-muted">
                                ⧗ Investigation Graph (Pending Backend API)
                            </p>
                            <p className="border-l border-warning pl-3 py-1 text-muted">
                                ⧗ Hypothesis Lab (Pending Backend API)
                            </p>
                        </div>
                    </div>
                </aside>

                {/* Right Panel: Upload & Files */}
                <main className="flex-grow flex flex-col space-y-12">
                    {/* Drag & Drop Upload Zone */}
                    <section className="space-y-4">
                        <h3 className="font-mono-precision text-[11px] tracking-[0.25em] text-muted uppercase">
                            FILE INGESTION PIPELINE
                        </h3>
                        
                        <div
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border border-dashed transition-colors duration-150 py-12 px-6 flex flex-col items-center justify-center space-y-4 cursor-pointer text-center ${
                                dragActive 
                                    ? "border-link bg-surface-soft/80" 
                                    : "border-hairline bg-transparent hover:bg-surface-soft/40"
                            }`}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileInput}
                                multiple
                                className="hidden"
                                accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv,.txt"
                            />
                            
                            <Upload size={32} className={dragActive ? "text-link animate-bounce" : "text-muted"} />
                            
                            <div className="space-y-2">
                                <p className="font-mono-precision text-[12px] tracking-[0.2em] text-white">
                                    DRAG & DROP OR SELECT FILES
                                </p>
                                <p className="font-sans-body text-xs text-muted">
                                    Supported types: PDF, PNG, JPG, JPEG, DOCX, XLSX, CSV, TXT (Max 100MB)
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Active Upload Queue */}
                    {uploadQueue.length > 0 && (
                        <section className="border border-hairline bg-surface-soft p-6 space-y-6">
                            <div className="flex justify-between items-center border-b border-hairline pb-4">
                                <h3 className="font-display text-sm tracking-[0.2em] text-white uppercase">
                                    ACTIVE INGESTION QUEUE ({uploadQueue.length})
                                </h3>
                                <button
                                    onClick={handleClearQueue}
                                    className="font-mono-precision text-[10px] tracking-[0.15em] text-muted hover:text-white transition-colors bg-transparent border-none"
                                >
                                    CLEAR ALL
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
                                            className="border border-hairline bg-black p-4 space-y-3"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1 pr-4 min-w-0">
                                                    <h4 className="font-mono-precision text-[11px] tracking-wide text-white truncate">
                                                        {item.name}
                                                    </h4>
                                                    <p className="text-[10px] text-muted-soft font-mono">
                                                        {formatBytes(item.size)}
                                                    </p>
                                                </div>

                                                <div className="flex items-center space-x-3 shrink-0">
                                                    <span className={`font-mono-precision text-[9px] tracking-widest px-2 py-0.5 border ${
                                                        item.status === "failed" ? "border-warning text-warning" : 
                                                        item.status === "processing" ? "border-link text-link animate-pulse" :
                                                        item.status === "uploading" ? "border-white text-white" :
                                                        "border-hairline-strong text-muted"
                                                    }`}>
                                                        {item.status.toUpperCase()}
                                                    </span>

                                                    {item.status === "failed" && (
                                                        <button 
                                                            onClick={() => handleRetryUpload(item.tempId)}
                                                            className="text-muted hover:text-white transition-colors"
                                                            title="Retry upload"
                                                        >
                                                            <RefreshCw size={12} />
                                                        </button>
                                                    )}

                                                    {(item.status === "uploading" || item.status === "queued") && (
                                                        <button 
                                                            onClick={() => handleCancelUpload(item.tempId)}
                                                            className="text-muted hover:text-white transition-colors"
                                                            title="Cancel upload"
                                                        >
                                                            <X size={12} />
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
                                                    <div className="flex justify-between font-mono text-[8px] text-muted-soft">
                                                        <span>{item.progress}% UPLOADED</span>
                                                    </div>
                                                </div>
                                            )}

                                            {item.error && (
                                                <p className="font-mono-precision text-[9px] text-warning">
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
                        <h3 className="font-mono-precision text-[11px] tracking-[0.25em] text-muted uppercase">
                            SECURE EVIDENCE ARCHIVE
                        </h3>

                        {evidenceLoading ? (
                            <div className="space-y-4">
                                {[1, 2].map((i) => (
                                    <div key={i} className="h-16 border border-hairline animate-pulse bg-surface-soft" />
                                ))}
                            </div>
                        ) : evidenceError ? (
                            <div className="border border-warning/20 bg-surface-soft p-6 text-center text-warning font-mono-precision text-xs">
                                FAILED TO RETRIEVE EVIDENCE LOGS
                            </div>
                        ) : evidenceList && evidenceList.length > 0 ? (
                            <div className="border border-hairline bg-surface-soft divide-y divide-hairline">
                                {evidenceList.map((e) => (
                                    <div 
                                        key={e.id}
                                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-black/40 transition-colors gap-4"
                                    >
                                        <div className="flex items-start space-x-3 min-w-0">
                                            <FileText size={16} className="text-muted shrink-0 mt-0.5" />
                                            <div className="min-w-0 space-y-1">
                                                <h4 className="font-mono-precision text-[11px] tracking-wide text-white truncate pr-4" title={e.fileName}>
                                                    {e.fileName}
                                                </h4>
                                                <div className="flex space-x-4 font-mono text-[9px] text-muted-soft">
                                                    <span>TYPE: {e.mimeType.toUpperCase()}</span>
                                                    <span>ADDED: {new Date(e.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end space-x-6 shrink-0">
                                            {/* Status logic */}
                                            <div className="flex items-center space-x-2">
                                                {e.status === "COMPLETED" && (
                                                    <span className="flex items-center space-x-1 font-mono-precision text-[9px] text-success tracking-widest">
                                                        <CheckCircle size={10} />
                                                        <span>COMPLETED</span>
                                                    </span>
                                                )}
                                                {e.status === "PROCESSING" && (
                                                    <span className="flex items-center space-x-1 font-mono-precision text-[9px] text-link tracking-widest animate-pulse">
                                                        <Loader2 size={10} className="animate-spin" />
                                                        <span>PROCESSING</span>
                                                    </span>
                                                )}
                                                {e.status === "PENDING" && (
                                                    <span className="flex items-center space-x-1 font-mono-precision text-[9px] text-muted tracking-widest">
                                                        <Clock size={10} />
                                                        <span>IN QUEUE</span>
                                                    </span>
                                                )}
                                                {e.status === "FAILED" && (
                                                    <span className="flex items-center space-x-1 font-mono-precision text-[9px] text-warning tracking-widest">
                                                        <AlertTriangle size={10} />
                                                        <span>FAILED</span>
                                                    </span>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => deleteMutation.mutate(e.id)}
                                                disabled={deleteMutation.isPending && deleteMutation.variables === e.id}
                                                className="text-muted-soft hover:text-white transition-colors p-1 border border-transparent hover:border-hairline hover:bg-black"
                                                title="Delete archive log"
                                            >
                                                {deleteMutation.isPending && deleteMutation.variables === e.id ? (
                                                    <Loader2 size={12} className="animate-spin" />
                                                ) : (
                                                    <Trash2 size={12} />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="border border-dashed border-hairline py-12 flex flex-col items-center justify-center space-y-2 text-center select-none">
                                <p className="font-mono-precision text-[10px] tracking-[0.2em] text-muted uppercase">
                                    NO EVIDENCE INGESTED FOR THIS CASE
                                </p>
                                <p className="text-xs text-muted-soft max-w-sm">
                                    Drop files above to execute ingestion queue pipelines. Ingestion parses documents and indexes content securely.
                                </p>
                            </div>
                        )}
                    </section>
                </main>
            </div>
        </div>
    );
}
