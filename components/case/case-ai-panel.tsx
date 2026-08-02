"use client"

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, ChevronLeft, ChevronRight, Loader2, Square, RotateCcw, Sparkles } from "lucide-react";
import { apiClient } from "@/lib/api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    isStreaming?: boolean;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
    return Math.random().toString(36).slice(2, 10);
}

function formatTime(d: Date) {
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ─── Collapsed state ──────────────────────────────────────────────────────────

function CollapsedPanel({ title, onToggleCollapse }: { title: string; onToggleCollapse: () => void }) {
    return (
        <div className="flex flex-col items-center py-4 w-full h-full bg-black text-center select-none border-l border-zinc-900">
            <button
                onClick={onToggleCollapse}
                title="EXPAND AI PANEL"
                className="p-1.5 text-zinc-600 hover:text-white transition-colors shrink-0 mb-5"
            >
                <ChevronLeft size={14} />
            </button>
            <div className="w-7 h-7 border border-zinc-800 flex items-center justify-center bg-zinc-950 shrink-0">
                <Sparkles size={12} className="text-zinc-500" />
            </div>
            <div className="flex-1 flex items-center justify-center w-full overflow-hidden mt-8">
                <span
                    className="font-mono text-[9px] tracking-[0.3em] text-zinc-600 uppercase whitespace-nowrap"
                    style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                    {title}
                </span>
            </div>
        </div>
    );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
    const isUser = msg.role === "user";
    return (
        <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
            <div className={`flex items-center gap-1.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                {!isUser && (
                    <div className="w-4 h-4 border border-zinc-800 bg-zinc-950 flex items-center justify-center shrink-0">
                        <Sparkles size={8} className="text-zinc-500" />
                    </div>
                )}
                <span className="font-mono text-[9px] text-zinc-600 tracking-widest uppercase">
                    {isUser ? "YOU" : "AI"} · {formatTime(msg.timestamp)}
                </span>
            </div>
            <div
                className={`max-w-[88%] px-3 py-2.5 font-mono text-[11px] leading-relaxed break-words select-text ${
                    isUser
                        ? "bg-zinc-900 border border-zinc-700 text-white ml-6"
                        : "bg-zinc-950 border border-zinc-800 text-zinc-300 mr-6"
                }`}
            >
                {msg.isStreaming && !msg.content ? (
                    <span className="flex items-center gap-1.5 text-zinc-500">
                        <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                ) : (
                    <>
                        {msg.content}
                        {msg.isStreaming && (
                            <span className="inline-block w-[2px] h-[11px] bg-zinc-400 ml-0.5 animate-pulse align-middle" />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CaseAIPanel({
    title,
    suggestions,
    placeholder,
    selectedItemName,
    emptySelectionText = "SELECT A RECORD TO ENABLE CONTEXTUAL ANALYSIS",
    contextType,
    isCollapsed,
    onToggleCollapse,
}: CaseAIPanelProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }, [input]);

    const sendMessage = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || isLoading) return;

        setInput("");

        const userMsg: Message = {
            id: uid(),
            role: "user",
            content: trimmed,
            timestamp: new Date(),
        };

        const assistantId = uid();
        const assistantMsg: Message = {
            id: assistantId,
            role: "assistant",
            content: "",
            timestamp: new Date(),
            isStreaming: true,
        };

        setMessages(prev => [...prev, userMsg, assistantMsg]);
        setIsLoading(true);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            // Build context-aware system prompt payload
            const body = {
                message: trimmed,
                context: {
                    type: contextType,
                    selectedItem: selectedItemName ?? null,
                },
                history: messages.slice(-10).map(m => ({
                    role: m.role,
                    content: m.content,
                })),
            };

            const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
            const token = typeof window !== "undefined" ? localStorage.getItem("bb_token") : null;

            const response = await fetch(`${BASE_URL}/ai/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            if (!response.ok) throw new Error(`${response.status}`);

            const contentType = response.headers.get("content-type") ?? "";

            if (contentType.includes("text/event-stream") || contentType.includes("text/plain")) {
                // Streaming response
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                if (!reader) throw new Error("No reader");

                let accumulated = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });

                    // Handle SSE format (data: ...\n\n) or raw text
                    const lines = chunk.split("\n");
                    for (const line of lines) {
                        const data = line.startsWith("data: ") ? line.slice(6) : line;
                        if (data === "[DONE]" || data === "") continue;
                        try {
                            const parsed = JSON.parse(data);
                            accumulated += parsed.delta ?? parsed.content ?? parsed.text ?? "";
                        } catch {
                            accumulated += data;
                        }
                    }

                    setMessages(prev => prev.map(m =>
                        m.id === assistantId ? { ...m, content: accumulated } : m
                    ));
                }
            } else {
                // JSON response
                const data = await response.json();
                const reply = data.reply ?? data.message ?? data.content ?? data.text ?? JSON.stringify(data);
                setMessages(prev => prev.map(m =>
                    m.id === assistantId ? { ...m, content: reply } : m
                ));
            }
        } catch (err: any) {
            if (err?.name === "AbortError") {
                setMessages(prev => prev.map(m =>
                    m.id === assistantId ? { ...m, content: m.content || "[Stopped]", isStreaming: false } : m
                ));
                setIsLoading(false);
                return;
            }
            // Graceful fallback — show error inline
            setMessages(prev => prev.map(m =>
                m.id === assistantId
                    ? { ...m, content: `[AI endpoint unavailable — ${contextType} context loaded. Connect /ai/chat to enable responses.]` }
                    : m
            ));
        } finally {
            setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, isStreaming: false } : m
            ));
            setIsLoading(false);
            abortRef.current = null;
            textareaRef.current?.focus();
        }
    }, [isLoading, messages, contextType, selectedItemName]);

    const handleStop = () => {
        abortRef.current?.abort();
    };

    const handleClear = () => {
        abortRef.current?.abort();
        setMessages([]);
        setInput("");
        setIsLoading(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    if (isCollapsed) {
        return <CollapsedPanel title={title} onToggleCollapse={onToggleCollapse} />;
    }

    const isEmpty = messages.length === 0;

    return (
        <div className="flex flex-col h-full bg-black text-white w-full overflow-hidden border-l border-zinc-900">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex items-center gap-2.5 px-3 h-[45px] shrink-0 border-b border-zinc-900 bg-zinc-950/60">
                <button
                    onClick={onToggleCollapse}
                    title="Collapse"
                    className="p-1 text-zinc-600 hover:text-white transition-colors shrink-0"
                >
                    <ChevronRight size={13} />
                </button>

                <div className="w-5 h-5 border border-zinc-800 bg-zinc-950 flex items-center justify-center shrink-0">
                    <Sparkles size={10} className="text-zinc-400" />
                </div>

                <span className="font-mono text-[10px] tracking-widest text-zinc-400 uppercase font-bold flex-1 truncate">
                    {title}
                </span>

                <div className="flex items-center gap-1 shrink-0">
                    {/* Context pill */}
                    {selectedItemName && (
                        <span className="font-mono text-[9px] text-zinc-500 border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 truncate max-w-[100px] uppercase leading-none">
                            {selectedItemName}
                        </span>
                    )}

                    {/* Clear button */}
                    {messages.length > 0 && (
                        <button
                            onClick={handleClear}
                            title="Clear conversation"
                            className="p-1 text-zinc-600 hover:text-zinc-400 transition-colors"
                        >
                            <RotateCcw size={11} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Context banner (no selection) ───────────────────────────── */}
            {!selectedItemName && (
                <div className="shrink-0 px-3 py-2 border-b border-zinc-900 bg-zinc-950/40">
                    <p className="font-mono text-[9px] text-zinc-600 tracking-wide uppercase leading-relaxed">
                        {emptySelectionText}
                    </p>
                </div>
            )}

            {/* ── Messages ────────────────────────────────────────────────── */}
            <div
                ref={messagesRef}
                className="flex-1 overflow-y-auto px-3 py-4 space-y-4 scroll-smooth"
            >
                {isEmpty ? (
                    /* Suggestions */
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-5 h-5 border border-zinc-800 bg-zinc-950 flex items-center justify-center shrink-0">
                                <Sparkles size={10} className="text-zinc-500" />
                            </div>
                            <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                                How can I help?
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            {suggestions.map(s => (
                                <button
                                    key={s}
                                    onClick={() => sendMessage(s)}
                                    className="w-full text-left px-3 py-2 border border-zinc-900 hover:border-zinc-700 bg-zinc-950/40 hover:bg-zinc-900/60 text-zinc-400 hover:text-white font-mono text-[10px] uppercase tracking-wide transition-all leading-relaxed"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
                )}
                <div ref={bottomRef} />
            </div>

            {/* ── Input area ──────────────────────────────────────────────── */}
            <div className="shrink-0 border-t border-zinc-900 bg-zinc-950/60 p-3">
                {/* Suggestions row (after first message) */}
                {!isEmpty && !isLoading && (
                    <div className="flex gap-1.5 mb-2.5 overflow-x-auto pb-1 scrollbar-none">
                        {suggestions.slice(0, 3).map(s => (
                            <button
                                key={s}
                                onClick={() => sendMessage(s)}
                                className="shrink-0 px-2 py-1 border border-zinc-900 hover:border-zinc-700 text-zinc-600 hover:text-zinc-300 font-mono text-[9px] uppercase tracking-wide transition-all whitespace-nowrap bg-transparent"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex items-end gap-2">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        rows={1}
                        disabled={isLoading}
                        className="flex-1 resize-none bg-zinc-950 border border-zinc-800 focus:border-zinc-600 text-white placeholder:text-zinc-700 font-mono text-[11px] tracking-wide px-3 py-2 outline-none transition-colors disabled:opacity-40 min-h-[36px] max-h-[120px] leading-relaxed uppercase"
                        style={{ height: "36px" }}
                    />

                    {isLoading ? (
                        <button
                            onClick={handleStop}
                            title="Stop"
                            className="w-9 h-9 shrink-0 border border-zinc-700 hover:border-white bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all flex items-center justify-center"
                        >
                            <Square size={11} />
                        </button>
                    ) : (
                        <button
                            onClick={() => sendMessage(input)}
                            disabled={!input.trim()}
                            title="Send (Enter)"
                            className="w-9 h-9 shrink-0 border border-zinc-800 hover:border-white bg-zinc-950 hover:bg-white text-zinc-400 hover:text-black transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <Send size={11} />
                        </button>
                    )}
                </div>

                <p className="font-mono text-[9px] text-zinc-700 mt-2 tracking-wide uppercase">
                    ENTER to send · SHIFT+ENTER for newline
                </p>
            </div>
        </div>
    );
}
