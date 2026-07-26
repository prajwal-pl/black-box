import { FireworksEmbeddings } from "@langchain/fireworks";
import { QdrantVectorStore } from "@langchain/qdrant"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { Job } from "bullmq";
import { JOB_NAMES, JOB_PRIORITY, type GenerateEmbeddingsPayload } from "../jobs/types";
import { StorageService } from "../../services/storage.service";
import { Document } from "@langchain/core/documents";
import { reasoningQueue } from "../definitions/reasoning.queue";

const embeddings = new FireworksEmbeddings({
    model: "accounts/fireworks/models/qwen3-embedding-8b",
    batchSize: 512,
})

const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    url: process.env.QDRANT_URL!,
    collectionName: process.env.QDRANT_COLLECTION!,
})

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200
})

export class EmbeddingProcessor {
    static async handle(job: Job<GenerateEmbeddingsPayload>) {
        const { evidenceId, caseId, chunkKeys } = job.data

        await job.updateProgress(10);

        const rawTexts: string[] = []
        for (const key of chunkKeys) {
            const buffer = await StorageService.download(key)
            rawTexts.push(buffer.toString("utf-8"))
        }

        await job.updateProgress(30);

        const docs = rawTexts.map(text => new Document({
            pageContent: text,
            metadata: { evidenceId, caseId }
        }))

        const splits = await splitter.splitDocuments(docs)
        await job.updateProgress(50);

        await vectorStore.addDocuments(splits)

        await job.updateProgress(80);

        await reasoningQueue.add(JOB_NAMES.UPDATE_HYPOTHESES, {
            caseId,
            triggerReason: "new-evidence",
            newEvidenceCount: 1,
        }, {
            priority: JOB_PRIORITY.HYPOTHESES
        })

        await job.updateProgress(100);
        return { evidenceId, chunkCount: splits.length };
    }
}