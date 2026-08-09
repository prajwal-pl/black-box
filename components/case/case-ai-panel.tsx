"use client"

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, ChevronLeft, ChevronRight, Square, Sparkles, Plus, Trash2, MessageSquare } from "lucide-react";
import { useAIConversations, type AIMessage } from "@/hooks/use-ai-conversations";

// ─── Local alias so the rest of the file reads the same as before ─────────────
type Message = AIMessage;

// ─── Props ────────────────────────────────────────────────────────────────────

interface CaseAIPanelProps {
    title: string;
    suggestions: string[];
    placeholder: string;
    selectedItemName?: string | null;
    selectedEdge?: { from: string; to: string; type: string; confidence: number; fromName?: string; toName?: string } | null;
    emptySelectionText?: string;
    contextType: string;
    caseId?: string;
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

// ─── Collapsed panel ──────────────────────────────────────────────────────────

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

// ─── Inline markdown renderer ─────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let last = 0;
    let match;
    let i = 0;
    while ((match = re.exec(text)) !== null) {
        if (match.index > last) {
            parts.push(<span key={`t${i}`}>{text.slice(last, match.index)}</span>);
            i++;
        }
        const raw = match[0];
        if (raw.startsWith("**")) {
            parts.push(<strong key={`b${i}`} className="text-white font-bold">{raw.slice(2, -2)}</strong>);
        } else if (raw.startsWith("`")) {
            parts.push(
                <code key={`c${i}`} className="bg-zinc-800 text-cyan-300 px-1 py-0.5 text-[10px] rounded-none border border-zinc-700">
                    {raw.slice(1, -1)}
                </code>
            );
        } else if (raw.startsWith("*")) {
            parts.push(<em key={`e${i}`} className="text-zinc-200 not-italic border-b border-zinc-600">{raw.slice(1, -1)}</em>);
        }
        last = re.lastIndex;
        i++;
    }
    if (last < text.length) parts.push(<span key={`t${i}`}>{text.slice(last)}</span>);
    return <>{parts}</>;
}

