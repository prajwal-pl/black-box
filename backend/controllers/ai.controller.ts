import type { RequestHandler } from "express";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatFireworks } from "@langchain/fireworks";
import { FireworksEmbeddings } from "@langchain/fireworks";
import { QdrantVectorStore } from "@langchain/qdrant";

// ─── Lazy singletons ──────────────────────────────────────────────────────────

let _model: ChatFireworks | null = null;
let _vectorStore: QdrantVectorStore | null = null;

function getModel(): ChatFireworks {
    if (!_model) {
        _model = new ChatFireworks({
            model: "accounts/fireworks/models/deepseek-v4-flash-0731",
            temperature: 0.4,
            maxRetries: 3,
            timeout: 60_000,
        });
    }
    return _model;
}

async function getVectorStore(): Promise<QdrantVectorStore> {
    if (!_vectorStore) {
        const embeddings = new FireworksEmbeddings({
            model: "accounts/fireworks/models/qwen3-embedding-8b",
            batchSize: 512,
        });
        _vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
            url: process.env.QDRANT_URL!,
            collectionName: process.env.QDRANT_COLLECTION!,
        });
    }
    return _vectorStore;
}

// ─── Context-aware system prompts ─────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<string, string> = {
    "Evidence Ingestion Pipeline": `You are a forensic analyst specialising in document analysis, OCR, and evidence ingestion pipelines.
You help investigators understand evidence files, interpret parsed content, identify key entities, and suggest missing evidence.
Be precise, methodical, and cite specific evidence when possible.
If relevant evidence chunks are provided below, ground your answers in them.`,

    "Hypothesis Lab Reasoning Engine": `You are a forensic reasoning engine that generates, challenges, and refines investigative hypotheses.
You evaluate evidence strength, identify logical gaps, and help investigators stress-test their theories.
Produce falsifiable statements, rate confidence levels, and always explain your reasoning.
If relevant evidence chunks are provided below, ground your answers in them.`,

    "Contradiction Scanner": `You are an expert analyst specialising in identifying logical contradictions and inconsistencies across evidence.
You cross-reference statements, timestamps, and facts to surface conflicts that may indicate deception or error.
Always quote the conflicting items and suggest possible explanations or resolutions.
If relevant evidence chunks are provided below, ground your answers in them.`,

    "Factual Contradiction Analyzer": `You are an expert analyst specialising in identifying logical contradictions and inconsistencies across evidence.
You cross-reference statements, timestamps, and facts to surface conflicts that may indicate deception or error.
Always quote the conflicting items and suggest possible explanations or resolutions.
If relevant evidence chunks are provided below, ground your answers in them.`,

    "Graph Intelligence": `You are an entity and relationship extraction specialist.
You help investigators understand entity networks, identify suspicious links, and uncover hidden connections.
Be specific about node types (Person, Organization, Location, Object, Concept) and relationship semantics.
If relevant evidence chunks are provided below, ground your answers in them.`,

    "Entity Topology Resolver": `You are an entity and relationship extraction specialist.
You help investigators understand entity networks, identify suspicious links, and uncover hidden connections.
Be specific about node types (Person, Organization, Location, Object, Concept) and relationship semantics.
If relevant evidence chunks are provided below, ground your answers in them.`,

    "Timeline Intelligence": `You are a temporal analyst specialising in reconstructing event sequences from forensic evidence.
You identify chronological gaps, anomalies, and causal chains between events.
Always use precise timestamps when available, flag uncertain dates, and highlight significant temporal patterns.
If relevant evidence chunks are provided below, ground your answers in them.`,

    "Chronological Event Reconstructor": `You are a temporal analyst specialising in reconstructing event sequences from forensic evidence.
You identify chronological gaps, anomalies, and causal chains between events.
Always use precise timestamps when available, flag uncertain dates, and highlight significant temporal patterns.
If relevant evidence chunks are provided below, ground your answers in them.`,
};

const DEFAULT_SYSTEM_PROMPT = `You are an expert forensic AI assistant helping investigators analyse case evidence.
Be precise, cite evidence when possible, and always provide actionable insights.
If relevant evidence chunks are provided below, ground your answers in them.`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

interface EdgeContext {
    from: string;
    to: string;
    type: string;
    confidence: number;
    fromName?: string;
    toName?: string;
}

interface ChatRequestBody {
    message: string;
    context?: {
        type?: string;
        selectedItem?: string | null;
        selectedEdge?: EdgeContext | null;
    };
    history?: ChatMessage[];
}

// ─── RAG helper ───────────────────────────────────────────────────────────────────

