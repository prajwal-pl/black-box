"use client"

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import TopNav from "@/components/layout/top-nav";
import LeftCaseSidebar from "@/components/case/left-case-sidebar";

export default function CaseLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const router = useRouter();
    const caseId = params.id as string;
    const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);

    useEffect(() => {
        if (!localStorage.getItem("bb_token")) router.push("/login");
    }, [router]);

    return (
        <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
            <TopNav />
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Custom Left Case Sidebar */}
                <div className={`transition-all duration-300 ease-in-out shrink-0 h-full ${
                    isLeftCollapsed ? "w-14" : "w-[240px]"
                }`}>
                    <LeftCaseSidebar 
                        caseId={caseId} 
                        isCollapsed={isLeftCollapsed} 
                        onToggleCollapse={() => setIsLeftCollapsed(!isLeftCollapsed)} 
                    />
                </div>

                {/* Main Workspace Content */}
                <main className="flex-1 min-w-0 h-full overflow-hidden bg-black">
                    {children}
                </main>
            </div>
        </div>
    );
}
