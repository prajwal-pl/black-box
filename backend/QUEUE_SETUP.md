# Evidence Intelligence Pipeline — Queue Infrastructure

## 1. Install Dependencies

```bash
bun add bullmq ioredis
bun add -d @types/ioredis
```

---

## 2. Project Structure

```
backend/
├── queues/
│   ├── config/
│   │   └── redis.config.ts
│   ├── definitions/
│   │   ├── ingestion.queue.ts
│   │   ├── processing.queue.ts
│   │   ├── graph.queue.ts
│   │   ├── reasoning.queue.ts
│   │   ├── maintenance.queue.ts
│   │   └── dead-letter.queue.ts
│   ├── jobs/
│   │   └── types.ts
│   └── processors/
│       ├── ingestion.processor.ts
│       ├── classification.processor.ts
│       ├── processing/
│       │   ├── pdf.processor.ts
│       │   ├── image.processor.ts
│       │   ├── spreadsheet.processor.ts
│       │   └── text.processor.ts
│       ├── extraction.processor.ts
│       ├── graph.processor.ts
│       ├── embedding.processor.ts
│       └── reasoning.processor.ts
├── workers/
│   ├── ingestion.worker.ts
│   ├── processing.worker.ts
│   ├── graph.worker.ts
│   ├── reasoning.worker.ts
│   └── maintenance.worker.ts
└── services/
    └── evidence.queue.service.ts
```

---

## 3. Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

---

## 4. Implementation

### `queues/config/redis.config.ts`

```typescript
import Redis from "ioredis";

export const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || "0"),
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
};

export const createRedisConnection = () => new Redis(redisConfig);
```

---

### `queues/jobs/types.ts`

> All job payloads are lean references — workers fetch data themselves. Never put data blobs in payloads.

```typescript
// ─── Queue Names ──────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  INGESTION:   "ingestion",
  PROCESSING:  "processing",
  GRAPH:       "graph",
  REASONING:   "reasoning",
  MAINTENANCE: "maintenance",
  DEAD_LETTER: "dead-letter",
} as const;

// ─── Job Names ────────────────────────────────────────────────────────────────

export const JOB_NAMES = {
  // Ingestion Queue
  UPLOAD_EVIDENCE:     "upload-evidence",
  CLASSIFY_EVIDENCE:   "classify-evidence",

  // Processing Queue
  PROCESS_PDF:         "process-pdf",
  PROCESS_IMAGE:       "process-image",
  PROCESS_SPREADSHEET: "process-spreadsheet",
  PROCESS_TEXT:        "process-text",
  PROCESS_EMAIL:       "process-email",

  // Graph Queue
  EXTRACT_ENTITIES:    "extract-entities",
  EXTRACT_RELATIONS:   "extract-relations",
  UPDATE_GRAPH:        "update-graph",

  // Reasoning Queue
  GENERATE_EMBEDDINGS: "generate-embeddings",
  UPDATE_HYPOTHESES:   "update-hypotheses",
  SCAN_CONTRADICTIONS: "scan-contradictions",

  // Maintenance Queue
  MERGE_ENTITIES:      "merge-entities",
  RESOLVE_ALIASES:     "resolve-aliases",
  DETECT_DUPLICATES:   "detect-duplicates",
  CLEANUP_JOBS:        "cleanup-jobs",

  // Dead Letter
  DEAD_LETTER:         "dead-letter",
} as const;

// ─── Evidence Classification ──────────────────────────────────────────────────

export type EvidenceType =
  | "pdf"
  | "image"
  | "spreadsheet"
  | "text"
  | "email"
  | "audio"
  | "video"
  | "unknown";

// ─── Job Priorities ───────────────────────────────────────────────────────────

export const JOB_PRIORITY = {
  OCR:               10,
  ENTITY_EXTRACTION: 9,
  GRAPH_UPDATE:      8,
  EMBEDDINGS:        7,
  HYPOTHESES:        6,
  REPORTS:           5,
  CLEANUP:           1,
} as const;

// ─── Base Payload ─────────────────────────────────────────────────────────────

export interface BaseJobPayload {
  evidenceId:        string;
  caseId:            string;
  processorVersion:  string;
  extractionVersion?: string;
}

// ─── Ingestion Queue Payloads ─────────────────────────────────────────────────

export interface UploadEvidencePayload extends BaseJobPayload {
  storageKey:  string;
  mimeType:    string;
  fileName:    string;
  fileSize:    number;
  uploadedBy:  string;
}

export interface ClassifyEvidencePayload extends BaseJobPayload {
  storageKey: string;
  mimeType:   string;
}

// ─── Processing Queue Payloads ────────────────────────────────────────────────

export interface ProcessEvidencePayload extends BaseJobPayload {
  storageKey:    string;
  evidenceType:  EvidenceType;
}

// ─── Graph Queue Payloads ─────────────────────────────────────────────────────

export interface ExtractEntitiesPayload extends BaseJobPayload {
  normalizedTextKey: string; // Storage key to normalized text output
}

export interface UpdateGraphPayload extends BaseJobPayload {
  extractionResultKey: string; // Storage key to extraction output
}

// ─── Reasoning Queue Payloads ─────────────────────────────────────────────────

export interface GenerateEmbeddingsPayload extends BaseJobPayload {
  chunkKeys: string[]; // Storage keys to text chunks
}

export interface UpdateHypothesesPayload {
  caseId:           string;
  triggerReason:    "new-evidence" | "contradiction-detected" | "manual";
  newEvidenceCount?: number;
}

export interface ScanContradictionsPayload {
  caseId:      string;
  evidenceId:  string;
}

// ─── Maintenance Queue Payloads ───────────────────────────────────────────────

export interface MergeEntitiesPayload {
  caseId:       string;
  entityIds:    string[];
  canonicalId:  string;
}

export interface DeadLetterPayload {
  originalQueue:    string;
  originalJobName:  string;
  originalPayload:  unknown;
  failureReason:    string;
  failedAt:         string;
  attempts:         number;
}
```