async function retrieveEvidenceChunks(query: string, caseId?: string, edgeContext?: EdgeContext): Promise<string> {
    try {
        const vectorStore = await getVectorStore();
        const filter = caseId
            ? { must: [{ key: "metadata.caseId", match: { value: caseId } }] }
            : undefined;

        // If we have edge context, build a more specific query to find evidence about this relationship
        let searchQuery = query;
        if (edgeContext?.fromName && edgeContext?.toName && edgeContext?.type) {
            searchQuery = `${edgeContext.fromName} ${edgeContext.type} ${edgeContext.toName} ${query}`;
        } else if (edgeContext?.from && edgeContext?.to && edgeContext?.type) {
            searchQuery = `${edgeContext.from} ${edgeContext.type} ${edgeContext.to} ${query}`;
        }

        const results = await vectorStore.similaritySearch(searchQuery, 5, filter);
        if (results.length === 0) return "";
        return results
            .map((doc, i) => `[Evidence chunk ${i + 1}]\n${doc.pageContent}`)
            .join("\n\n---\n\n");
    } catch (err) {
        // Qdrant is optional — degrade gracefully without crashing
        console.warn("[AI] Qdrant RAG unavailable, proceeding without evidence context:", (err as Error).message);
        return "";
    }
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const chatHandler: RequestHandler = async (req, res) => {
    const { message, context, history = [] } = req.body as ChatRequestBody;
    const caseId = req.params.caseId as string | undefined;

    if (!message?.trim()) {
        res.status(400).json({ error: "message is required" });
        return;
    }

    const contextType = context?.type ?? "default";
    const systemPromptBase = SYSTEM_PROMPTS[contextType] ?? DEFAULT_SYSTEM_PROMPT;

    // ── 1. Attempt RAG grounding ─────────────────────────────────────────────
    let systemPrompt = systemPromptBase;
    const evidenceChunks = await retrieveEvidenceChunks(message, caseId, context?.selectedEdge ?? undefined);
    if (evidenceChunks) {
        systemPrompt += `\n\n--- RELEVANT CASE EVIDENCE ---\n${evidenceChunks}\n--- END OF EVIDENCE ---`;
    }
    if (context?.selectedItem) {
        systemPrompt += `\n\nThe user is currently focused on entity: ${context.selectedItem}`;
    }
    if (context?.selectedEdge) {
        const edge = context.selectedEdge;
        const fromName = edge.fromName ?? edge.from;
        const toName = edge.toName ?? edge.to;
        systemPrompt += `\n\nThe user is asking about a specific relationship:`;
        systemPrompt += `\n  FROM: ${fromName}`;
        systemPrompt += `\n  TO: ${toName}`;
        systemPrompt += `\n  RELATIONSHIP TYPE: ${edge.type}`;
        systemPrompt += `\n  CONFIDENCE: ${Math.round(edge.confidence * 100)}%`;
        systemPrompt += `\n\nExplain this relationship using the evidence chunks above. Be specific about what evidence supports this connection.`;
    }

    // ── 2. Build message list ────────────────────────────────────────────────
    const pastMessages = (history ?? []).slice(-10).map((m) =>
        m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content),
    );

    // ── 3. Stream the response ───────────────────────────────────────────────
    try {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering if present

        const model = getModel();
        const allMessages = [
            new SystemMessage(systemPrompt),
            ...pastMessages,
            new HumanMessage(message),
        ];

        const stream = await model.stream(allMessages);

        for await (const chunk of stream) {
            const delta = typeof chunk.content === "string"
                ? chunk.content
                : Array.isArray(chunk.content)
                    ? chunk.content.map((c: any) => (typeof c === "string" ? c : c?.text ?? "")).join("")
                    : "";
            if (delta) {
                res.write(`data: ${JSON.stringify({ delta })}\n\n`);
            }
        }

        res.write("data: [DONE]\n\n");
        res.end();
    } catch (err) {
        console.error("[AI] Streaming failed, attempting JSON fallback:", err);

        // If headers not yet sent, fall back to JSON
        if (!res.headersSent) {
            try {
                const model = getModel();
                const allMessages = [
                    new SystemMessage(systemPrompt),
                    ...pastMessages,
                    new HumanMessage(message),
                ];
                const result = await model.invoke(allMessages);
                const reply = typeof result.content === "string"
                    ? result.content
                    : JSON.stringify(result.content);
                res.json({ reply });
            } catch (fallbackErr) {
                console.error("[AI] JSON fallback also failed:", fallbackErr);
                res.status(500).json({ error: "AI service temporarily unavailable" });
            }
        } else {
            // Headers already sent — close the SSE stream with an error event
            try {
                res.write(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`);
                res.write("data: [DONE]\n\n");
                res.end();
            } catch {
                // Response already closed
            }
        }
    }
};
