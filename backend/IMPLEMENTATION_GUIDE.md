# Implementation Guide

Everything remaining to complete the pipeline end-to-end.

---

## 1. Schema — Add Missing Models

Add to `prisma/schema.prisma`:

```prisma
enum ContradictionStatus {
    OPEN
    RESOLVED
    DISMISSED
}

model Contradiction {
    id          String               @id @default(uuid())
    caseId      String
    title       String
    description String
    severity    Severity             @default(MEDIUM)
    status      ContradictionStatus  @default(OPEN)
    evidenceIds String[]
    case        Case                 @relation(fields: [caseId], references: [id])

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
}

model TimelineEvent {
    id          String   @id @default(uuid())
    caseId      String
    evidenceId  String
    title       String
    description String
    occurredAt  DateTime?
    confidence  Float
    case        Case     @relation(fields: [caseId], references: [id])

    createdAt DateTime @default(now())
}
```

Also add relations to `Case`:

```prisma
model Case {
    // ...existing fields...
    contradictions Contradiction[]
    timelineEvents TimelineEvent[]
}
```

Then run:

```bash
bun prisma migrate dev --name add-contradiction-timeline
```

---

## 2. types.ts — Add Missing Job

Add to `JOB_NAMES`:

```typescript
BUILD_TIMELINE: "build-timeline",
```

Add payload interface:

```typescript
export interface BuildTimelinePayload extends BaseJobPayload {
    extractionResultKey: string
}
```

---

## 3. graph.processor.ts — Full Implementation

Reads extraction JSON from storage, writes entities + relationships to Neo4j, dispatches `GENERATE_EMBEDDINGS`.

```typescript
import type { Job } from "bullmq";
import { getDriver } from "../../lib/graph-driver";
import { StorageService } from "../../services/storage.service";
import { reasoningQueue } from "../definitions/reasoning.queue";
import { graphQueue } from "../definitions/graph.queue";
import { JOB_NAMES, JOB_PRIORITY, type UpdateGraphPayload, type BuildTimelinePayload } from "../jobs/types";

export class GraphProcessor {
    static async handleUpdateGraph(job: Job<UpdateGraphPayload>) {
        const { evidenceId, caseId, extractionResultKey } = job.data;

        await job.updateProgress(10);
        const buffer = await StorageService.download(extractionResultKey);
        const extraction = JSON.parse(buffer.toString("utf-8"));

        await job.updateProgress(30);
        const driver = getDriver();
        const session = driver.session();

        try {
            // Upsert entities
            for (const entity of extraction.entities) {
                await session.run(
                    `MERGE (e:Entity {id: $id})
                     SET e.type = $type, e.name = $name, e.aliases = $aliases, e.caseId = $caseId`,
                    { ...entity, caseId }
                );
            }

            await job.updateProgress(60);

            // Upsert relationships
            for (const rel of extraction.relationships) {
                await session.run(
                    `MATCH (a:Entity {id: $fromId}), (b:Entity {id: $toId})
                     MERGE (a)-[r:RELATIONSHIP {type: $type, evidenceId: $evidenceId}]->(b)
                     SET r.confidence = $confidence`,
                    { ...rel, evidenceId }
                );
            }
        } finally {
            await session.close();
        }

        await job.updateProgress(80);

        // Dispatch embedding + timeline in parallel
        await Promise.all([
            reasoningQueue.add(JOB_NAMES.GENERATE_EMBEDDINGS, {
                evidenceId,
                caseId,
                chunkKeys: [extractionResultKey],
                processorVersion: "1.0",
            }, { priority: JOB_PRIORITY.EMBEDDINGS }),

            graphQueue.add(JOB_NAMES.BUILD_TIMELINE, {
                evidenceId,
                caseId,
                extractionResultKey,
                processorVersion: "1.0",
            }, { priority: JOB_PRIORITY.GRAPH_UPDATE }),
        ]);

        await job.updateProgress(100);
        return { evidenceId, entityCount: extraction.entities.length };
    }

    static async handleBuildTimeline(job: Job<BuildTimelinePayload>) {
        const { evidenceId, caseId, extractionResultKey } = job.data;

        const buffer = await StorageService.download(extractionResultKey);
        const extraction = JSON.parse(buffer.toString("utf-8"));

        const events: { title: string; description: string; occurredAt: string | null; confidence: number }[] = extraction.events;
        if (!events.length) return { evidenceId, eventCount: 0 };

        const db = (await import("../../lib/db")).default;

        await db.timelineEvent.createMany({
            data: events.map(e => ({
                caseId,
                evidenceId,
                title: e.title,
                description: e.description,
                occurredAt: e.occurredAt ? new Date(e.occurredAt) : null,
                confidence: e.confidence,
            })),
        });

        return { evidenceId, eventCount: events.length };
    }
}
```

