"use client"

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { authApi } from "@/lib/api/auth";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

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
        <div className="flex flex-col flex-1 min-h-screen bg-black text-white items-center justify-center p-6 select-none">
            {/* Background design accents */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--color-surface-soft),_transparent_70%)] pointer-events-none opacity-40" />

            <div className="w-full max-w-md flex flex-col items-stretch z-10">
                {/* Header Wordmark */}
                <div className="text-center mb-12">
                    <h1 className="font-display text-2xl tracking-[0.4em] text-white">
                        BLACKBOX
                    </h1>
                    <p className="font-mono-precision text-[10px] tracking-[0.3em] text-muted mt-2">
                        INTELLIGENCE OPERATING SYSTEM
                    </p>
                </div>

                <div className="border border-hairline bg-surface-soft p-8">
                    <h2 className="font-display text-lg tracking-[0.2em] mb-8 text-left border-b border-hairline pb-4">
                        SYSTEM LOGIN
                    </h2>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                        {/* Email Field */}
                        <div className="flex flex-col space-y-2">
                            <label className="font-mono-precision text-[11px] tracking-[0.2em] text-muted">
                                EMAIL ADDRESS
                            </label>
                            <input
                                type="email"
                                placeholder="IDENTIFIER@DOMAIN.SYS"
                                {...register("email")}
                                className="w-full bg-transparent border-b border-hairline-strong py-3 px-1 text-white font-serif-body placeholder:text-muted-soft focus:outline-none focus:border-white transition-colors"
                                disabled={isLoading}
                            />
                            {errors.email && (
                                <p className="font-mono-precision text-[10px] tracking-wide text-warning mt-1">
                                    {errors.email.message}
                                </p>
                            )}
                        </div>

                        {/* Password Field */}
                        <div className="flex flex-col space-y-2 relative">
                            <label className="font-mono-precision text-[11px] tracking-[0.2em] text-muted">
                                SECURE PASSCODE
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••••••"
                                    {...register("password")}
                                    className="w-full bg-transparent border-b border-hairline-strong py-3 pr-10 pl-1 text-white font-mono placeholder:text-muted-soft focus:outline-none focus:border-white transition-colors"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-2 top-3 text-muted hover:text-white transition-colors"
                                    disabled={isLoading}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="font-mono-precision text-[10px] tracking-wide text-warning mt-1">
                                    {errors.password.message}
                                </p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full border border-white bg-transparent text-white h-11 rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-colors font-mono-precision text-xs tracking-[0.25em]"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin mr-2" size={14} />
                                    VERIFYING...
                                </>
                            ) : (
                                "INITIALIZE SESSION"
                            )}
                        </button>
                    </form>
                </div>

                {/* Navigation Links */}
                <div className="flex justify-between items-center mt-6 px-1">
                    <Link
                        href="/register"
                        className="font-mono-precision text-[10px] tracking-[0.2em] text-muted hover:text-white transition-colors"
                    >
                        CREATE NEW ID
                    </Link>
                    <span className="font-mono-precision text-[10px] tracking-[0.2em] text-muted-soft">
                        SECURE LOG v1.0
                    </span>
                </div>
            </div>
        </div>
    );
}
