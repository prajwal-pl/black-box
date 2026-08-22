import { FireworksEmbeddings } from "@langchain/fireworks";
import { QdrantVectorStore } from "@langchain/qdrant";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { GenerateEmbeddingsPayload } from "../../types/task-payloads";
import { StorageService } from "../../services/storage.service";
import { Document } from "@langchain/core/documents";

import { QdrantClient } from "@qdrant/js-client-rest";

// Lazy singleton — instantiated on first use so process.env is populated
let _vectorStore: QdrantVectorStore | null = null;

/** Embedding dimension for qwen3-embedding-8b */
const VECTOR_SIZE = 4096;

/**
 * Qdrant Cloud enables strict mode (filtering_require_index) by default —
 * filtered similarity searches return 400 Bad Request unless every filtered
 * payload field has an index. All case-scoped searches filter on this key.
 */
const FILTER_INDEXES: { field: string; schema: "keyword" }[] = [
    { field: "metadata.caseId", schema: "keyword" },
];

async function ensureCollection(client: QdrantClient, collectionName: string): Promise<void> {
    let info;
    try {
        info = await client.getCollection(collectionName);
        console.log(`[EMBEDDING] Collection "${collectionName}" already exists`);
    } catch {
        console.log(`[EMBEDDING] Collection "${collectionName}" not found — creating with dim=${VECTOR_SIZE}...`);
        await client.createCollection(collectionName, {
            vectors: { size: VECTOR_SIZE, distance: "Cosine" },
        });
        console.log(`[EMBEDDING] ✓ Collection "${collectionName}" created`);
    }

    const indexedFields = Object.keys(info?.payload_schema ?? {});
    for (const { field, schema } of FILTER_INDEXES) {
        if (indexedFields.includes(field)) continue;
        console.log(`[EMBEDDING] Creating payload index on "${field}" (${schema})...`);
        await client.createPayloadIndex(collectionName, {
            field_name: field,
            field_schema: schema,
            wait: true,
        });
        console.log(`[EMBEDDING] ✓ Payload index on "${field}" created`);
    }
}

async function getVectorStore() {
    if (!_vectorStore) {
        const url = process.env.QDRANT_URL!;
        const collectionName = process.env.QDRANT_COLLECTION!;
        console.log(
            `[EMBEDDING] Initialising Qdrant vector store (url=${url} collection=${collectionName})...`,
        );
        const embeddings = new FireworksEmbeddings({
            model: "accounts/fireworks/models/qwen3-embedding-8b",
            batchSize: 512,
        });

        // Ensure collection exists before using fromExistingCollection
        const client = new QdrantClient({ url, apiKey: process.env.QDRANT_API_KEY });
        await ensureCollection(client, collectionName);

        _vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
            apiKey: process.env.QDRANT_API_KEY!,
            url,
            collectionName,
        });
        console.log(`[EMBEDDING] Qdrant vector store ready`);
    }
    return _vectorStore;
}


const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
});

export class EmbeddingProcessor {
    static async handle(
        payload: GenerateEmbeddingsPayload,
    ): Promise<{ evidenceId: string; chunkCount: number }> {
        const { evidenceId, caseId, chunkKeys } = payload;

        console.log(
            `[EMBEDDING] ▶ START evidenceId=${evidenceId} caseId=${caseId} chunkKeys=${JSON.stringify(chunkKeys)}`,
        );

        const rawTexts: string[] = [];
        for (const key of chunkKeys) {
            console.log(`[EMBEDDING] Downloading chunk from: ${key}`);
            const buffer = await StorageService.download(key);
            const text = buffer.toString("utf-8");
            console.log(`[EMBEDDING] Downloaded chunk: ${text.length} chars`);
            if (text.trim().length > 50) {
                rawTexts.push(text);
            } else {
                console.warn(`[EMBEDDING] ⚠ Skipping empty/short chunk from ${key}`);
            }
        }

        const docs = rawTexts.map(
            (text) =>
                new Document({
                    pageContent: text,
                    metadata: { evidenceId, caseId },
                }),
        );

        console.log(`[EMBEDDING] Splitting ${docs.length} docs into chunks...`);
        let splits = await splitter.splitDocuments(docs);
        splits = splits.filter((doc) => doc.pageContent.trim().length >= 20);
        console.log(`[EMBEDDING] Split into ${splits.length} valid chunks`);

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
                await vectorStore.addDocuments(splits);
                console.log(`[EMBEDDING] ✓ ${splits.length} chunks added to Qdrant`);
            } catch (err) {
                console.error(`[EMBEDDING] ✗ Qdrant addDocuments FAILED:`, err);
                throw err;
            }
        } else {
            console.warn(`[EMBEDDING] ⚠ No valid chunks after splitting, skipping Qdrant insertion`);
        }

        console.log(`[EMBEDDING] ✓ DONE evidenceId=${evidenceId} chunkCount=${splits.length}`);
        return { evidenceId, chunkCount: splits.length };
    }
}