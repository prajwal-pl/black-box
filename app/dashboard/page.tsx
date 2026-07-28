"use client"

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { casesApi, Case } from "@/lib/api/cases";
import TopNav from "@/components/layout/top-nav";
import { Plus, X, FolderOpen, ArrowRight, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";

const createCaseSchema = zod.object({
    name: zod.string().min(3, "Case name must be at least 3 characters"),
});

type CreateCaseFormValues = zod.infer<typeof createCaseSchema>;

export default function DashboardPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Redirect to login if token is missing
    useEffect(() => {
        const token = localStorage.getItem("bb_token");
        if (!token) {
            router.push("/login");
        }
    }, [router]);

    // Fetch Cases
    const { data: cases, isLoading, error } = useQuery<Case[]>({
        queryKey: ["cases"],
        queryFn: casesApi.getAll,
    });

    // Create Case Mutation
    const createMutation = useMutation({
        mutationFn: casesApi.create,
        onSuccess: (newCase) => {
            queryClient.invalidateQueries({ queryKey: ["cases"] });
            toast.success("CASE FILE CREATED");
            setIsCreateOpen(false);
            reset();
            // Automatically navigate to case workspace
            router.push(`/cases/${newCase.id}`);
        },
        onError: (err: any) => {
            toast.error(err?.message || "FAILED TO CREATE CASE");
        }
    });

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<CreateCaseFormValues>({
        resolver: zodResolver(createCaseSchema),
        defaultValues: {
            name: "",
        }
    });

    const onSubmit = (values: CreateCaseFormValues) => {
        createMutation.mutate(values);
    };

    return (
        <div className="flex flex-col min-h-screen bg-black text-white font-sans-body">
            <TopNav />

            {/* Main Content Area */}
            <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-[64px] flex flex-col items-stretch z-10 relative">
                {/* Heading / Action Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-hairline pb-8 mb-12 space-y-6 md:space-y-0">
                    <div className="space-y-2">
                        <span className="font-mono-precision text-[11px] tracking-[0.25em] text-muted">
                            SYSTEM ARCHIVE
                        </span>
                        <h1 className="font-display text-[32px] md:text-[48px] tracking-[0.05em] leading-tight text-white uppercase">
                            INVESTIGATION INDEX
                        </h1>
                    </div>

                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="border border-white bg-transparent text-white px-8 py-3 rounded-full hover:bg-white hover:text-black transition-colors font-mono-precision text-xs tracking-[0.25em] flex items-center justify-center space-x-2 self-start md:self-auto"
                    >
                        <Plus size={14} />
                        <span>RECORD NEW CASE</span>
                    </button>
                </div>

                {/* Case files listing */}
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-[90px] border border-hairline bg-surface-soft animate-pulse flex items-center justify-between px-6">
                                <div className="space-y-2 w-1/3">
                                    <div className="h-4 bg-hairline-strong w-2/3" />
                                    <div className="h-3 bg-hairline-strong w-1/3" />
                                </div>
                                <div className="h-3 bg-hairline-strong w-24" />
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="border border-warning/20 bg-surface-soft p-6 text-center">
                        <p className="font-mono-precision text-sm tracking-wide text-warning mb-4">
                            ERROR RETRIEVING ARCHIVED LOGS: {error instanceof Error ? error.message : "NETWORK_FAILURE"}
                        </p>
                        <button 
                            onClick={() => queryClient.invalidateQueries({ queryKey: ["cases"] })}
                            className="border border-white px-6 py-2 rounded-full font-mono-precision text-xs tracking-[0.2em] hover:bg-white hover:text-black transition-colors"
                        >
                            RE-ESTABLISH CONNECTION
                        </button>
                    </div>
                ) : cases && cases.length > 0 ? (
                    <div className="space-y-0 border-t border-hairline">
                        {cases.map((c) => (
                            <div
                                key={c.id}
                                onClick={() => router.push(`/cases/${c.id}`)}
                                className="group flex flex-col md:flex-row md:items-center justify-between py-6 border-b border-hairline hover:bg-surface-soft cursor-pointer transition-colors duration-150 px-4 -mx-4"
                            >
                                <div className="space-y-2 pr-4 mb-4 md:mb-0">
                                    <h3 className="font-display text-lg tracking-[0.1em] text-white group-hover:text-link transition-colors uppercase">
                                        {c.name}
                                    </h3>
                                    <div className="flex items-center space-x-4">
                                        <div className="flex items-center space-x-1.5 text-muted-soft">
                                            <Calendar size={11} />
                                            <span className="font-mono-precision text-[9px] tracking-wider">
                                                RECORDED: {new Date(c.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="font-mono-precision text-[9px] tracking-wider text-muted-soft">
                                            CASE_ID: {c.id.slice(0, 8).toUpperCase()}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-6 justify-between md:justify-end">
                                    <div className="flex space-x-4">
                                        <span className={`font-mono-precision text-[10px] tracking-[0.2em] px-3 py-1 border ${
                                            c.severity === "CRITICAL" ? "border-warning text-warning" : "border-hairline-strong text-muted"
                                        }`}>
                                            SEV_{c.severity}
                                        </span>
                                        <span className="font-mono-precision text-[10px] tracking-[0.2em] px-3 py-1 border border-hairline-strong text-muted">
                                            {c.status}
                                        </span>
                                    </div>
                                    <ArrowRight size={16} className="text-muted group-hover:text-white transition-colors group-hover:translate-x-1 transform duration-150" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="border border-dashed border-hairline py-16 flex flex-col items-center justify-center space-y-4">
                        <FolderOpen size={36} className="text-muted-soft" />
                        <p className="font-mono-precision text-xs tracking-[0.2em] text-muted uppercase">
                            NO CASE FILES RECORDED IN ARCHIVE
                        </p>
                        <p className="text-sm text-muted-soft max-w-sm text-center">
                            Record a new case to initialize investigation workflows, upload evidence logs, and query graph models.
                        </p>
                    </div>
                )}
            </main>

            {/* Create Case Slide-Over Modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
                        onClick={() => setIsCreateOpen(false)}
                    />
                    <div className="w-full max-w-md bg-surface-soft border-l border-hairline z-10 flex flex-col items-stretch h-full p-8 animate-in slide-in-from-right duration-200">
                        <div className="flex justify-between items-center border-b border-hairline pb-4 mb-8">
                            <h2 className="font-display text-lg tracking-[0.15em] uppercase text-white">
                                CREATE CASE FILE
                            </h2>
                            <button
                                onClick={() => setIsCreateOpen(false)}
                                className="text-muted hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 flex-1 flex flex-col justify-between">
                            <div className="space-y-6">
                                <div className="flex flex-col space-y-2">
                                    <label className="font-mono-precision text-[11px] tracking-[0.2em] text-muted">
                                        CASE IDENTIFIER / NAME
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="E.G. OPERATION BUGATTI"
                                        {...register("name")}
                                        className="w-full bg-transparent border-b border-hairline-strong py-3 px-1 text-white font-sans-body placeholder:text-muted-soft focus:outline-none focus:border-white transition-colors uppercase"
                                        disabled={isSubmitting}
                                        autoFocus
                                    />
                                    {errors.name && (
                                        <p className="font-mono-precision text-[10px] tracking-wide text-warning mt-1">
                                            {errors.name.message}
                                        </p>
                                    )}
                                </div>

                                <p className="text-xs text-muted-soft leading-relaxed">
                                    Creating a new case allocates isolated storage partitions for evidence files, initializes vector index pipelines, and prepares reasoning graphs.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full border border-white bg-transparent text-white h-11 rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-colors font-mono-precision text-xs tracking-[0.25em]"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="animate-spin mr-2" size={14} />
                                            RECORDING...
                                        </>
                                    ) : (
                                        "GENERATE RECORD"
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsCreateOpen(false)}
                                    className="w-full bg-transparent text-muted hover:text-white transition-colors font-mono-precision text-xs tracking-[0.25em] py-2"
                                    disabled={isSubmitting}
                                >
                                    CANCEL
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