---

## 4. contradiction.processor.ts — New File

Uses Qdrant similarity search to find evidence chunks that contradict the new evidence, then uses the LLM to confirm and describe the contradiction.

```typescript
import type { Job } from "bullmq";
import { z } from "zod/v4";
import { ChatGroq } from "@langchain/groq";
import { FireworksEmbeddings } from "@langchain/fireworks";
import { QdrantVectorStore } from "@langchain/qdrant";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StorageService } from "../../services/storage.service";
import { type ScanContradictionsPayload } from "../jobs/types";
import db from "../../lib/db";

const ContradictionSchema = z.object({
    contradictions: z.array(z.object({
        title: z.string().describe("Short title describing the contradiction"),
        description: z.string().describe("Explanation of what contradicts what, citing both pieces of evidence"),
        severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).describe("How significant is this contradiction to the case"),
        conflictingEvidenceSnippet: z.string().describe("The specific text from the existing evidence that conflicts"),
    })).describe("List of contradictions found. Empty array if none."),
});

const model = new ChatGroq({ model: "openai/gpt-oss-120b", temperature: 0, maxRetries: 10, timeout: 120_000 });

const embeddings = new FireworksEmbeddings({
    model: "accounts/fireworks/models/qwen3-embedding-8b",
    batchSize: 512,
});

const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    url: process.env.QDRANT_URL!,
    collectionName: process.env.QDRANT_COLLECTION!,
});

const contradictionChain = ChatPromptTemplate.fromMessages([
    ["system", `You are a forensic analyst identifying contradictions between pieces of evidence.
Rules:
- Only flag genuine factual contradictions, not differences in perspective.
- A contradiction means two pieces of evidence cannot both be true.
- If there are no contradictions, return an empty array.`],
    ["human", `New evidence:\n{newEvidence}\n\nExisting evidence chunks:\n{existingEvidence}\n\nIdentify any contradictions.`],
]).pipe(model.withStructuredOutput(ContradictionSchema));

export class ContradictionProcessor {
    static async handle(job: Job<ScanContradictionsPayload>) {
        const { caseId, evidenceId } = job.data;

        await job.updateProgress(10);

        // Get the normalized text for the new evidence
        const evidence = await db.evidence.findUniqueOrThrow({ where: { id: evidenceId } });
        const buffer = await StorageService.download(evidence.storageKey);
        const newEvidenceText = buffer.toString("utf-8");

        await job.updateProgress(30);

        // Find similar existing chunks — filter to this case only
        const similarChunks = await vectorStore.similaritySearch(newEvidenceText, 8, {
            must: [{ key: "metadata.caseId", match: { value: caseId } }]
        });

        if (!similarChunks.length) {
            await job.updateProgress(100);
            return { evidenceId, contradictionCount: 0 };
        }

        await job.updateProgress(50);

        const existingEvidence = similarChunks.map((c, i) => `[${i + 1}] ${c.pageContent}`).join("\n\n---\n\n");

        const result = await contradictionChain.invoke({ newEvidence: newEvidenceText, existingEvidence });

        await job.updateProgress(80);

        for (const c of result.contradictions) {
            await db.contradiction.create({
                data: {
                    caseId,
                    title: c.title,
                    description: c.description,
                    severity: c.severity,
                    evidenceIds: [evidenceId],
                },
            });
        }

        await job.updateProgress(100);
        return { evidenceId, contradictionCount: result.contradictions.length };
    }
}
```

---

## 5. Worker Updates

### reasoning.worker.ts — Add SCAN_CONTRADICTIONS

```typescript
import { ContradictionProcessor } from "../queues/processors/contradiction.processor";

// In the switch:
case JOB_NAMES.SCAN_CONTRADICTIONS:
    return ContradictionProcessor.handle(job)
```

### graph.worker.ts — New File

