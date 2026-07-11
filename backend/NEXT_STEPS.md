# Black Box Backend — Next Steps

## Current State

### Done ✅
- All 6 queue definitions (ingestion, processing, graph, reasoning, maintenance, dead-letter)
- `queues/jobs/types.ts` — all payload interfaces + constants
- `IngestionProcessor` — handleUpload + handleClassification
- `ingestion.worker.ts` — routes jobs, handles dead letter on exhaustion
- `EvidenceQueueService` — enqueue, dead letter, job status, queue stats
- Auth — register, login, JWT middleware
- Cases CRUD — partial (updateCase/deleteCase are empty stubs)
- Prisma schema — EvidenceStatus enum, storageKey, mimeType, fileName on Evidence
- Neo4j driver — exists but broken (opens and immediately closes)

### Missing ❌
- `StorageService` — no S3 client, nothing can upload or download files
- `@aws-sdk/client-s3` not installed
- Evidence upload route + controller — empty
- Processing processors — none exist
- Processing worker — does not exist
- Graph processor + worker — does not exist
- Reasoning processor + worker — does not exist
- Maintenance worker — does not exist
- Neo4j driver is not a singleton — unusable by processors
- All route stubs are empty (documents, entities, evidence, graph, hypothesis, reasoning, relationships, timeline)
- Workers are not started anywhere — no pm2 config, no process manager setup

---

## Build Order


Copy
markdown
StorageService ← no deps, everything needs it

Fix Neo4j driver singleton ← needed by graph processor

Evidence upload controller + route ← needs StorageService + EvidenceQueueService

Processing processors + worker ← needs StorageService, dispatches to graph queue

Graph processor + worker ← needs LLM client + Neo4j driver

Reasoning processor + worker ← needs embedding API + Qdrant

Maintenance worker ← needs Neo4j driver + db

Finish empty route stubs ← reads from Postgres + Neo4j

Wire all routes in index.ts ← last, just registration


---

## Step 1 — Storage Service

### Install

