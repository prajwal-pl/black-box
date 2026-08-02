import { ChatPromptTemplate } from "@langchain/core/prompts";
import { FireworksEmbeddings } from "@langchain/fireworks";
import { ChatGroq } from "@langchain/groq";
import type { Job } from "bullmq";
import { z } from "zod/v4";
import type { UpdateHypothesesPayload } from "../jobs/types";
import { QdrantVectorStore } from "@langchain/qdrant";
import db from "../../lib/db";

const HypothesisSchema = z.object({
    hypotheses: z.array(z.object({
        content: z.string().describe("A clear, falsifiable hypothesis statement about what happened"),
        confidence: z.number().min(0).max(1).describe("Confidence from 0.0 to 1.0 based on evidence strength"),
        reasoning: z.string().describe("Brief explanation of why this hypothesis is supported by the evidence"),
    })).describe("List of hypotheses, ordered from most to least confident"),
});

// Lazy singletons — instantiated on first use so process.env is populated by then
let _model: ChatGroq | null = null;
let _vectorStore: QdrantVectorStore | null = null;
let _hypothesisChain: ReturnType<typeof buildHypothesisChain> | null = null;

function getModel() {
    if (!_model) {
        console.log(`[REASONING] Initialising ChatGroq model...`);
        _model = new ChatGroq({
            model: "openai/gpt-oss-120b",
            temperature: 0,
            maxRetries: 10,
            timeout: 120_000,
        });
        console.log(`[REASONING] ChatGroq model ready`);
    }
    return _model;
}

async function getVectorStore() {
    if (!_vectorStore) {
        console.log(`[REASONING] Initialising Qdrant vector store (url=${process.env.QDRANT_URL} collection=${process.env.QDRANT_COLLECTION})...`);
        const embeddings = new FireworksEmbeddings({
            model: "accounts/fireworks/models/qwen3-embedding-8b",
            batchSize: 512,
        });
        _vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
            url: process.env.QDRANT_URL!,
            collectionName: process.env.QDRANT_COLLECTION!,
        });
        console.log(`[REASONING] Qdrant vector store ready`);
    }
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
    static async handle(job: Job<UpdateHypothesesPayload>) {
        const { caseId } = job.data

        console.log(`[REASONING] ▶ START caseId=${caseId} triggerReason=${job.data.triggerReason}`);

        await job.updateProgress(10);

        console.log(`[REASONING] Connecting to Qdrant vector store...`);
        let vectorStore;
        try {
            vectorStore = await getVectorStore();
        } catch (err) {
            console.error(`[REASONING] ✗ Failed to connect to Qdrant:`, err);
            throw err;
        }

        console.log(`[REASONING] Searching Qdrant for relevant evidence chunks (caseId=${caseId})...`);
        let relevantChunks;
        try {
            relevantChunks = await vectorStore.similaritySearch(`forensic evidence case ${caseId}`, 10, { must: [{ key: "metadata.caseId", match: { value: caseId } }] })
            console.log(`[REASONING] Found ${relevantChunks.length} relevant chunks`);
        } catch (err) {
            console.error(`[REASONING] ✗ Qdrant similaritySearch FAILED:`, err);
            throw err;
        }

        if (relevantChunks.length === 0) {
            console.warn(`[REASONING] ⚠ WARNING: No relevant chunks found in Qdrant for caseId=${caseId} — hypotheses may be empty or generic`);
        }

        await job.updateProgress(30);

        console.log(`[REASONING] Fetching existing hypotheses from DB for caseId=${caseId}...`);
        const existingHypotheses = await db.hypothesis.findMany({
            where: {
                caseId,
            },
            orderBy: {
                confidence: "desc"
            },
            take: 10
        })
        console.log(`[REASONING] Found ${existingHypotheses.length} existing hypotheses`);

        const evidence = relevantChunks.map((c, i) => `[${i + 1} ${c.pageContent}]`).join("\n\n---\n\n")

        const existing = existingHypotheses.length > 0 ? existingHypotheses.map(h => `- ${h.content} (confidence: ${h.confidence})`).join("\n") : "None yet"

        await job.updateProgress(50);

        console.log(`[REASONING] Calling LLM for hypothesis generation...`);
        let result;
        try {
            result = await getHypothesisChain().invoke({
                evidence,
                existing
            })
            console.log(`[REASONING] LLM returned ${result.hypotheses.length} hypotheses`);
        } catch (err) {
            console.error(`[REASONING] ✗ LLM call FAILED:`, err);
            throw err;
        }

        await job.updateProgress(80);

        console.log(`[REASONING] Inserting ${result.hypotheses.length} hypotheses into DB...`);
        for (const h of result.hypotheses) {
            console.log(`[REASONING]   Inserting: confidence=${h.confidence} content="${h.content.substring(0, 80)}..."`);
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

        await job.updateProgress(100);
        console.log(`[REASONING] ✓ DONE caseId=${caseId} hypothesesCount=${result.hypotheses.length}`);
        return { caseId, hypothesesCount: result.hypotheses.length };
    }
}