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
    const [leftWidth, setLeftWidth] = useState(240);
    const [isResizingLeft, setIsResizingLeft] = useState(false);

    useEffect(() => {
        if (!localStorage.getItem("bb_token")) router.push("/login");
    }, [router]);

    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizingLeft(true);
    };

    useEffect(() => {
        if (!isResizingLeft) return;

        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(180, Math.min(380, e.clientX));
            setLeftWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizingLeft(false);
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isResizingLeft]);

    return (
        <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
            <TopNav />
            <div className={`flex flex-1 min-h-0 overflow-hidden ${isResizingLeft ? "select-none cursor-col-resize" : ""}`}>
                {/* Custom Left Case Sidebar */}
                <div 
                    style={{ width: isLeftCollapsed ? 56 : leftWidth }}
                    className="shrink-0 h-full overflow-hidden"
                >
                    <LeftCaseSidebar 
                        caseId={caseId} 
                        isCollapsed={isLeftCollapsed} 
                        onToggleCollapse={() => setIsLeftCollapsed(!isLeftCollapsed)} 
                    />
                </div>

                {/* Resize Handle */}
                {!isLeftCollapsed && (
                    <div 
                        onMouseDown={startResizing}
                        className={`w-[3px] hover:w-[5px] cursor-col-resize bg-zinc-900 hover:bg-zinc-700 transition-all shrink-0 select-none ${
                            isResizingLeft ? "bg-zinc-500 w-[5px]" : ""
                        }`}
                    />
                )}
                {isLeftCollapsed && (
                    <div className="w-[1px] bg-zinc-900 shrink-0" />
                )}

                {/* Main Workspace Content */}
                <main className="flex-1 min-w-0 h-full overflow-hidden bg-black">
                    {children}
                </main>
            </div>
        </div>
    );
}