```bash
bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

Copy
MinIO for Development
Run once with Docker:

docker run -d --name minio \
  -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

Copy
bash
Then open http://localhost:9001, log in with minioadmin / minioadmin, create a bucket called blackbox.

Dev .env additions:

STORAGE_ENDPOINT=http://localhost:9000
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=blackbox

Copy
env
Cloudflare R2 for Production
R2 is S3-compatible. Same SDK, different credentials. No egress fees — important since workers download files constantly.

Prod .env:

STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
STORAGE_REGION=auto
STORAGE_ACCESS_KEY=<r2-access-key>
STORAGE_SECRET_KEY=<r2-secret-key>
STORAGE_BUCKET=blackbox

Copy
env
Zero code changes between dev and prod — only env vars swap.

services/storage.service.ts
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
    endpoint: process.env.STORAGE_ENDPOINT,
    region: process.env.STORAGE_REGION || "auto",
    credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY!,
        secretAccessKey: process.env.STORAGE_SECRET_KEY!,
    },
    forcePathStyle: true, // required for MinIO, harmless for R2
});

const BUCKET = process.env.STORAGE_BUCKET!;

export class StorageService {
    static async upload(key: string, body: Buffer, mimeType: string) {
        await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: body,
            ContentType: mimeType,
        }));
        return key;
    }

    static async download(key: string): Promise<Buffer> {
        const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
        return Buffer.from(await res.Body!.transformToByteArray());
    }

    static async delete(key: string) {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    }

    static async getPresignedUrl(key: string, expiresIn = 3600) {
        return getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: BUCKET, Key: key }),
            { expiresIn }
        );
    }
}


Copy
typescript
Step 2 — Fix Neo4j Driver
Current lib/graph-driver.ts creates a driver, logs server info, then immediately closes it. It needs to be a singleton like lib/db.ts.

lib/graph-driver.ts
import neo4j from "neo4j-driver";

const driver = neo4j.driver(
    process.env.NEO4J_URI!,
    neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!)
);

export default driver;

Copy
typescript
Usage in any processor:

import driver from "../../lib/graph-driver";

const session = driver.session({ database: process.env.NEO4J_DATABASE });
await session.run(
    "MERGE (e:Entity {id: $id}) SET e += $props",
    { id: entityId, props: entityData }
);
await session.close();

Copy
typescript
Step 3 — Evidence Upload Route + Controller
Install
bun add multer uuid
bun add -d @types/multer @types/uuid

Copy
bash
The upload route is the only place where storage + DB + queue all meet. Strictly sequential — if any step fails, nothing downstream runs.

controllers/evidence.controller.ts
import { type RequestHandler } from "express";
import { v4 as uuid } from "uuid";
import { StorageService } from "../services/storage.service";
import { EvidenceQueueService } from "../services/evidence.queue.service";
import db from "../lib/db";

export const uploadEvidence: RequestHandler = async (req, res) => {
    const file = req.file;
    const { caseId } = req.params;
    const userId = req.userId!;

    if (!file) return res.status(400).json({ message: "No file provided" });

    const ext = file.originalname.split(".").pop();
    const storageKey = `cases/${caseId}/evidence/${uuid()}.${ext}`;

    // 1. Upload to storage first
    await StorageService.upload(storageKey, file.buffer, file.mimetype);

    // 2. Create DB record with PENDING status
    const evidence = await db.evidence.create({
        data: {
            caseId,
            fileName: file.originalname,
            mimeType: file.mimetype,
            storageKey,
            fileUrl: storageKey,
            status: "PENDING",
        },
    });

    // 3. Enqueue — evidenceId now exists in DB
    await EvidenceQueueService.enqueueEvidenceUpload({
        evidenceId: evidence.id,
        caseId,
        storageKey,
        mimeType: file.mimetype,
        fileName: file.originalname,
        fileSize: file.size,
        uploadedBy: userId,
        processorVersion: "1.0",
    });

    // 4. Return immediately — processing is async
    res.status(202).json({ evidenceId: evidence.id, status: "PENDING" });
};

export const getEvidenceStatus: RequestHandler = async (req, res) => {
    const { id } = req.params;
    const evidence = await db.evidence.findUnique({ where: { id } });
    if (!evidence) return res.status(404).json({ message: "Not found" });
    res.json({ id: evidence.id, status: evidence.status });
};

export const getEvidenceByCase: RequestHandler = async (req, res) => {
    const { caseId } = req.params;
    const evidence = await db.evidence.findMany({ where: { caseId } });
    res.json({ evidence });
};

export const deleteEvidence: RequestHandler = async (req, res) => {
    const { id } = req.params;
    const evidence = await db.evidence.findUnique({ where: { id } });
    if (!evidence) return res.status(404).json({ message: "Not found" });

    await StorageService.delete(evidence.storageKey);
    await db.evidence.delete({ where: { id } });

    res.json({ message: "Deleted" });
};


Copy
typescript
routes/evidence.ts
import express from "express";
import multer from "multer";
import { authenticateToken } from "../middleware/middleware.auth";
import {
    uploadEvidence,
    getEvidenceStatus,
    getEvidenceByCase,
    deleteEvidence,
} from "../controllers/evidence.controller";

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

router.post("/cases/:caseId/evidence", authenticateToken, upload.single("file"), uploadEvidence);
router.get("/cases/:caseId/evidence", authenticateToken, getEvidenceByCase);
router.get("/evidence/:id/status", authenticateToken, getEvidenceStatus);
router.delete("/evidence/:id", authenticateToken, deleteEvidence);

export default router;

Copy
typescript
Failure Handling
Step fails	Result	Recovery
Storage upload fails	Return 500, nothing written to DB or queue	Client retries the request
DB create fails	Orphaned file in storage	Maintenance CLEANUP_JOBS detects and deletes
Enqueue fails	DB record stuck at PENDING forever	Maintenance CLEANUP_JOBS re-enqueues stale PENDING records
Step 4 — Processing Processors + Worker
Install
bun add pdf-parse xlsx
bun add -d @types/pdf-parse

Copy
bash
The ingestion processor already dispatches to processingQueue with the correct job name. These processors receive those jobs, download the file, extract/normalize text, upload the result, then dispatch to the graph queue.

Storage key convention:

Raw file: cases/<caseId>/evidence/<uuid>.<ext>

Normalized text: cases/<caseId>/normalized/<evidenceId>.txt

Extraction result: cases/<caseId>/extractions/<evidenceId>.json

queues/processors/processing/pdf.processor.ts
import type { Job } from "bullmq";
import pdfParse from "pdf-parse";
import { StorageService } from "../../../services/storage.service";
import { graphQueue } from "../../definitions/graph.queue";
import { JOB_NAMES, JOB_PRIORITY, type ProcessEvidencePayload } from "../../jobs/types";

export class PdfProcessor {
    static async handle(job: Job<ProcessEvidencePayload>) {
        const { evidenceId, caseId, storageKey } = job.data;

        await job.updateProgress(10);
        const buffer = await StorageService.download(storageKey);

        await job.updateProgress(40);
        const { text, numpages } = await pdfParse(buffer);

        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        await StorageService.upload(normalizedTextKey, Buffer.from(text), "text/plain");

        await job.updateProgress(80);
        await graphQueue.add(JOB_NAMES.EXTRACT_ENTITIES, {
            evidenceId,
            caseId,
            normalizedTextKey,
            processorVersion: "1.0",
        }, { priority: JOB_PRIORITY.ENTITY_EXTRACTION });

        await job.updateProgress(100);
        return { evidenceId, normalizedTextKey, pageCount: numpages };
    }
}


Copy
typescript
queues/processors/processing/image.processor.ts
import type { Job } from "bullmq";
import Tesseract from "tesseract.js";
import { StorageService } from "../../../services/storage.service";
import { graphQueue } from "../../definitions/graph.queue";
import { JOB_NAMES, JOB_PRIORITY, type ProcessEvidencePayload } from "../../jobs/types";

export class ImageProcessor {
    static async handle(job: Job<ProcessEvidencePayload>) {
        const { evidenceId, caseId, storageKey } = job.data;

        await job.updateProgress(10);
        const buffer = await StorageService.download(storageKey);

        await job.updateProgress(30);
        const { data: { text } } = await Tesseract.recognize(buffer, "eng");

        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        await StorageService.upload(normalizedTextKey, Buffer.from(text), "text/plain");

        await job.updateProgress(80);
        await graphQueue.add(JOB_NAMES.EXTRACT_ENTITIES, {
            evidenceId,
            caseId,
            normalizedTextKey,
            processorVersion: "1.0",
        }, { priority: JOB_PRIORITY.OCR });

        await job.updateProgress(100);
        return { evidenceId, normalizedTextKey };
    }
}


Copy
typescript
queues/processors/processing/text.processor.ts
import type { Job } from "bullmq";
import { StorageService } from "../../../services/storage.service";
import { graphQueue } from "../../definitions/graph.queue";
import { JOB_NAMES, JOB_PRIORITY, type ProcessEvidencePayload } from "../../jobs/types";

export class TextProcessor {
    static async handle(job: Job<ProcessEvidencePayload>) {
        const { evidenceId, caseId, storageKey } = job.data;

        await job.updateProgress(10);
        const buffer = await StorageService.download(storageKey);
        const text = buffer.toString("utf-8");

        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        await StorageService.upload(normalizedTextKey, Buffer.from(text), "text/plain");

        await job.updateProgress(80);
        await graphQueue.add(JOB_NAMES.EXTRACT_ENTITIES, {
            evidenceId,
            caseId,
            normalizedTextKey,
            processorVersion: "1.0",
        }, { priority: JOB_PRIORITY.ENTITY_EXTRACTION });

        await job.updateProgress(100);
        return { evidenceId, normalizedTextKey };
    }
}


Copy
typescript
queues/processors/processing/spreadsheet.processor.ts
import type { Job } from "bullmq";
import * as XLSX from "xlsx";
import { StorageService } from "../../../services/storage.service";
import { graphQueue } from "../../definitions/graph.queue";
import { JOB_NAMES, JOB_PRIORITY, type ProcessEvidencePayload } from "../../jobs/types";

export class SpreadsheetProcessor {
    static async handle(job: Job<ProcessEvidencePayload>) {
        const { evidenceId, caseId, storageKey } = job.data;

        await job.updateProgress(10);
        const buffer = await StorageService.download(storageKey);

        const workbook = XLSX.read(buffer);
        const lines: string[] = [];

        for (const sheetName of workbook.SheetNames) {
            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
                workbook.Sheets[sheetName]
            );
            for (const row of rows) {
                lines.push(Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(", "));
            }
        }

        const text = lines.join("\n");
        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        await StorageService.upload(normalizedTextKey, Buffer.from(text), "text/plain");

        await job.updateProgress(80);
        await graphQueue.add(JOB_NAMES.EXTRACT_ENTITIES, {
            evidenceId,
            caseId,
            normalizedTextKey,
            processorVersion: "1.0",
        }, { priority: JOB_PRIORITY.ENTITY_EXTRACTION });

        await job.updateProgress(100);
        return { evidenceId, normalizedTextKey };
    }
}


Copy
typescript
queues/processors/processing/email.processor.ts
import type { Job } from "bullmq";
import { StorageService } from "../../../services/storage.service";
import { graphQueue } from "../../definitions/graph.queue";
import { JOB_NAMES, JOB_PRIORITY, type ProcessEvidencePayload } from "../../jobs/types";

export class EmailProcessor {
    static async handle(job: Job<ProcessEvidencePayload>) {
        const { evidenceId, caseId, storageKey } = job.data;

        await job.updateProgress(10);
        const buffer = await StorageService.download(storageKey);
        const raw = buffer.toString("utf-8");

        // Parse headers + body from raw email format
        const [headerSection, ...bodyParts] = raw.split("\n\n");
        const headers = Object.fromEntries(
            headerSection.split("\n")
                .filter(l => l.includes(":"))
                .map(l => {
                    const [key, ...rest] = l.split(":");
                    return [key.trim(), rest.join(":").trim()];
                })
        );

        const text = [
            `From: ${headers["From"] ?? "unknown"}`,
            `To: ${headers["To"] ?? "unknown"}`,
            `Subject: ${headers["Subject"] ?? "unknown"}`,
            `Date: ${headers["Date"] ?? "unknown"}`,
            `Body: ${bodyParts.join("\n\n")}`,
        ].join("\n");

        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        await StorageService.upload(normalizedTextKey, Buffer.from(text), "text/plain");

        await job.updateProgress(80);
        await graphQueue.add(JOB_NAMES.EXTRACT_ENTITIES, {
            evidenceId,
            caseId,
            normalizedTextKey,
            processorVersion: "1.0",
        }, { priority: JOB_PRIORITY.ENTITY_EXTRACTION });

        await job.updateProgress(100);
        return { evidenceId, normalizedTextKey };
    }
}


Copy
typescript
workers/processing.worker.ts
import { Worker, type ConnectionOptions } from "bullmq";
import { QUEUE_NAMES, JOB_NAMES } from "../queues/jobs/types";
import { createRedisConnection } from "../queues/config/redis.config";
import { EvidenceQueueService } from "../services/evidence.queue.service";
import { PdfProcessor } from "../queues/processors/processing/pdf.processor";
import { ImageProcessor } from "../queues/processors/processing/image.processor";
import { TextProcessor } from "../queues/processors/processing/text.processor";
import { SpreadsheetProcessor } from "../queues/processors/processing/spreadsheet.processor";
import { EmailProcessor } from "../queues/processors/processing/email.processor";

const worker = new Worker(QUEUE_NAMES.PROCESSING, async (job) => {
    switch (job.name) {
        case JOB_NAMES.PROCESS_PDF:         return PdfProcessor.handle(job);
        case JOB_NAMES.PROCESS_IMAGE:       return ImageProcessor.handle(job);
        case JOB_NAMES.PROCESS_TEXT:        return TextProcessor.handle(job);
        case JOB_NAMES.PROCESS_SPREADSHEET: return SpreadsheetProcessor.handle(job);
        case JOB_NAMES.PROCESS_EMAIL:       return EmailProcessor.handle(job);
        default: throw new Error(`Unknown job: ${job.name}`);
    }
}, {
    concurrency: 5,
    connection: createRedisConnection() as ConnectionOptions,
});

worker.on("failed", async (job, error) => {
    if (!job) return;
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        await EvidenceQueueService.sendToDeadLetter({
            originalQueue: QUEUE_NAMES.PROCESSING,
            originalJobName: job.name,
            originalPayload: job.data,
            failureReason: error.message,
            failedAt: new Date(),
            attempts: job.attemptsMade,
        });
    }
});

worker.on("error", (error) => console.error("Processing worker error:", error));

process.on("SIGTERM", async () => {
    await worker.close();
    process.exit(0);
});

console.log("Processing Worker Started...");


Copy
typescript
Step 5 — Graph Processor + Worker (LLM starts here)
This is the first stage that calls an LLM. The extraction processor reads normalized text, calls the LLM with a structured output prompt, stores the result JSON, then dispatches to the graph update processor which writes to Neo4j.

Install
bun add openai

Copy
bash
queues/processors/extraction.processor.ts
import type { Job } from "bullmq";
import OpenAI from "openai";
import { StorageService } from "../../services/storage.service";
import { graphQueue } from "../definitions/graph.queue";
import { JOB_NAMES, JOB_PRIORITY, type ExtractEntitiesPayload } from "../jobs/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class ExtractionProcessor {
    static async handle(job: Job<ExtractEntitiesPayload>) {
        const { evidenceId, caseId, normalizedTextKey } = job.data;

        await job.updateProgress(10);
        const buffer = await StorageService.download(normalizedTextKey);
        const text = buffer.toString("utf-8");

        await job.updateProgress(30);
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Extract entities, relationships, and events from the following evidence text.
Return a JSON object with this exact shape:
{
  "entities": [{ "id": "uuid", "type": "Person|Organization|Location|Object|Concept", "name": "string", "aliases": ["string"], "metadata": {} }],
  "relationships": [{ "fromId": "uuid", "toId": "uuid", "type": "string", "confidence": 0.0-1.0, "metadata": {} }],
  "events": [{ "title": "string", "description": "string", "occurredAt": "ISO8601 or null", "confidence": 0.0-1.0 }]
}`,
                },
                { role: "user", content: text },
            ],
            response_format: { type: "json_object" },
        });

        const extraction = JSON.parse(response.choices[0].message.content!);

        await job.updateProgress(70);
        const resultKey = `cases/${caseId}/extractions/${evidenceId}.json`;
        await StorageService.upload(
            resultKey,
            Buffer.from(JSON.stringify(extraction)),
            "application/json"
        );

        await graphQueue.add(JOB_NAMES.UPDATE_GRAPH, {
            evidenceId,
            caseId,
            extractionResultKey: resultKey,
            processorVersion: "1.0",
        }, { priority: JOB_PRIORITY.GRAPH_UPDATE });

        await job.updateProgress(100);
        return { evidenceId, resultKey, entityCount: extraction.entities.length };
    }
}