---

### `queues/definitions/ingestion.queue.ts`

```typescript
import { Queue } from "bullmq";
import { createRedisConnection } from "../config/redis.config";
import { QUEUE_NAMES } from "../jobs/types";

export const ingestionQueue = new Queue(QUEUE_NAMES.INGESTION, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
```

> Repeat the same pattern for `processing.queue.ts`, `graph.queue.ts`, `reasoning.queue.ts`, `maintenance.queue.ts`, and `dead-letter.queue.ts` — only the queue name changes.

---

### `services/evidence.queue.service.ts`

> Single entry point for all routes to enqueue evidence. Routes never import queues directly.

```typescript
import { ingestionQueue }   from "../queues/definitions/ingestion.queue";
import { maintenanceQueue } from "../queues/definitions/maintenance.queue";
import { deadLetterQueue }  from "../queues/definitions/dead-letter.queue";
import {
  JOB_NAMES,
  JOB_PRIORITY,
  UploadEvidencePayload,
  MergeEntitiesPayload,
  DeadLetterPayload,
} from "../queues/jobs/types";

export class EvidenceQueueService {

  // Called by the upload route immediately after file is saved to storage
  static async enqueueEvidenceUpload(payload: UploadEvidencePayload) {
    return ingestionQueue.add(JOB_NAMES.UPLOAD_EVIDENCE, payload, {
      priority: JOB_PRIORITY.OCR,
    });
  }

  // Called by ingestion processor after upload is confirmed
  static async enqueueClassification(payload: UploadEvidencePayload) {
    return ingestionQueue.add(JOB_NAMES.CLASSIFY_EVIDENCE, payload);
  }

  // Called when entity merging is needed
  static async enqueueMergeEntities(payload: MergeEntitiesPayload) {
    return maintenanceQueue.add(JOB_NAMES.MERGE_ENTITIES, payload, {
      priority: JOB_PRIORITY.CLEANUP,
    });
  }

  // Called when a job exhausts all retries
  static async sendToDeadLetter(payload: DeadLetterPayload) {
    return deadLetterQueue.add(JOB_NAMES.DEAD_LETTER, payload);
  }

  // Get job status
  static async getJobStatus(jobId: string) {
    const job = await ingestionQueue.getJob(jobId);
    if (!job) return null;

    return {
      id:           job.id,
      name:         job.name,
      state:        await job.getState(),
      progress:     job.progress,
      failedReason: job.failedReason,
      processedOn:  job.processedOn,
      finishedOn:   job.finishedOn,
    };
  }

  // Queue health stats
  static async getQueueStats() {
    const queues = { ingestionQueue, maintenanceQueue };
    const stats: Record<string, object> = {};

    for (const [name, queue] of Object.entries(queues)) {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);
      stats[name] = { waiting, active, completed, failed, delayed };
    }

    return stats;
  }
}
```