function MarkdownContent({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
    const lines = text.split("\n");
    const nodes: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i].trimEnd();

        // Fenced code block
        if (line.startsWith("```")) {
            const lang = line.slice(3).trim();
            const codeLines: string[] = [];
            i++;
            while (i < lines.length && !lines[i].startsWith("```")) {
                codeLines.push(lines[i]);
                i++;
            }
            nodes.push(
                <div key={i} className="my-2">
                    {lang && (
                        <div className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 border-b-0 text-[8px] text-zinc-500 uppercase tracking-widest">
                            {lang}
                        </div>
                    )}
                    <pre className="bg-zinc-900 border border-zinc-700 px-3 py-2 overflow-x-auto text-[10px] text-cyan-200 leading-relaxed">
                        <code>{codeLines.join("\n")}</code>
                    </pre>
                </div>
            );
            i++;
            continue;
        }

        // Horizontal rule
        if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
            nodes.push(<div key={i} className="my-3 border-t border-zinc-700" />);
            i++;
            continue;
        }

        // Headings
        const h1 = line.match(/^#\s+(.+)/);
        const h2 = line.match(/^##\s+(.+)/);
        const h3 = line.match(/^###\s+(.+)/);
        if (h1) {
            nodes.push(
                <div key={i} className="mt-3 mb-1.5 pt-2 border-t border-zinc-700">
                    <span className="text-[11px] font-bold text-white uppercase tracking-widest">{renderInline(h1[1])}</span>
                </div>
            );
            i++; continue;
        }
        if (h2) {
            nodes.push(
                <div key={i} className="mt-2.5 mb-1">
                    <span className="text-[10px] font-bold text-zinc-200 uppercase tracking-wider">{renderInline(h2[1])}</span>
                </div>
            );
            i++; continue;
        }
        if (h3) {
            nodes.push(
                <div key={i} className="mt-2 mb-0.5">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">› {renderInline(h3[1])}</span>
                </div>
            );
            i++; continue;
        }

        // Bullet list
        if (/^(\s*[-*+]\s)/.test(line)) {
            const items: React.ReactNode[] = [];
            while (i < lines.length && /^(\s*[-*+]\s)/.test(lines[i])) {
                const itemText = lines[i].replace(/^\s*[-*+]\s/, "");
                items.push(
                    <li key={i} className="flex items-start gap-1.5 py-0.5">
                        <span className="text-zinc-600 shrink-0 mt-[1px]">▸</span>
                        <span>{renderInline(itemText)}</span>
                    </li>
                );
                i++;
            }
            nodes.push(<ul key={`ul${i}`} className="my-1 space-y-0">{items}</ul>);
            continue;
        }

        // Numbered list
        if (/^\d+\.\s/.test(line)) {
            const items: React.ReactNode[] = [];
            let n = 1;
            while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
                const itemText = lines[i].replace(/^\d+\.\s/, "");
                items.push(
                    <li key={i} className="flex items-start gap-1.5 py-0.5">
                        <span className="text-zinc-500 shrink-0 tabular-nums w-4 text-right">{n}.</span>
                        <span>{renderInline(itemText)}</span>
                    </li>
                );
                i++; n++;
            }
            nodes.push(<ol key={`ol${i}`} className="my-1 space-y-0">{items}</ol>);
            continue;
        }

        // Empty line
        if (line.trim() === "") {
            nodes.push(<div key={i} className="h-2" />);
            i++;
            continue;
        }

        // Normal paragraph
        nodes.push(
            <p key={i} className="leading-relaxed">
                {renderInline(line)}
            </p>
        );
        i++;
    }

    return (
        <div className="text-[11px] font-mono text-zinc-300 space-y-0">
            {nodes}
            {isStreaming && (
                <span className="inline-block w-[2px] h-[11px] bg-zinc-400 ml-0.5 animate-pulse align-middle" />
            )}
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
                className={`max-w-[88%] px-3 py-2.5 break-words select-text ${
                    isUser
                        ? "bg-zinc-900 border border-zinc-700 text-white ml-6 font-mono text-[11px] leading-relaxed"
                        : "bg-zinc-950 border border-zinc-800 text-zinc-300 mr-6"
                }`}
            >
                {msg.isStreaming && !msg.content ? (
                    <span className="flex items-center gap-1.5 text-zinc-500">
                        <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                ) : isUser ? (
                    <span className="font-mono text-[11px] leading-relaxed">{msg.content}</span>
                ) : (
                    <MarkdownContent text={msg.content} isStreaming={msg.isStreaming} />
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
    selectedEdge,
    emptySelectionText = "SELECT A RECORD TO ENABLE CONTEXTUAL ANALYSIS",
    contextType,
    caseId,
    isCollapsed,
    onToggleCollapse,
}: CaseAIPanelProps) {
    // ── Persistent conversation store ──────────────────────────────────────────
    const convKey = `${caseId ?? "global"}:${contextType}`;
    const {
        conversations,
        activeConvIndex,
        messages,
        setMessages,
        newConversation,
        deleteConversation,
        switchConversation,
        switchToPrev,
        switchToNext,
    } = useAIConversations(convKey);

    // ── Local UI state ─────────────────────────────────────────────────────────
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showConvList, setShowConvList] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom when messages change
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

    // Reset loading state when switching conversations
    useEffect(() => {
        abortRef.current?.abort();
        setIsLoading(false);
        setInput("");
    }, [activeConvIndex]);

    // ── Send message ───────────────────────────────────────────────────────────

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
            const body = {
                message: trimmed,
                context: { 
                    type: contextType, 
                    selectedItem: selectedItemName ?? null,
                    selectedEdge: selectedEdge ?? null
                },
                history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
            };

            const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
            const token = typeof window !== "undefined" ? localStorage.getItem("bb_token") : null;
            const chatUrl = caseId ? `${BASE_URL}/ai/chat/${caseId}` : `${BASE_URL}/ai/chat`;

            const response = await fetch(chatUrl, {
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
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                if (!reader) throw new Error("No reader");

                let accumulated = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    for (const line of chunk.split("\n")) {
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
    }, [isLoading, messages, contextType, selectedItemName, selectedEdge, caseId, setMessages]);

    // ── Handlers ───────────────────────────────────────────────────────────────

    const handleStop = () => { abortRef.current?.abort(); };

    const handleNewConversation = () => {
        abortRef.current?.abort();
        setIsLoading(false);
        setInput("");
        newConversation();
    };

    const handleDeleteConversation = () => {
        abortRef.current?.abort();
        setIsLoading(false);
        setInput("");
        deleteConversation();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    // ── Collapsed view ─────────────────────────────────────────────────────────

    if (isCollapsed) {
        return <CollapsedPanel title={title} onToggleCollapse={onToggleCollapse} />;
    }

    const isEmpty = messages.length === 0;
    const totalConvs = conversations.length;
    const hasMultiple = totalConvs > 1;
    const activeLabel = conversations[activeConvIndex]?.label ?? "New conversation";

    return (
        <div className="flex flex-col h-full bg-black text-white w-full overflow-hidden border-l border-zinc-900">

            {/* ── Header ────────────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 px-3 h-[45px] shrink-0 border-b border-zinc-900 bg-zinc-950/60">
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

                <div className="flex items-center gap-0.5 shrink-0">
                    {/* Context pill */}
                    {selectedEdge ? (
                        <span className="font-mono text-[9px] text-zinc-500 border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 truncate max-w-[120px] uppercase leading-none mr-1">
                            {selectedEdge.fromName ?? selectedEdge.from} → {selectedEdge.toName ?? selectedEdge.to} ({selectedEdge.type})
                        </span>
                    ) : selectedItemName && (
                        <span className="font-mono text-[9px] text-zinc-500 border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 truncate max-w-[72px] uppercase leading-none mr-1">
                            {selectedItemName}
                        </span>
                    )}

                    {/* New conversation */}
                    <button
                        onClick={handleNewConversation}
                        title="New conversation"
                        className="p-1 text-zinc-600 hover:text-white transition-colors"
                    >
                        <Plus size={11} />
                    </button>

                    {/* Delete conversation */}
                    <button
                        onClick={handleDeleteConversation}
                        title="Delete this conversation"
                        className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                    >
                        <Trash2 size={11} />
                    </button>
                </div>
            </div>

            {/* ── Conversation nav bar ───────────────────────────────────────── */}
            <div className="flex items-center gap-1 px-3 h-[30px] shrink-0 border-b border-zinc-900 bg-black">
                {/* Prev */}
                <button
                    onClick={switchToPrev}
                    disabled={!hasMultiple || activeConvIndex === 0}
                    title="Previous conversation"
                    className="p-0.5 text-zinc-700 hover:text-zinc-400 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                >
                    <ChevronLeft size={10} />
                </button>

                {/* Label + counter — click to toggle list */}
                <button
                    onClick={() => setShowConvList(v => !v)}
                    className="flex items-center gap-1 flex-1 min-w-0 group"
                    title="Show all conversations"
                >
                    <MessageSquare size={8} className="text-zinc-700 shrink-0" />
                    <span className="font-mono text-[9px] text-zinc-600 group-hover:text-zinc-400 transition-colors truncate uppercase tracking-wide">
                        {activeLabel}
                    </span>
                    <span className="font-mono text-[8px] text-zinc-700 shrink-0 ml-auto">
                        {activeConvIndex + 1}/{totalConvs}
                    </span>
                </button>

                {/* Next */}
                <button
                    onClick={switchToNext}
                    disabled={!hasMultiple || activeConvIndex === totalConvs - 1}
                    title="Next conversation"
                    className="p-0.5 text-zinc-700 hover:text-zinc-400 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                >
                    <ChevronRight size={10} />
                </button>
            </div>

            {/* ── Conversation list dropdown ─────────────────────────────────── */}
            {showConvList && (
                <div className="shrink-0 border-b border-zinc-900 bg-zinc-950 max-h-[180px] overflow-y-auto">
                    {conversations.map((conv, idx) => (
                        <div
                            key={conv.id}
                            className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer group transition-colors ${
                                idx === activeConvIndex
                                    ? "bg-zinc-900 border-l border-zinc-600"
                                    : "hover:bg-zinc-900/50 border-l border-transparent"
                            }`}
                            onClick={() => {
                                if (idx !== activeConvIndex) {
                                    abortRef.current?.abort();
                                    setIsLoading(false);
                                    setInput("");
                                    switchConversation(conv.id);
                                }
                                setShowConvList(false);
                            }}
                        >
                            <MessageSquare size={8} className={idx === activeConvIndex ? "text-zinc-400" : "text-zinc-700"} />
                            <span className={`font-mono text-[9px] uppercase tracking-wide flex-1 truncate ${
                                idx === activeConvIndex ? "text-zinc-300" : "text-zinc-600 group-hover:text-zinc-400"
                            }`}>
                                {conv.label}
                            </span>
                            <span className="font-mono text-[8px] text-zinc-700 shrink-0">
                                {conv.messageCount} MSG{conv.messageCount !== 1 ? "S" : ""}
                            </span>
                            {idx !== activeConvIndex && (
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        deleteConversation(conv.id);
                                    }}
                                    title="Delete"
                                    className="p-0.5 text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={8} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Context banner (no selection) ──────────────────────────────── */}
            {!selectedItemName && !selectedEdge && (
                <div className="shrink-0 px-3 py-2 border-b border-zinc-900 bg-zinc-950/40">
                    <p className="font-mono text-[9px] text-zinc-600 tracking-wide uppercase leading-relaxed">
                        {emptySelectionText}
                    </p>
                </div>
            )}

            {/* ── Messages ───────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 scroll-smooth">
                {isEmpty ? (
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

            {/* ── Input area ────────────────────────────────────────────────── */}
            <div className="shrink-0 border-t border-zinc-900 bg-zinc-950/60 p-3">
                {/* Quick suggestion chips (after first message) */}
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