Copy
typescript
queues/processors/graph.processor.ts
import type { Job } from "bullmq";
import { StorageService } from "../../services/storage.service";
import { reasoningQueue } from "../definitions/reasoning.queue";
import { JOB_NAMES, JOB_PRIORITY, type UpdateGraphPayload } from "../jobs/types";
import driver from "../../lib/graph-driver";

export class GraphProcessor {
    static async handle(job: Job<UpdateGraphPayload>) {
        const { evidenceId, caseId, extractionResultKey } = job.data;

        await job.updateProgress(10);
        const buffer = await StorageService.download(extractionResultKey);
        const { entities, relationships, events } = JSON.parse(buffer.toString("utf-8"));

        const session = driver.session({ database: process.env.NEO4J_DATABASE });

        await job.updateProgress(30);

        // Write entities
        for (const entity of entities) {
            await session.run(
                `MERGE (e:Entity {id: $id})
                 SET e += $props, e.caseId = $caseId`,
                { id: entity.id, props: { name: entity.name, type: entity.type }, caseId }
            );
        }

        await job.updateProgress(60);

        // Write relationships
        for (const rel of relationships) {
            await session.run(
                `MATCH (a:Entity {id: $fromId}), (b:Entity {id: $toId})
                 MERGE (a)-[r:RELATES {type: $type}]->(b)
                 SET r.confidence = $confidence, r.caseId = $caseId`,
                { fromId: rel.fromId, toId: rel.toId, type: rel.type, confidence: rel.confidence, caseId }
            );
        }

        await job.updateProgress(80);
        await session.close();

        // Dispatch to reasoning queue
        await reasoningQueue.add(JOB_NAMES.GENERATE_EMBEDDINGS, {
            evidenceId,
            caseId,
            chunkKeys: [`cases/${caseId}/normalized/${evidenceId}.txt`],
            processorVersion: "1.0",
        }, { priority: JOB_PRIORITY.EMBEDDINGS });

        await job.updateProgress(100);
        return { evidenceId, entityCount: entities.length, relationshipCount: relationships.length };
    }
}



