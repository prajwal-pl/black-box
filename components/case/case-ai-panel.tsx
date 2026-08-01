"use client"

import React, { useState } from "react";
import { Bot, Send, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Message {
    role: "user" | "ai";
    text: string;
}

interface CaseAIPanelProps {
    title: string;
    suggestions: string[];
    placeholder: string;
    selectedItemName?: string | null;
    emptySelectionText?: string;
    contextType: string;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

export default function CaseAIPanel({
    title,
    suggestions,
    placeholder,
    selectedItemName,
    emptySelectionText = "SELECT A RECORD TO ENABLE CONTEXTUAL ANALYSIS",
    contextType,
    isCollapsed,
    onToggleCollapse
}: CaseAIPanelProps) {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [sending, setSending] = useState(false);

    const handleSend = () => {
        if (!input.trim() || sending) return;
        
        const userMsg = input;
        setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
        setInput("");
        setSending(true);

        // Simulate AI forensic analysis response
        setTimeout(() => {
            setMessages((prev) => [
                ...prev,
                { 
                    role: "ai", 
                    text: `${contextType.toUpperCase()} SYSTEM INTEGRATION PENDING — AGENT FORENSIC PIPELINE ONLINE.` 
                }
            ]);
            setSending(false);
        }, 800);
    };

    if (isCollapsed) {
        return (
            <div className="flex flex-col items-center py-4 w-full h-full bg-zinc-950/40 text-center select-none border-l border-zinc-800">
                {/* Toggle Button */}
                <button
                    onClick={onToggleCollapse}
                    title="EXPAND AI PANEL"
                    className="p-1 text-zinc-500 hover:text-white transition-colors shrink-0 mb-6"
                >
                    <ChevronLeft size={14} />
                </button>
                
                {/* Bot Indicator */}
                <div className="w-7 h-7 rounded-none border border-zinc-800 flex items-center justify-center text-zinc-400 bg-black shrink-0">
                    <Bot size={13} className="animate-pulse" />
                </div>

                {/* Vertical Text Label */}
                <div className="flex-1 flex items-center justify-center w-full overflow-hidden mt-10">
                    <span 
                        className="font-mono text-[9px] tracking-[0.25em] text-zinc-500 font-bold uppercase whitespace-nowrap block"
                        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                    >
                        {title}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-zinc-950/20 text-left w-full overflow-hidden select-none border-l border-zinc-800">
            {/* Header info */}
            <div className="px-4 py-3 flex items-center gap-2.5 shrink-0 border-b border-zinc-800 bg-black/40 h-[45px]">
                {/* Toggle collapse button */}
                <button
                    onClick={onToggleCollapse}
                    title="COLLAPSE AI PANEL"
                    className="p-1 text-zinc-500 hover:text-white transition-colors shrink-0 -ml-1"
                >
                    <ChevronRight size={14} />
                </button>
                <Bot size={13} className="text-zinc-400" />
                <span className="font-mono text-xs tracking-widest text-zinc-400 font-bold uppercase">{title}</span>
                {selectedItemName && (
                    <span className="ml-auto font-mono text-[9px] text-success border border-success/40 bg-success/5 truncate max-w-[120px] uppercase font-bold px-1.5 py-0.5 leading-none">
                        {selectedItemName}
                    </span>
                )}
            </div>

            {/* Selection Warning */}
            {!selectedItemName && (
                <div className="shrink-0 bg-warning/5 border-b border-zinc-900 px-4 py-2.5 select-none">
                    <p className="font-mono text-[9px] text-warning tracking-wide uppercase leading-normal font-semibold">
                        {emptySelectionText}
                    </p>
                </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="space-y-2 select-none">
                        <span className="font-mono text-[9px] tracking-widest text-zinc-500 font-bold block mb-1">
                            SUGGESTED INVESTIGATION PATHS
                        </span>
                        {suggestions.map((suggestion) => (
                            <button
                                key={suggestion}
                                onClick={() => setInput(suggestion)}
                                className="w-full text-left font-mono text-[10px] text-zinc-400 hover:text-white border border-zinc-800 bg-transparent hover:border-zinc-700 px-3.5 py-2 transition-colors uppercase leading-normal"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={msg.role === "user" ? "text-right" : "text-left"}>
                                <span className="font-mono text-[8px] text-zinc-500 tracking-wider uppercase font-bold block mb-1">
                                    {msg.role === "user" ? "OPERATOR" : "AI ENCLAVE"}
                                </span>
                                <p className={`font-mono text-[11px] leading-relaxed p-3 border ${
                                    msg.role === "user"
                                        ? "border-zinc-800 text-white bg-zinc-900/60"
                                        : "border-zinc-900 text-zinc-300 bg-zinc-950/20"
                                } uppercase select-text break-words`}>
                                    {msg.text}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Input Bar */}
            <div className="p-4 border-t border-zinc-900 bg-black/40 shrink-0 flex gap-2">
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="ENTER QUERY STATEMENT..."
                    className="font-mono text-[11px] tracking-wider bg-black border-zinc-800 focus:border-zinc-500 text-white h-9 rounded-none uppercase"
                    disabled={sending}
                />
                <Button 
                    variant="outline" 
                    onClick={handleSend}
                    className="h-9 w-9 shrink-0 p-0 border-zinc-800 hover:bg-white hover:text-black rounded-none"
                    disabled={sending || !input.trim()}
                >
                    {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                </Button>
            </div>
        </div>
    );
}
