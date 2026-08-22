"use client";

import { useState, useCallback } from "react";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AIMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    isStreaming?: boolean;
}

export interface ConversationSummary {
    id: string;
    label: string;
    createdAt: Date;
    messageCount: number;
}

// ─── Internal storage types ───────────────────────────────────────────────────

interface StoredMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string; // ISO
    isStreaming?: boolean;
}

interface StoredConversation {
    id: string;
    label: string;
    createdAt: string; // ISO
    messages: StoredMessage[];
}

interface Store {
    conversations: StoredConversation[];
    activeId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId(): string {
    return Math.random().toString(36).slice(2, 10);
}

function storageKey(key: string): string {
    return `bb_ai_convs:${key}`;
}

function freshConversation(): StoredConversation {
    return {
        id: genId(),
        label: "New conversation",
        createdAt: new Date().toISOString(),
        messages: [],
    };
}

function toStored(m: AIMessage): StoredMessage {
    return { id: m.id, role: m.role, content: m.content, timestamp: m.timestamp.toISOString(), isStreaming: m.isStreaming };
}

function fromStored(m: StoredMessage): AIMessage {
    return { id: m.id, role: m.role, content: m.content, timestamp: new Date(m.timestamp), isStreaming: m.isStreaming };
}

function loadStore(key: string): Store {
    if (typeof window === "undefined") {
        const conv = freshConversation();
        return { conversations: [conv], activeId: conv.id };
    }
    try {
        const raw = localStorage.getItem(storageKey(key));
        if (raw) {
            const parsed = JSON.parse(raw) as Store;
            if (Array.isArray(parsed?.conversations) && parsed.conversations.length > 0) {
                return parsed;
            }
        }
    } catch {
        // corrupt storage — fall through to fresh
    }
    const conv = freshConversation();
    return { conversations: [conv], activeId: conv.id };
}

function persistStore(key: string, store: Store): void {
    try {
        // Strip isStreaming flag before persisting
        const cleaned: Store = {
            ...store,
            conversations: store.conversations.map(c => ({
                ...c,
                messages: c.messages
                    .filter(m => m.content.trim())
                    .map(m => {
                        const { isStreaming, ...rest } = m;
                        return rest;
                    }),
            })),
        };
        localStorage.setItem(storageKey(key), JSON.stringify(cleaned));
    } catch {
        // quota exceeded or private mode — silently ignore
    }
}

function deriveLabel(messages: StoredMessage[], fallback: string): string {
    const first = messages.find(m => m.role === "user");
    if (!first) return fallback;
    const text = first.content.trim();
    return text.length > 42 ? text.slice(0, 42) + "…" : text;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAIConversations(key: string) {
    const [store, setStore] = useState<Store>(() => loadStore(key));

    /** Internal mutator that keeps localStorage in sync */
    const mutate = useCallback(
        (updater: (prev: Store) => Store) => {
            setStore(prev => {
                const next = updater(prev);
                persistStore(key, next);
                return next;
            });
        },
        [key],
    );

    // ── Derived values ────────────────────────────────────────────────────────

    const activeConvIndex = Math.max(
        0,
        store.conversations.findIndex(c => c.id === store.activeId),
    );
    const activeConv = store.conversations[activeConvIndex];
    const messages: AIMessage[] = (activeConv?.messages ?? []).map(fromStored);

    const conversations: ConversationSummary[] = store.conversations.map(c => ({
        id: c.id,
        label: c.label,
        createdAt: new Date(c.createdAt),
        messageCount: c.messages.length,
    }));

    // ── setMessages — drop-in replacement for useState setter ─────────────────
    // Accepts the same functional-update or direct-value signatures used by the panel.

    const setMessages = useCallback(
        (updaterOrValue: AIMessage[] | ((prev: AIMessage[]) => AIMessage[])) => {
            mutate(prev => {
                // Always use the store's current activeId (via prev) to avoid stale closures
                const conv = prev.conversations.find(c => c.id === prev.activeId);
                if (!conv) return prev;

                const currentMsgs = conv.messages.map(fromStored);
                const nextMsgs =
                    typeof updaterOrValue === "function"
                        ? updaterOrValue(currentMsgs)
                        : updaterOrValue;

                const stored = nextMsgs.map(toStored);
                const label = deriveLabel(stored, conv.label);

                return {
                    ...prev,
                    conversations: prev.conversations.map(c =>
                        c.id === prev.activeId ? { ...c, messages: stored, label } : c,
                    ),
                };
            });
        },
        [mutate],
    );

    // ── Conversation management ───────────────────────────────────────────────

    const newConversation = useCallback(() => {
        const conv = freshConversation();
        mutate(prev => ({
            conversations: [...prev.conversations, conv],
            activeId: conv.id,
        }));
    }, [mutate]);

    const deleteConversation = useCallback(
        (id?: string) => {
            mutate(prev => {
                const targetId = id ?? prev.activeId;
                const remaining = prev.conversations.filter(c => c.id !== targetId);

                if (remaining.length === 0) {
                    const fresh = freshConversation();
                    return { conversations: [fresh], activeId: fresh.id };
                }

                const wasActive = prev.activeId === targetId;
                if (!wasActive) return { ...prev, conversations: remaining };

                // Pick adjacent conversation
                const idx = prev.conversations.findIndex(c => c.id === targetId);
                const nextActive = remaining[Math.max(0, idx - 1)].id;
                return { conversations: remaining, activeId: nextActive };
            });
        },
        [mutate],
    );

    const switchConversation = useCallback(
        (id: string) => {
            mutate(prev => ({ ...prev, activeId: id }));
        },
        [mutate],
    );

    const switchToPrev = useCallback(() => {
        mutate(prev => {
            const idx = prev.conversations.findIndex(c => c.id === prev.activeId);
            if (idx <= 0) return prev;
            return { ...prev, activeId: prev.conversations[idx - 1].id };
        });
    }, [mutate]);

    const switchToNext = useCallback(() => {
        mutate(prev => {
            const idx = prev.conversations.findIndex(c => c.id === prev.activeId);
            if (idx >= prev.conversations.length - 1) return prev;
            return { ...prev, activeId: prev.conversations[idx + 1].id };
        });
    }, [mutate]);

    return {
        // Data
        conversations,
        activeConvId: store.activeId,
        activeConvIndex,
        messages,
        // Setters
        setMessages,
        newConversation,
        deleteConversation,
        switchConversation,
        switchToPrev,
        switchToNext,
    };
}
