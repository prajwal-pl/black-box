"use client"

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { casesApi, Case } from "@/lib/api/cases";
import TopNav from "@/components/layout/top-nav";
import { Plus, X, FolderOpen, ArrowRight, Loader2, Calendar, Shield, Cpu, Activity, Terminal } from "lucide-react";
import { toast } from "sonner";
import { DecryptText } from "@/components/landing/decrypt-text";

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
        <div className="flex flex-col min-h-screen bg-black text-white font-sans relative select-none">
            <TopNav />

            {/* Main Content Area */}
            <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-12 flex flex-col items-stretch z-10 relative space-y-12">
                
                {/* Heading / Action Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-hairline pb-8 space-y-6 md:space-y-0">
                    <div className="space-y-2 text-left">
                        <span className="font-mono text-xs tracking-wider text-zinc-400 uppercase">
                            SYSTEM ARCHIVE // CASES INDEX
                        </span>
                        <h1 className="font-display text-4xl md:text-5xl tracking-wide text-white uppercase">
                            INVESTIGATION INDEX
                        </h1>
                    </div>

                    <div className="relative group cursor-pointer" onClick={() => setIsCreateOpen(true)}>
                        <button
                            className="bg-transparent hover:bg-white text-white hover:text-black border border-white font-mono text-xs tracking-wider font-semibold py-3.5 px-8 transition-all duration-300 rounded-none uppercase flex items-center space-x-2"
                        >
                            <Plus size={14} />
                            <span>RECORD NEW CASE</span>
                        </button>
                        <div className="absolute -top-1 -left-1 w-1.5 h-1.5 border-t border-l border-white/50" />
                        <div className="absolute -top-1 -right-1 w-1.5 h-1.5 border-t border-r border-white/50" />
                        <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 border-b border-l border-white/50" />
                        <div className="absolute -bottom-1 -right-1 w-1.5 h-1.5 border-b border-r border-white/50" />
                    </div>
                </div>

                {/* Dashboard Stats Block */}
                <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {[
                        { label: "SECURE ENCLAVES", val: "ACTIVE // LOCAL", icon: Shield, detail: "FIPS 140-2 LEVEL 4" },
                        { label: "INDEX COUNT", val: cases ? `${cases.length} SEGMENTS` : "0 SEGMENTS", icon: Cpu, detail: "PARTITION ALLOCATION OK" },
                        { label: "TUNNEL MATRIX", val: "CORE_LINK: UP", icon: Activity, detail: "LATENCY: 0.12ms" }
                    ].map((stat, idx) => {
                        const Icon = stat.icon;
                        return (
                            <div key={idx} className="border border-hairline bg-zinc-950/20 p-6 space-y-4 relative text-left">
                                <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 border-t border-l border-white/30" />
                                <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 border-t border-r border-white/30" />
                                <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 border-b border-l border-white/30" />
                                <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 border-b border-r border-white/30" />
                                
                                <div className="flex justify-between items-center font-mono text-xs tracking-wider text-zinc-400">
                                    <span>{stat.label}</span>
                                    <Icon size={12} className="text-zinc-400" />
                                </div>
                                <div className="font-mono text-xl text-white font-bold tracking-wide">{stat.val}</div>
                                <div className="h-[1px] bg-hairline-strong w-full" />
                                <div className="font-mono text-xs text-zinc-400">{stat.detail}</div>
                            </div>
                        );
                    })}
                </section>

                {/* Case files listing */}
                <section className="space-y-4">
                    <div className="font-mono text-xs text-zinc-400 tracking-wider uppercase flex items-center space-x-1.5">
                        <Terminal size={12} />
                        <span>ACTIVE INTELLIGENCE LEDGER</span>
                    </div>

                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-20 border border-hairline bg-zinc-950/20 animate-pulse" />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="border border-warning/20 bg-zinc-950/40 p-6 text-center">
                            <p className="font-mono text-xs tracking-widest text-warning mb-4 uppercase">
                                ERROR RETRIEVING ARCHIVED LOGS: {error instanceof Error ? error.message : "NETWORK_FAILURE"}
                            </p>
                            <button 
                                onClick={() => queryClient.invalidateQueries({ queryKey: ["cases"] })}
                                className="border border-white px-6 py-2.5 rounded-none font-mono text-xs tracking-wider hover:bg-white hover:text-black transition-colors"
                            >
                                RE-ESTABLISH CONNECTION
                            </button>
                        </div>
                    ) : cases && cases.length > 0 ? (
                        <div className="border border-hairline bg-zinc-950/20 divide-y divide-hairline">
                            {cases.map((c) => (
                                <div
                                    key={c.id}
                                    onClick={() => router.push(`/cases/${c.id}`)}
                                    className="group flex flex-col md:flex-row md:items-center justify-between p-6 hover:bg-zinc-950/60 cursor-pointer transition-colors duration-300"
                                >
                                    <div className="space-y-3 pr-4 mb-4 md:mb-0 text-left">
                                        <h3 className="font-mono text-base tracking-wide text-white font-bold group-hover:text-success transition-colors uppercase">
                                            {c.name}
                                        </h3>
                                        <div className="flex items-center space-x-6 text-zinc-400 font-mono text-xs">
                                            <span className="flex items-center space-x-1.5">
                                                <Calendar size={12} />
                                                <span>EST: {new Date(c.createdAt).toLocaleDateString()}</span>
                                            </span>
                                            <span>CASE_HASH: {c.id.slice(0, 8).toUpperCase()}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-6 justify-between md:justify-end shrink-0">
                                        <div className="flex space-x-3 font-mono text-xs tracking-wider">
                                            <span className={`px-3 py-1.5 border font-semibold ${
                                                c.severity === "CRITICAL" ? "border-warning text-warning" : "border-hairline-strong text-zinc-400"
                                            }`}>
                                                SEV_{c.severity}
                                            </span>
                                            <span className="px-3 py-1.5 border border-hairline-strong text-zinc-400 uppercase font-semibold">
                                                {c.status}
                                            </span>
                                        </div>
                                        <ArrowRight size={16} className="text-zinc-400 group-hover:text-white transition-colors group-hover:translate-x-1.5 transform duration-300" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="border border-dashed border-hairline py-16 flex flex-col items-center justify-center space-y-4">
                            <FolderOpen size={36} className="text-zinc-500" />
                            <p className="font-mono text-xs tracking-wider text-zinc-400 uppercase">
                                NO CASE FILES RECORDED IN ARCHIVE
                            </p>
                            <p className="text-xs text-zinc-400 max-w-sm text-center leading-relaxed">
                                Record a new case to allocate isolated partition enclaves, index evidence feeds, and query reasoning paths.
                            </p>
                        </div>
                    )}
                </section>
            </main>

            {/* Create Case Slide-Over Modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-[999] flex justify-end">
                    <div 
                        className="absolute inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300"
                        onClick={() => setIsCreateOpen(false)}
                    />
                    <div className="w-full max-w-md bg-[#050505] border-l border-hairline z-10 flex flex-col items-stretch h-full p-8 animate-in slide-in-from-right duration-300 relative select-none">
                        
                        <div className="absolute top-2 left-2 text-[7px] font-mono text-muted-soft">DRAWER // ALLOCATOR</div>
                        <div className="absolute bottom-2 right-2 text-[7px] font-mono text-muted-soft">SYS: PORT_LOCK</div>

                        <div className="flex justify-between items-center border-b border-hairline pb-4 mb-8">
                            <h2 className="font-display text-sm tracking-[0.2em] uppercase text-white">
                                CREATE CASE FILE
                            </h2>
                            <button
                                onClick={() => setIsCreateOpen(false)}
                                className="text-muted hover:text-white transition-colors p-1"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 flex-1 flex flex-col justify-between">
                            <div className="space-y-6">
                                <div className="flex flex-col space-y-2 text-left">
                                    <label className="font-mono text-xs tracking-wider text-zinc-300 uppercase">
                                        CASE IDENTIFIER / NAME
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="E.G. OPERATION OMEGA"
                                        {...register("name")}
                                        className="w-full bg-transparent border-b border-hairline-strong py-3 px-1 text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors uppercase text-sm"
                                        disabled={isSubmitting}
                                        autoFocus
                                    />
                                    {errors.name && (
                                        <p className="font-mono text-xs text-warning mt-1">
                                            {errors.name.message}
                                        </p>
                                    )}
                                </div>

                                <p className="text-xs text-zinc-400 leading-relaxed text-left">
                                    Generating a new record generates isolated partition enclaves, launches telemetry parsing listeners, and maps high-dimensional vector graphs.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="relative group cursor-pointer">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full bg-transparent hover:bg-white text-white hover:text-black border border-white h-12 flex items-center justify-center transition-all duration-300 font-mono text-xs tracking-wider font-semibold rounded-none uppercase"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="animate-spin mr-2" size={14} />
                                                <span>CREATING RECORD...</span>
                                            </>
                                        ) : (
                                            "GENERATE RECORD"
                                        )}
                                    </button>
                                    <div className="absolute -top-1 -left-1 w-1.5 h-1.5 border-t border-l border-white/40" />
                                    <div className="absolute -top-1 -right-1 w-1.5 h-1.5 border-t border-r border-white/40" />
                                    <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 border-b border-l border-white/40" />
                                    <div className="absolute -bottom-1 -right-1 w-1.5 h-1.5 border-b border-r border-white/40" />
                                </div>
                                
                                <button
                                    type="button"
                                    onClick={() => setIsCreateOpen(false)}
                                    className="w-full bg-transparent text-zinc-400 hover:text-white transition-colors font-mono text-xs tracking-wider py-2 uppercase"
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