```typescript
import { Worker, type ConnectionOptions } from "bullmq";
import { JOB_NAMES, QUEUE_NAMES } from "../queues/jobs/types";
import { GraphProcessor } from "../queues/processors/graph.processor";
import { ExtractionProcessor } from "../queues/processors/extraction.processor";
import { EvidenceQueueService } from "../services/evidence.queue.service";
import { createRedisConnection } from "../queues/config/redis.config";

const worker = new Worker(QUEUE_NAMES.GRAPH, async (job) => {
    switch (job.name) {
        case JOB_NAMES.EXTRACT_ENTITIES:  return ExtractionProcessor.handle(job);
        case JOB_NAMES.UPDATE_GRAPH:      return GraphProcessor.handleUpdateGraph(job);
        case JOB_NAMES.BUILD_TIMELINE:    return GraphProcessor.handleBuildTimeline(job);
        default: throw new Error(`Unknown job: ${job.name}`);
    }
}, {
    concurrency: 3,
    connection: createRedisConnection() as ConnectionOptions,
});

worker.on("failed", async (job, err) => {
    if (!job) return;
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        await EvidenceQueueService.sendToDeadLetter({
            originalQueue: QUEUE_NAMES.GRAPH,
            originalJobName: job.name,
            originalPayload: job.data,
            failureReason: err.message,
            failedAt: new Date(),
            attempts: job.attemptsMade,
        });
    }
});

worker.on("error", (err) => console.error("Graph Worker error:", err));

process.on("SIGTERM", async () => { await worker.close(); process.exit(0); });

console.log("Graph Worker started...");
```

---

## 6. EvidenceQueueService — Add Missing Methods

Add to `services/evidence.queue.service.ts`:

```typescript
import { reasoningQueue } from "../queues/definitions/reasoning.queue";
import { type ScanContradictionsPayload, type UpdateHypothesesPayload } from "../queues/jobs/types";

static async enqueueScanContradictions(payload: ScanContradictionsPayload) {
    return await reasoningQueue.add(JOB_NAMES.SCAN_CONTRADICTIONS, payload, {
        priority: JOB_PRIORITY.HYPOTHESES,
    });
}

static async enqueueManualHypothesisUpdate(caseId: string) {
    return await reasoningQueue.add(JOB_NAMES.UPDATE_HYPOTHESES, {
        caseId,
        triggerReason: "manual",
    } satisfies UpdateHypothesesPayload);
}
```

---

## 7. Controllers

### hypothesis.controller.ts

```typescript
import type { Request, Response } from "express";
import db from "../lib/db";
import { EvidenceQueueService } from "../services/evidence.queue.service";

export async function getHypotheses(req: Request, res: Response) {
    const hypotheses = await db.hypothesis.findMany({
        where: { caseId: req.params.caseId },
        orderBy: { confidence: "desc" },
    });
    res.json(hypotheses);
}

export async function updateHypothesisStatus(req: Request, res: Response) {
    const hypothesis = await db.hypothesis.update({
        where: { id: req.params.id },
        data: { status: req.body.status },
    });
    res.json(hypothesis);
}

export async function triggerHypothesisUpdate(req: Request, res: Response) {
    const job = await EvidenceQueueService.enqueueManualHypothesisUpdate(req.params.caseId);
    res.json({ jobId: job.id });
}
```

### timeline.controller.ts

```typescript
import type { Request, Response } from "express";
import db from "../lib/db";

export async function getTimeline(req: Request, res: Response) {
    const events = await db.timelineEvent.findMany({
        where: { caseId: req.params.caseId },
        orderBy: { occurredAt: "asc" },
    });
    res.json(events);
}
```

### contradiction.controller.ts

```typescript
import type { Request, Response } from "express";
import db from "../lib/db";
import { EvidenceQueueService } from "../services/evidence.queue.service";

export async function getContradictions(req: Request, res: Response) {
    const contradictions = await db.contradiction.findMany({
        where: { caseId: req.params.caseId },
        orderBy: { createdAt: "desc" },
    });
    res.json(contradictions);
}

export async function updateContradictionStatus(req: Request, res: Response) {
    const contradiction = await db.contradiction.update({
        where: { id: req.params.id },
        data: { status: req.body.status },
    });
    res.json(contradiction);
}

export async function triggerContradictionScan(req: Request, res: Response) {
    const { evidenceId } = req.body;
    const job = await EvidenceQueueService.enqueueScanContradictions({
        caseId: req.params.caseId,
        evidenceId,
    });
    res.json({ jobId: job.id });
}
```

### graph.controller.ts

Queries Neo4j directly for the frontend graph view.

