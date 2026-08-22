import { ChatPromptTemplate } from "@langchain/core/prompts";
import { FireworksEmbeddings, ChatFireworks } from "@langchain/fireworks";
import { QdrantVectorStore } from "@langchain/qdrant";
import { z } from "zod/v4";
import type { ScanContradictionsPayload } from "../../types/task-payloads";
import db from "../../lib/db";
import { StorageService } from "../../services/storage.service";

const ContradictionSchema = z.object({
    contradictions: z
        .array(
            z.object({
                title: z.string().describe("Short title describing the contradiction"),
                description: z
                    .string()
                    .describe(
                        "Explanation of what contradicts what, citing both pieces of evidence",
                    ),
                severity: z
                    .enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
                    .describe("How significant is this contradiction to the case"),
                conflictingEvidenceSnippet: z
                    .string()
                    .describe(
                        "The specific text from the existing evidence that conflicts",
                    ),
            }),
        )
        .describe("List of contradictions found. Empty array if none."),
});

import { QdrantClient } from "@qdrant/js-client-rest";

// Lazy singletons — instantiated on first use so process.env is populated
let _model: ChatFireworks | null = null;
let _vectorStore: QdrantVectorStore | null = null;
let _contradictionChain: ReturnType<typeof buildContradictionChain> | null = null;

function getModel() {
    if (!_model) {
        console.log(`[CONTRADICTIONS] Initialising ChatFireworks model...`);
        _model = new ChatFireworks({
            model: "accounts/fireworks/models/deepseek-v4-flash-0731",
            temperature: 0,
            maxRetries: 10,
            timeout: 120_000,
        });
        console.log(`[CONTRADICTIONS] ChatFireworks model ready`);
    }
    return _model;
}

/**
 * Returns the vector store, or null if the Qdrant collection doesn't exist yet.
 * Returning null lets callers skip the search gracefully on first run.
 */
async function getVectorStore(): Promise<QdrantVectorStore | null> {
    if (_vectorStore) return _vectorStore;

    const url = process.env.QDRANT_URL!;
    const collectionName = process.env.QDRANT_COLLECTION!;
    console.log(
        `[CONTRADICTIONS] Initialising Qdrant vector store (url=${url} collection=${collectionName})...`,
    );

    const client = new QdrantClient({ url, apiKey: process.env.QDRANT_API_KEY });
    try {
        await client.getCollection(collectionName);
    } catch {
        console.warn(
            `[CONTRADICTIONS] ⚠ Qdrant collection "${collectionName}" does not exist yet — ` +
            `no embeddings stored. Skipping contradiction scan.`,
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
    console.log(`[CONTRADICTIONS] Qdrant vector store ready`);
    return _vectorStore;
}


function buildContradictionChain() {
    return ChatPromptTemplate.fromMessages([
        [
            "system",
            `You are a forensic analyst identifying contradictions between pieces of evidence.
Rules:
- Only flag genuine factual contradictions, not differences in perspective.
- A contradiction means two pieces of evidence cannot both be true.
- If there are no contradictions, return an empty array.`,
        ],
        [
            "human",
            `New evidence:\n{newEvidence}\n\nExisting evidence chunks:\n{existingEvidence}\n\nIdentify any contradictions.`,
        ],
    ]).pipe(getModel().withStructuredOutput(ContradictionSchema));
}

function getContradictionChain() {
    if (!_contradictionChain) {
        _contradictionChain = buildContradictionChain();
    }
    return _contradictionChain;
}

export class ContradictionProcessor {
    static async handle(
        payload: ScanContradictionsPayload,
    ): Promise<{ evidenceId: string; contradictionCount: number }> {
        const { caseId, evidenceId } = payload;

        console.log(
            `[CONTRADICTIONS] ▶ START evidenceId=${evidenceId} caseId=${caseId}`,
        );

        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        console.log(`[CONTRADICTIONS] Downloading normalized text from: ${normalizedTextKey}`);
        let newEvidenceText: string;
        try {
            const buffer = await StorageService.download(normalizedTextKey);
            newEvidenceText = buffer.toString("utf-8");
            console.log(
                `[CONTRADICTIONS] Downloaded normalized text: ${newEvidenceText.length} chars`,
            );
        } catch (err) {
            console.error(
                `[CONTRADICTIONS] ✗ Failed to download normalized text from ${normalizedTextKey}:`,
                err,
            );
            throw err;
        }

        console.log(`[CONTRADICTIONS] Connecting to Qdrant vector store...`);
        const vectorStore = await getVectorStore();

        if (vectorStore === null) {
            console.warn(
                `[CONTRADICTIONS] ⚠ Qdrant collection not ready — no prior embeddings exist. ` +
                `Skipping contradiction scan for evidenceId=${evidenceId}.`,
            );
            return { evidenceId, contradictionCount: 0 };
        }

        console.log(
            `[CONTRADICTIONS] Searching for similar chunks in Qdrant (caseId=${caseId})...`,
        );
        let similarChunks;
        try {
            similarChunks = await vectorStore.similaritySearch(newEvidenceText, 10, {
                must: [{ key: "metadata.caseId", match: { value: caseId } }],
            });
            console.log(
                `[CONTRADICTIONS] Found ${similarChunks.length} similar chunks in vector store`,
            );
        } catch (err) {
            console.error(`[CONTRADICTIONS] ✗ Qdrant similaritySearch FAILED:`, err);
            throw err;
        }

        if (!similarChunks.length) {
            console.log(
                `[CONTRADICTIONS] No similar chunks found — skipping contradiction scan`,
            );
            return { evidenceId, contradictionCount: 0 };
        }

        const existingEvidenceText = similarChunks
            .map((chunk) => chunk.pageContent)
            .join("\n---\n");

        console.log(`[CONTRADICTIONS] Calling LLM for contradiction analysis...`);
        let result;
        try {
            result = await getContradictionChain().invoke({
                newEvidence: newEvidenceText,
                existingEvidence: existingEvidenceText,
            });
            console.log(
                `[CONTRADICTIONS] LLM returned ${result.contradictions.length} contradictions`,
            );
        } catch (err) {
            console.error(`[CONTRADICTIONS] ✗ LLM call FAILED:`, err);
            throw err;
        }

        for (const c of result.contradictions) {
            console.log(
                `[CONTRADICTIONS] Inserting contradiction: "${c.title}" severity=${c.severity}`,
            );
            try {
                await db.contradictions.create({
                    data: {
                        caseId,
                        title: c.title,
                        description: c.description,
                        severity: c.severity,
                        evidenceIds: [evidenceId],
                    },
                });
            } catch (err) {
                console.error(
                    `[CONTRADICTIONS] ✗ DB insert FAILED for contradiction "${c.title}":`,
                    err,
                );
                throw err;
            }
        }

        console.log(
            `[CONTRADICTIONS] ✓ DONE evidenceId=${evidenceId} contradictionCount=${result.contradictions.length}`,
        );
        return { evidenceId, contradictionCount: result.contradictions.length };
    }
}