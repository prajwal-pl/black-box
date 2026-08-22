import { ChatPromptTemplate } from "@langchain/core/prompts";
import { FireworksEmbeddings, ChatFireworks } from "@langchain/fireworks";
import { z } from "zod/v4";
import type { UpdateHypothesesPayload } from "../../types/task-payloads";
import { QdrantVectorStore } from "@langchain/qdrant";
import db from "../../lib/db";

const HypothesisSchema = z.object({
    hypotheses: z
        .array(
            z.object({
                content: z
                    .string()
                    .describe("A clear, falsifiable hypothesis statement about what happened"),
                confidence: z
                    .number()
                    .min(0)
                    .max(1)
                    .describe("Confidence from 0.0 to 1.0 based on evidence strength"),
                reasoning: z
                    .string()
                    .describe("Brief explanation of why this hypothesis is supported by the evidence"),
            }),
        )
        .describe("List of hypotheses, ordered from most to least confident"),
});

import { QdrantClient } from "@qdrant/js-client-rest";

// Lazy singletons — instantiated on first use so process.env is populated
let _model: ChatFireworks | null = null;
let _vectorStore: QdrantVectorStore | null = null;
let _hypothesisChain: ReturnType<typeof buildHypothesisChain> | null = null;

function getModel() {
    if (!_model) {
        console.log(`[REASONING] Initialising ChatFireworks model...`);
        _model = new ChatFireworks({
            model: "accounts/fireworks/models/deepseek-v4-flash-0731",
            temperature: 0,
            maxRetries: 10,
            timeout: 120_000,
        });
        console.log(`[REASONING] ChatFireworks model ready`);
    }
    return _model;
}

/**
 * Returns the vector store, or null if the Qdrant collection doesn't exist yet
 * (e.g. before any embeddings have been generated). Returning null lets the
 * caller skip the similarity search gracefully rather than throwing 400.
 */
async function getVectorStore(): Promise<QdrantVectorStore | null> {
    if (_vectorStore) return _vectorStore;

    const url = process.env.QDRANT_URL!;
    const collectionName = process.env.QDRANT_COLLECTION!;
    console.log(
        `[REASONING] Initialising Qdrant vector store (url=${url} collection=${collectionName})...`,
    );

    // Check the collection exists before calling fromExistingCollection —
    // otherwise Qdrant returns 400 Bad Request and LangChain surfaces it as an Error.
    const client = new QdrantClient({ url, apiKey: process.env.QDRANT_API_KEY });
    try {
        await client.getCollection(collectionName);
    } catch {
        console.warn(
            `[REASONING] ⚠ Qdrant collection "${collectionName}" does not exist yet — ` +
            `no embeddings have been stored. Skipping similarity search.`,
        );
        return null;
    }

    const embeddings = new FireworksEmbeddings({
        model: "accounts/fireworks/models/qwen3-embedding-8b",
        batchSize: 512,
    });
    _vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
        apiKey: process.env.QDRANT_API_KEY!,
        url,
        collectionName,
    });
    console.log(`[REASONING] Qdrant vector store ready`);
    return _vectorStore;
}


function buildHypothesisChain() {
    return ChatPromptTemplate.fromMessages([
        [
            "system",
            `You are a forensic analyst generating investigative hypotheses.
Rules:
- Base hypotheses ONLY on the evidence provided below.
- Each hypothesis must be falsifiable — it should be possible to prove it wrong.
- Order hypotheses from most to least supported by the evidence.
- Do not repeat existing hypotheses unless new evidence strengthens them.`,
        ],
        [
            "human",
            `Evidence chunks (most relevant to this case):
{evidence}

Existing hypotheses (do not duplicate):
{existing}

Generate updated hypotheses based on all evidence above.`,
        ],
    ]).pipe(getModel().withStructuredOutput(HypothesisSchema));
}

function getHypothesisChain() {
    if (!_hypothesisChain) {
        _hypothesisChain = buildHypothesisChain();
    }
    return _hypothesisChain;
}

export class ReasoningProcessor {
    static async handle(
        payload: UpdateHypothesesPayload,
    ): Promise<{ caseId: string; hypothesesCount: number }> {
        const { caseId } = payload;

        console.log(
            `[REASONING] ▶ START caseId=${caseId} triggerReason=${payload.triggerReason}`,
        );

        console.log(`[REASONING] Connecting to Qdrant vector store...`);
        const vectorStore = await getVectorStore();

        let relevantChunks: Awaited<ReturnType<QdrantVectorStore["similaritySearch"]>> = [];
        if (vectorStore === null) {
            console.warn(
                `[REASONING] ⚠ Qdrant collection not ready — skipping similarity search, proceeding with 0 chunks`,
            );
        } else {
            console.log(
                `[REASONING] Searching Qdrant for relevant evidence chunks (caseId=${caseId})...`,
            );
            try {
                relevantChunks = await vectorStore.similaritySearch(
                    `forensic evidence case ${caseId}`,
                    10,
                    { must: [{ key: "metadata.caseId", match: { value: caseId } }] },
                );
                console.log(`[REASONING] Found ${relevantChunks.length} relevant chunks`);
            } catch (err) {
                console.error(`[REASONING] ✗ Qdrant similaritySearch FAILED:`, err);
                throw err;
            }

            if (relevantChunks.length === 0) {
                console.warn(
                    `[REASONING] ⚠ No relevant chunks found for caseId=${caseId} — hypotheses may be empty`,
                );
            }
        }

        console.log(`[REASONING] Fetching existing hypotheses from DB for caseId=${caseId}...`);
        const existingHypotheses = await db.hypothesis.findMany({
            where: { caseId },
            orderBy: { confidence: "desc" },
            take: 10,
        });
        console.log(`[REASONING] Found ${existingHypotheses.length} existing hypotheses`);

        const evidence = relevantChunks
            .map((c, i) => `[${i + 1} ${c.pageContent}]`)
            .join("\n\n---\n\n");

        const existing =
            existingHypotheses.length > 0
                ? existingHypotheses
                    .map((h) => `- ${h.content} (confidence: ${h.confidence})`)
                    .join("\n")
                : "None yet";

        console.log(`[REASONING] Calling LLM for hypothesis generation...`);
        let result;
        try {
            result = await getHypothesisChain().invoke({ evidence, existing });
            console.log(`[REASONING] LLM returned ${result.hypotheses.length} hypotheses`);
        } catch (err) {
            console.error(`[REASONING] ✗ LLM call FAILED:`, err);
            throw err;
        }

        console.log(`[REASONING] Inserting ${result.hypotheses.length} hypotheses into DB...`);
        for (const h of result.hypotheses) {
            try {
                await db.hypothesis.create({
                    data: {
                        caseId,
                        content: h.content,
                        confidence: h.confidence,
                        status: "ACTIVE",
                    },
                });
            } catch (err) {
                console.error(`[REASONING] ✗ DB insert FAILED for hypothesis:`, err);
                throw err;
            }
        }
        console.log(`[REASONING] ✓ All hypotheses inserted`);

        console.log(
            `[REASONING] ✓ DONE caseId=${caseId} hypothesesCount=${result.hypotheses.length}`,
        );
        return { caseId, hypothesesCount: result.hypotheses.length };
    }
}