```typescript
import type { Request, Response } from "express";
import { getDriver } from "../lib/graph-driver";

export async function getGraph(req: Request, res: Response) {
    const { caseId } = req.params;
    const session = getDriver().session();
    try {
        const result = await session.run(
            `MATCH (e:Entity {caseId: $caseId})
             OPTIONAL MATCH (e)-[r:RELATIONSHIP]->(t:Entity {caseId: $caseId})
             RETURN e, r, t`,
            { caseId }
        );

        const nodes = new Map();
        const edges: object[] = [];

        for (const record of result.records) {
            const e = record.get("e").properties;
            const t = record.get("t")?.properties;
            const r = record.get("r")?.properties;

            nodes.set(e.id, e);
            if (t) nodes.set(t.id, t);
            if (r) edges.push({ ...r, from: e.id, to: t?.id });
        }

        res.json({ nodes: Array.from(nodes.values()), edges });
    } finally {
        await session.close();
    }
}
```

---

## 8. Routes

### routes/hypothesis.ts

```typescript
import { Router } from "express";
import { authenticate } from "../middleware/middleware.auth";
import { getHypotheses, updateHypothesisStatus, triggerHypothesisUpdate } from "../controllers/hypothesis.controller";

const router = Router();

router.get("/cases/:caseId/hypotheses", authenticate, getHypotheses);
router.patch("/hypotheses/:id", authenticate, updateHypothesisStatus);
router.post("/cases/:caseId/hypotheses/trigger", authenticate, triggerHypothesisUpdate);

export default router;
```

### routes/timeline.ts

```typescript
import { Router } from "express";
import { authenticate } from "../middleware/middleware.auth";
import { getTimeline } from "../controllers/timeline.controller";

const router = Router();

router.get("/cases/:caseId/timeline", authenticate, getTimeline);

export default router;
```

### routes/reasoning.ts (contradictions)

```typescript
import { Router } from "express";
import { authenticate } from "../middleware/middleware.auth";
import { getContradictions, updateContradictionStatus, triggerContradictionScan } from "../controllers/contradiction.controller";

const router = Router();

router.get("/cases/:caseId/contradictions", authenticate, getContradictions);
router.patch("/contradictions/:id", authenticate, updateContradictionStatus);
router.post("/cases/:caseId/contradictions/scan", authenticate, triggerContradictionScan);

export default router;
```

### routes/graph.ts

```typescript
import { Router } from "express";
import { authenticate } from "../middleware/middleware.auth";
import { getGraph } from "../controllers/graph.controller";

const router = Router();

router.get("/cases/:caseId/graph", authenticate, getGraph);

export default router;
```

---

## 9. index.ts — Wire All Routes

```typescript
import hypothesisRoutes from "./routes/hypothesis";
import timelineRoutes from "./routes/timeline";
import reasoningRoutes from "./routes/reasoning";
import graphRoutes from "./routes/graph";

app.use("/", hypothesisRoutes);
app.use("/", timelineRoutes);
app.use("/", reasoningRoutes);
app.use("/", graphRoutes);
```

---

## 10. Qdrant Filter Syntax

`QdrantVectorStore.similaritySearch` accepts Qdrant's native `QdrantFilter` type — **not** a plain
key-value object. The type only allows `must`, `should`, `must_not`, `min_should` at the top level,
each containing `FieldCondition` objects.

To filter by a metadata field stored on the Qdrant payload:

```typescript
import type { QdrantFilter } from "@langchain/qdrant";

// Correct — FieldCondition with key + match.value
const filter: QdrantFilter = {
    must: [{ key: "metadata.caseId", match: { value: caseId } }]
};

await vectorStore.similaritySearch(query, 10, filter);
```

The `key` path is `metadata.caseId` because LangChain stores `Document.metadata` under a
`metadata` key in the Qdrant payload.

The previous `{ should: { caseId } }` and `{ caseId }` forms are both wrong — they don't match
the `QdrantFilter` type and TypeScript will reject them. `reasoning.processor.ts` has been
fixed already. Apply the same pattern in `contradiction.processor.ts`.

---

## Implementation Order

1. Schema migration (step 1) — everything else depends on this
2. `types.ts` additions (step 2)
3. `graph.processor.ts` (step 3) — unblocks the full pipeline
4. `contradiction.processor.ts` (step 4)
5. Worker updates (step 5) — `graph.worker.ts` + reasoning worker patch
6. `EvidenceQueueService` additions (step 6)
7. Controllers + routes + index.ts wiring (steps 7–9)
8. Fix Qdrant filter in `reasoning.processor.ts` (step 10)
