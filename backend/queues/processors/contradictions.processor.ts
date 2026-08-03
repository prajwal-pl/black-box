import { ChatPromptTemplate } from "@langchain/core/prompts";
import { FireworksEmbeddings, ChatFireworks } from "@langchain/fireworks";
import { ChatGroq } from "@langchain/groq";
import { QdrantVectorStore } from "@langchain/qdrant";
import type { Job } from "bullmq";
import { z } from "zod/v4";
import type { ScanContradictionsPayload } from "../jobs/types";
import db from "../../lib/db";
import { StorageService } from "../../services/storage.service";

const ContradictionSchema = z.object({
    contradictions: z.array(z.object({
        title: z.string().describe("Short title describing the contradiction"),
        description: z.string().describe("Explanation of what contradicts what, citing both pieces of evidence"),
        severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).describe("How significant is this contradiction to the case"),
        conflictingEvidenceSnippet: z.string().describe("The specific text from the existing evidence that conflicts"),
    })).describe("List of contradictions found. Empty array if none."),
});

// Lazy singletons — instantiated on first use so process.env is populated by then
let _model: ChatFireworks | null = null;
let _vectorStore: QdrantVectorStore | null = null;
let _contradictionChain: ReturnType<typeof buildContradictionChain> | null = null;

function getModel() {
    if (!_model) {
        console.log(`[CONTRADICTIONS] Initialising ChatFireworks model...`);
        _model = new ChatFireworks({ model: "accounts/fireworks/models/deepseek-v4-flash-0731", temperature: 0, maxRetries: 10, timeout: 120_000 });
        console.log(`[CONTRADICTIONS] ChatFireworks model ready`);
    }
    return _model;
}

async function getVectorStore() {
    if (!_vectorStore) {
        console.log(`[CONTRADICTIONS] Initialising Qdrant vector store (url=${process.env.QDRANT_URL} collection=${process.env.QDRANT_COLLECTION})...`);
        const embeddings = new FireworksEmbeddings({
            model: "accounts/fireworks/models/qwen3-embedding-8b",
            batchSize: 512,
        });
        _vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
            url: process.env.QDRANT_URL!,
            collectionName: process.env.QDRANT_COLLECTION!,
        });
        console.log(`[CONTRADICTIONS] Qdrant vector store ready`);
    }
    return _vectorStore;
}

function buildContradictionChain() {
    return ChatPromptTemplate.fromMessages([
        ["system", `You are a forensic analyst identifying contradictions between pieces of evidence.
Rules:
- Only flag genuine factual contradictions, not differences in perspective.
- A contradiction means two pieces of evidence cannot both be true.
- If there are no contradictions, return an empty array.`],
        ["human", `New evidence:\n{newEvidence}\n\nExisting evidence chunks:\n{existingEvidence}\n\nIdentify any contradictions.`],
    ]).pipe(getModel().withStructuredOutput(ContradictionSchema));
}

function getContradictionChain() {
    if (!_contradictionChain) {
        _contradictionChain = buildContradictionChain();
    }
    return _contradictionChain;
}

export class ContradictionProcessor {
    static async handle(job: Job<ScanContradictionsPayload>) {
        const { caseId, evidenceId } = job.data;

        console.log(`[CONTRADICTIONS] ▶ START evidenceId=${evidenceId} caseId=${caseId}`);

        await job.updateProgress(10);

        // Read normalized text (not raw storageKey which points to binary PDF)
        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        console.log(`[CONTRADICTIONS] Downloading normalized text from: ${normalizedTextKey}`);
        let newEvidenceText: string;
        try {
            const buffer = await StorageService.download(normalizedTextKey);
            newEvidenceText = buffer.toString("utf-8");
            console.log(`[CONTRADICTIONS] Downloaded normalized text: ${newEvidenceText.length} chars`);
        } catch (err) {
            console.error(`[CONTRADICTIONS] ✗ Failed to download normalized text from ${normalizedTextKey}:`, err);
            throw err;
        }

        await job.updateProgress(30);

        console.log(`[CONTRADICTIONS] Connecting to Qdrant vector store...`);
        let vectorStore;
        try {
            vectorStore = await getVectorStore();
        } catch (err) {
            console.error(`[CONTRADICTIONS] ✗ Failed to connect to Qdrant:`, err);
            throw err;
        }

        console.log(`[CONTRADICTIONS] Searching for similar chunks in Qdrant (caseId=${caseId})...`);
        let similarChunks;
        try {
            similarChunks = await vectorStore.similaritySearch(
                newEvidenceText,
                10,
                {
                    must: [
                        {
                            key: "metadata.caseId",
                            match: {
                                value: caseId,
                            }
                        }]
                }
            )
            console.log(`[CONTRADICTIONS] Found ${similarChunks.length} similar chunks in vector store`);
        } catch (err) {
            console.error(`[CONTRADICTIONS] ✗ Qdrant similaritySearch FAILED:`, err);
            throw err;
        }

        if (!similarChunks.length) {
            console.log(`[CONTRADICTIONS] No similar chunks found — skipping LLM contradiction scan (no existing evidence to compare)`);
            await job.updateProgress(100);
            return { evidenceId, contradictions: [] };
        }

        const existingEvidenceText = similarChunks.map(chunk => chunk.pageContent).join("\n---\n");
        console.log(`[CONTRADICTIONS] Calling LLM for contradiction analysis...`);

        let result;
        try {
            result = await getContradictionChain().invoke({
                newEvidence: newEvidenceText,
                existingEvidence: existingEvidenceText,
            });
            console.log(`[CONTRADICTIONS] LLM returned ${result.contradictions.length} contradictions`);
        } catch (err) {
            console.error(`[CONTRADICTIONS] ✗ LLM call FAILED:`, err);
            throw err;
        }

        await job.updateProgress(80);

        if (result.contradictions.length === 0) {
            console.log(`[CONTRADICTIONS] No contradictions found — nothing to persist`);
        }

        for (const c of result.contradictions) {
            console.log(`[CONTRADICTIONS] Inserting contradiction: "${c.title}" severity=${c.severity}`);
            try {
                await db.contradictions.create({
                    data: {
                        caseId,
                        title: c.title,
                        description: c.description,
                        severity: c.severity,
                        evidenceIds: [evidenceId]
                    }
                })
                console.log(`[CONTRADICTIONS] ✓ Contradiction inserted`);
            } catch (err) {
                console.error(`[CONTRADICTIONS] ✗ DB insert FAILED for contradiction "${c.title}":`, err);
                throw err;
            }
        }

        await job.updateProgress(100);
        console.log(`[CONTRADICTIONS] ✓ DONE evidenceId=${evidenceId} contradictionCount=${result.contradictions.length}`);
        return { evidenceId, contradictionCount: result.contradictions.length };
    }
}