typescript
workers/graph.worker.ts
import { Worker, type ConnectionOptions } from "bullmq";
import { QUEUE_NAMES, JOB_NAMES } from "../queues/jobs/types";
import { createRedisConnection } from "../queues/config/redis.config";
import { EvidenceQueueService } from "../services/evidence.queue.service";
import { ExtractionProcessor } from "../queues/processors/extraction.processor";
import { GraphProcessor } from "../queues/processors/graph.processor";

const worker = new Worker(QUEUE_NAMES.GRAPH, async (job) => {
    switch (job.name) {
        case JOB_NAMES.EXTRACT_ENTITIES:    return ExtractionProcessor.handle(job);
        case JOB_NAMES.UPDATE_GRAPH:        return GraphProcessor.handle(job);
        default: throw new Error(`Unknown job: ${job.name}`);
    }
}, {
    concurrency: 3, // lower — LLM calls are expensive
    connection: createRedisConnection() as ConnectionOptions,
});

worker.on("failed", async (job, error) => {
    if (!job) return;
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        await EvidenceQueueService.sendToDeadLetter({
            originalQueue: QUEUE_NAMES.GRAPH,
            originalJobName: job.name,
            originalPayload: job.data,
            failureReason: error.message,
            failedAt: new Date(),
            attempts: job.attemptsMade,
        });
    }
});