---

### `queues/processors/ingestion.processor.ts`

```typescript
import { Job } from "bullmq";
import { processingQueue } from "../definitions/processing.queue";
import { ingestionQueue }  from "../definitions/ingestion.queue";
import {
  JOB_NAMES,
  JOB_PRIORITY,
  UploadEvidencePayload,
  ClassifyEvidencePayload,
  EvidenceType,
} from "../jobs/types";
import db from "../../lib/db";

// Deterministic classification — no LLM
const classifyByMimeType = (mimeType: string): EvidenceType => {
  if (mimeType === "application/pdf")                           return "pdf";
  if (mimeType.startsWith("image/"))                           return "image";
  if (mimeType.startsWith("text/"))                            return "text";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "spreadsheet";
  if (mimeType.includes("mail"))                               return "email";
  if (mimeType.startsWith("audio/"))                           return "audio";
  if (mimeType.startsWith("video/"))                           return "video";
  return "unknown";
};

const processorJobMap: Record<EvidenceType, string> = {
  pdf:         JOB_NAMES.PROCESS_PDF,
  image:       JOB_NAMES.PROCESS_IMAGE,
  spreadsheet: JOB_NAMES.PROCESS_SPREADSHEET,
  text:        JOB_NAMES.PROCESS_TEXT,
  email:       JOB_NAMES.PROCESS_EMAIL,
  audio:       JOB_NAMES.PROCESS_TEXT, // placeholder
  video:       JOB_NAMES.PROCESS_TEXT, // placeholder
  unknown:     JOB_NAMES.PROCESS_TEXT,
};

export class IngestionProcessor {

  static async handleUpload(job: Job<UploadEvidencePayload>) {
    const { evidenceId, caseId, storageKey, mimeType } = job.data;

    await job.updateProgress(10);

    await db.evidence.update({
      where: { id: evidenceId },
      data:  { status: "PROCESSING" },
    });

    await job.updateProgress(50);

    await ingestionQueue.add(JOB_NAMES.CLASSIFY_EVIDENCE, {
      evidenceId,
      caseId,
      storageKey,
      mimeType,
      processorVersion: "1.0",
    });

    await job.updateProgress(100);
    return { evidenceId, status: "queued-for-classification" };
  }

  static async handleClassification(job: Job<ClassifyEvidencePayload>) {
    const { evidenceId, caseId, storageKey, mimeType } = job.data;

    await job.updateProgress(20);

    const evidenceType  = classifyByMimeType(mimeType);
    const processorJob  = processorJobMap[evidenceType];

    await job.updateProgress(60);

    await processingQueue.add(processorJob, {
      evidenceId,
      caseId,
      storageKey,
      evidenceType,
      processorVersion: "1.0",
    }, {
      priority: evidenceType === "image"
        ? JOB_PRIORITY.OCR
        : JOB_PRIORITY.ENTITY_EXTRACTION,
    });

    await job.updateProgress(100);
    return { evidenceId, evidenceType, dispatchedTo: processorJob };
  }
}
```

