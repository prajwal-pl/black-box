"use client"

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { authApi } from "@/lib/api/auth";
import { Eye, EyeOff, Loader2, Lock, Terminal } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { DecryptText } from "@/components/landing/decrypt-text";

const loginSchema = zod.object({
    email: zod.string().email("Enter a valid email address"),
    password: zod.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = zod.infer<typeof loginSchema>;

export default function LoginPage() {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Redirect if already logged in
    useEffect(() => {
        const token = localStorage.getItem("bb_token");
        if (token) {
            router.push("/dashboard");
        }
    }, [router]);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        }
    });

    const onSubmit = async (values: LoginFormValues) => {
        setIsLoading(true);
        try {
            const res = await authApi.login(values);
            localStorage.setItem("bb_token", res.token);
            localStorage.setItem("bb_user", JSON.stringify(res.user));
            toast.success("ACCESS GRANTED");
            router.push("/dashboard");
        } catch (error: any) {
            toast.error(error?.message || "AUTHENTICATION FAILED");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col flex-1 min-h-screen bg-black text-white items-center justify-center p-6 relative select-none">
            <div className="w-full max-w-md flex flex-col items-stretch z-10 relative">
                {/* Header Wordmark */}
                <div className="text-center mb-10 select-none">
                    <h1 className="font-display text-4xl tracking-[0.4em] text-white uppercase">
                        BLACKBOX
                    </h1>
                    <div className="font-mono text-xs tracking-[0.25em] text-zinc-400 mt-2 uppercase">
                        <DecryptText text="INTELLIGENCE OPERATING SYSTEM" duration={1000} />
                    </div>
                </div>

                {/* Form Container */}
                <div className="border border-hairline bg-zinc-950/40 p-8 relative">
                    {/* Security corner brackets */}
                    <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t border-l border-white/50" />
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t border-r border-white/50" />
                    <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b border-l border-white/50" />
                    <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b border-r border-white/50" />

                    <div className="flex justify-between items-center border-b border-hairline pb-4 mb-8 font-mono text-xs text-zinc-400 tracking-wider">
                        <span className="flex items-center space-x-1.5 uppercase font-semibold">
                            <Lock size={12} className="text-warning animate-pulse" />
                            <span>ACCESS GATEWAY</span>
                        </span>
                        <span>IP: [ESTIMATED]</span>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                        {/* Email Field */}
                        <div className="flex flex-col space-y-2">
                            <label className="font-mono text-xs tracking-wider text-zinc-300 uppercase">
                                EMAIL ADDRESS
                            </label>
                            <input
                                type="email"
                                placeholder="IDENTIFIER@DOMAIN.SYS"
                                {...register("email")}
                                className="w-full bg-transparent border-b border-hairline-strong py-2.5 px-1 text-white font-sans text-sm placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
                                disabled={isLoading}
                            />
                            {errors.email && (
                                <p className="font-mono text-xs text-warning mt-1">
                                    <DecryptText text={errors.email.message || ""} duration={500} />
                                </p>
                            )}
                        </div>

                        {/* Password Field */}
                        <div className="flex flex-col space-y-2 relative">
                            <label className="font-mono text-xs tracking-wider text-zinc-300 uppercase">
                                SECURE PASSCODE
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••••••"
                                    {...register("password")}
                                    className="w-full bg-transparent border-b border-hairline-strong py-2.5 pr-10 pl-1 text-white font-mono text-sm placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-2 top-2.5 text-zinc-400 hover:text-white transition-colors"
                                    disabled={isLoading}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="font-mono text-xs text-warning mt-1">
                                    <DecryptText text={errors.password.message || ""} duration={500} />
                                </p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <div className="relative group cursor-pointer">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-transparent hover:bg-white text-white hover:text-black border border-white h-12 flex items-center justify-center transition-all duration-300 font-mono text-xs tracking-wider font-semibold rounded-none uppercase"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="animate-spin mr-2" size={14} />
                                        <span>VERIFYING CREDENTIALS...</span>
                                    </>
                                ) : (
                                    "ESTABLISH CONNECTION"
                                )}
                            </button>
                            <div className="absolute -top-1 -left-1 w-1.5 h-1.5 border-t border-l border-white/40" />
                            <div className="absolute -top-1 -right-1 w-1.5 h-1.5 border-t border-r border-white/40" />
                            <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 border-b border-l border-white/40" />
                            <div className="absolute -bottom-1 -right-1 w-1.5 h-1.5 border-b border-r border-white/40" />
                        </div>
                    </form>
                </div>

                {/* Navigation Links */}
                <div className="flex justify-between items-center mt-6 px-1 font-mono text-xs tracking-wider text-zinc-400">
                    <Link
                        href="/register"
                        className="text-zinc-400 hover:text-white transition-colors uppercase font-medium"
                    >
                        [INITIALIZE NEW ID]
                    </Link>
                    <span className="flex items-center space-x-1.5">
                        <Terminal size={12} />
                        <span>SECURE PORT v1.2</span>
                    </span>
                </div>
            </div>
        </div>
    );
}