worker.on("error", (error) => console.error("Graph worker error:", error));

process.on("SIGTERM", async () => {
    await worker.close();
    process.exit(0);
});

console.log("Graph Worker Started...");



typescript
Step 6 — Reasoning Processor + Worker
Install
bun add @qdrant/js-client-rest

Copy
bash
Qdrant stores vector embeddings. Run it locally with Docker:

docker run -d --name qdrant -p 6333:6333 qdrant/qdrant

Copy
bash
Add to .env:

QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=blackbox


env
queues/processors/embedding.processor.ts
import type { Job } from "bullmq";
import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { StorageService } from "../../services/storage.service";
import { reasoningQueue } from "../definitions/reasoning.queue";
import { JOB_NAMES, JOB_PRIORITY, type GenerateEmbeddingsPayload } from "../jobs/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const qdrant = new QdrantClient({ url: process.env.QDRANT_URL });

// Split text into ~500 token chunks with overlap
const chunkText = (text: string, chunkSize = 2000, overlap = 200): string[] => {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        chunks.push(text.slice(start, start + chunkSize));
        start += chunkSize - overlap;
    }
    return chunks;
};

export class EmbeddingProcessor {
    static async handle(job: Job<GenerateEmbeddingsPayload>) {
        const { evidenceId, caseId, chunkKeys } = job.data;

        await job.updateProgress(10);

        const allChunks: string[] = [];
        for (const key of chunkKeys) {
            const buffer = await StorageService.download(key);
            allChunks.push(...chunkText(buffer.toString("utf-8")));
        }

        await job.updateProgress(30);

        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: allChunks,
        });

        const points = embeddingResponse.data.map((e, i) => ({
            id: `${evidenceId}-chunk-${i}`,
            vector: e.embedding,
            payload: { evidenceId, caseId, chunkIndex: i, text: allChunks[i] },
        }));

        await job.updateProgress(70);

        await qdrant.upsert(process.env.QDRANT_COLLECTION!, { points });

        // Trigger hypothesis update for the case
        await reasoningQueue.add(JOB_NAMES.UPDATE_HYPOTHESES, {
            caseId,
            triggerReason: "new-evidence",
            newEvidenceCount: 1,
        }, { priority: JOB_