---

### `workers/ingestion.worker.ts`

```typescript
import { Worker } from "bullmq";
import { createRedisConnection }  from "../queues/config/redis.config";
import { QUEUE_NAMES, JOB_NAMES } from "../queues/jobs/types";
import { IngestionProcessor }     from "../queues/processors/ingestion.processor";
import { EvidenceQueueService }   from "../services/evidence.queue.service";

const worker = new Worker(
  QUEUE_NAMES.INGESTION,
  async (job) => {
    switch (job.name) {
      case JOB_NAMES.UPLOAD_EVIDENCE:   return IngestionProcessor.handleUpload(job);
      case JOB_NAMES.CLASSIFY_EVIDENCE: return IngestionProcessor.handleClassification(job);
      default: throw new Error(`Unknown job: ${job.name}`);
    }
  },
  {
    connection:  createRedisConnection(),
    concurrency: 10,
  }
);

worker.on("failed", async (job, error) => {
  if (!job) return;

  if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
    await EvidenceQueueService.sendToDeadLetter({
      originalQueue:   QUEUE_NAMES.INGESTION,
      originalJobName: job.name,
      originalPayload: job.data,
      failureReason:   error.message,
      failedAt:        new Date().toISOString(),
      attempts:        job.attemptsMade,
    });
  }
});

worker.on("error", (error) => console.error("Ingestion worker error:", error));

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});

console.log("🚀 Ingestion worker started");
```

> Repeat the same worker pattern for `processing.worker.ts`, `graph.worker.ts`, `reasoning.worker.ts`, and `maintenance.worker.ts` — only the queue name, job names, and processor calls change.

---

## 5. Full Pipeline Flow

```
POST /documents/upload
  ↓
EvidenceQueueService.enqueueEvidenceUpload()
  ↓
INGESTION QUEUE → handleUpload → update Postgres status
  ↓
INGESTION QUEUE → handleClassification → detect type (no LLM)
  ↓
PROCESSING QUEUE → PDFProcessor / ImageProcessor / SpreadsheetProcessor
  ↓
GRAPH QUEUE → extract entities, relationships, events  ← LLM starts here
  ↓
GRAPH QUEUE → update Neo4j
  ↓
REASONING QUEUE → generate embeddings → Qdrant
  ↓
REASONING QUEUE → update hypotheses / scan contradictions
  ↓
MAINTENANCE QUEUE → merge entities, resolve aliases (Mike Chen = Michael Chen)
```

---

## 6. Running the System

```bash
# Terminal 1 — Redis
docker run -d --name redis-queue -p 6379:6379 redis

# Terminal 2 — API Server
bun run index.ts

# Terminal 3 — Ingestion Worker
bun run workers/ingestion.worker.ts

# Terminal 4 — Processing Worker
bun run workers/processing.worker.ts

# Terminal 5 — Graph Worker
bun run workers/graph.worker.ts

# Terminal 6 — Reasoning Worker
bun run workers/reasoning.worker.ts
```

Or use pm2 in production:

```bash
bun add -g pm2
pm2 start workers/ingestion.worker.ts  --interpreter bun
pm2 start workers/processing.worker.ts --interpreter bun
pm2 start workers/graph.worker.ts      --interpreter bun
pm2 start workers/reasoning.worker.ts  --interpreter bun
```

---

## 7. Key Architectural Decisions

| Decision | Reason |
|---|---|
| Lean payloads (IDs only) | Avoids large Redis memory usage |
| Classification is deterministic | No LLM cost for mime type detection |
| One queue per pipeline stage | Operationally manageable, independently scalable |
| Dead letter queue | Investigators can manually retry failed evidence |
| Workers are separate processes | API stays fast, workers scale independently |
| LLM only starts at extraction stage | Reduces cost, keeps early stages fast |
