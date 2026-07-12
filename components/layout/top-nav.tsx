"use client"

import React, { useEffect, useState } from "react";
import { authApi, User } from "@/lib/api/auth";
import { LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";

export default function TopNav() {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        setUser(authApi.getCurrentUser());
    }, []);

    const handleLogout = () => {
        authApi.logout();
    };

    return (
        <header className="h-[56px] border-b border-hairline bg-black/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50 select-none">
            {/* Operator info at left */}
            <div className="flex items-center space-x-2 w-1/3">
                <UserIcon size={12} className="text-muted" />
                <span className="font-mono-precision text-[10px] tracking-[0.15em] text-muted truncate max-w-[200px]">
                    SYS_OP: {user?.name ? user.name.toUpperCase() : "SECURE_AGENT"}
                </span>
            </div>

            {/* Wordmark centered */}
            <div className="w-1/3 flex justify-center">
                <Link href="/dashboard" className="font-display text-[14px] tracking-[0.4em] text-white hover:opacity-80 transition-opacity">
                    BLACKBOX
                </Link>
            </div>

            {/* Logout at right */}
            <div className="w-1/3 flex justify-end">
                <button 
                    onClick={handleLogout}
                    className="flex items-center space-x-1.5 font-mono-precision text-[10px] tracking-[0.15em] text-muted hover:text-white transition-colors bg-transparent border-none"
                >
                    <span className="hidden sm:inline">TERMINATE SESSION</span>
                    <LogOut size={12} />
                </button>
            </div>
        </header>
    );
}
