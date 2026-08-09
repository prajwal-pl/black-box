import { FireworksEmbeddings } from "@langchain/fireworks";
import { QdrantVectorStore } from "@langchain/qdrant"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { Job } from "bullmq";
import { JOB_NAMES, JOB_PRIORITY, type GenerateEmbeddingsPayload, type ScanContradictionsPayload } from "../jobs/types";
import { StorageService } from "../../services/storage.service";
import { Document } from "@langchain/core/documents";
import { reasoningQueue } from "../definitions/reasoning.queue";

// Lazy singleton — instantiated on first use so process.env is populated by then
let _vectorStore: QdrantVectorStore | null = null;

async function getVectorStore() {
    if (!_vectorStore) {
        console.log(`[EMBEDDING] Initialising Qdrant vector store (url=${process.env.QDRANT_URL} collection=${process.env.QDRANT_COLLECTION})...`);
        const embeddings = new FireworksEmbeddings({
            model: "accounts/fireworks/models/qwen3-embedding-8b",
            batchSize: 512,
        });
        _vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
            url: process.env.QDRANT_URL!,
            collectionName: process.env.QDRANT_COLLECTION!,
        });
        console.log(`[EMBEDDING] Qdrant vector store ready`);
    }
    return _vectorStore;
}

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200
})

export class EmbeddingProcessor {
    static async handle(job: Job<GenerateEmbeddingsPayload>) {
        const { evidenceId, caseId, chunkKeys } = job.data

        console.log(`[EMBEDDING] ▶ START evidenceId=${evidenceId} caseId=${caseId} chunkKeys=${JSON.stringify(chunkKeys)}`);

        await job.updateProgress(10);

        const rawTexts: string[] = []
        for (const key of chunkKeys) {
            console.log(`[EMBEDDING] Downloading chunk from: ${key}`);
            const buffer = await StorageService.download(key)
            const text = buffer.toString("utf-8");
            console.log(`[EMBEDDING] Downloaded chunk: ${text.length} chars`);
            if (text.trim().length > 50) {
                rawTexts.push(text)
            } else {
                console.warn(`[EMBEDDING] ⚠ Skipping empty/short chunk from ${key}`);
            }
        }

        await job.updateProgress(30);

        const docs = rawTexts.map(text => new Document({
            pageContent: text,
            metadata: { evidenceId, caseId }
        }))

        console.log(`[EMBEDDING] Splitting ${docs.length} docs into chunks...`);
        let splits = await splitter.splitDocuments(docs)
        splits = splits.filter(doc => doc.pageContent.trim().length >= 20)
        console.log(`[EMBEDDING] Split into ${splits.length} valid chunks`);
        await job.updateProgress(50);

        if (splits.length > 0) {
            console.log(`[EMBEDDING] Getting vector store...`);
            let vectorStore;
            try {
                vectorStore = await getVectorStore();
            } catch (err) {
                console.error(`[EMBEDDING] ✗ Failed to connect to Qdrant:`, err);
                throw err;
            }

            console.log(`[EMBEDDING] Adding ${splits.length} chunks to Qdrant...`);
            try {
                await vectorStore.addDocuments(splits)
                console.log(`[EMBEDDING] ✓ ${splits.length} chunks added to Qdrant`);
            } catch (err) {
                console.error(`[EMBEDDING] ✗ Qdrant addDocuments FAILED:`, err);
                throw err;
            }
        } else {
            console.warn(`[EMBEDDING] ⚠ No valid chunks after splitting, skipping Qdrant insertion`);
        }

        await job.updateProgress(80);

        console.log(`[EMBEDDING] Enqueuing UPDATE_HYPOTHESES job...`);
        const hypothesisJob = await reasoningQueue.add(JOB_NAMES.UPDATE_HYPOTHESES, {
            caseId,
            triggerReason: "new-evidence",
            newEvidenceCount: 1,
        }, {
            priority: JOB_PRIORITY.HYPOTHESES
        })
        console.log(`[EMBEDDING] UPDATE_HYPOTHESES job enqueued: jobId=${hypothesisJob.id}`);

        console.log(`[EMBEDDING] Enqueuing SCAN_CONTRADICTIONS job...`);
        const contradictionJob = await reasoningQueue.add(JOB_NAMES.SCAN_CONTRADICTIONS, {
            caseId,
            evidenceId,
            processorVersion: "1.0",
        } satisfies ScanContradictionsPayload & { processorVersion: string }, {
            priority: JOB_PRIORITY.HYPOTHESES
        })
        console.log(`[EMBEDDING] SCAN_CONTRADICTIONS job enqueued: jobId=${contradictionJob.id}`);

        await job.updateProgress(100);
        console.log(`[EMBEDDING] ✓ DONE evidenceId=${evidenceId} chunkCount=${splits.length}`);
        return { evidenceId, chunkCount: splits.length };
    }
}