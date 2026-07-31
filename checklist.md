# BlackBox Backend Sync Checklist

This document tracks all backend components, message processors, queues, and API routes required to achieve complete end-to-end functionality for the intelligence enclaves.

Last audited: 2026-07-30

---

## 📦 Packages

### ~~`openai`~~ — NOT required, NOT needed

The `openai` package was listed as a requirement. **This is incorrect — remove it from consideration.** The actual LLM stack is:

- **Reasoning / Extraction / Contradictions**: `@langchain/groq` → model `openai/gpt-oss-120b` via Groq's API. The "openai/" prefix is just the model name on Groq — it does NOT require an OpenAI subscription or the `openai` npm package.
- **Embeddings**: `@langchain/fireworks` → `qwen3-embedding-8b` (already installed, will remain in production)
- **Vector Store**: `@langchain/qdrant` — already installed, wraps Qdrant REST API directly. No separate `@qdrant/js-client-rest` needed.

### Backend Dependencies — current status

- [x] `@langchain/groq` — LLM for reasoning, extraction, contradictions
- [x] `@langchain/fireworks` — Fireworks embeddings (production-ready)
- [x] `@langchain/qdrant` — Qdrant vector store via LangChain
- [x] `@langchain/core` / `@langchain/textsplitters` — LangChain primitives
- [x] `@aws-sdk/client-s3` / `@aws-sdk/s3-request-presigner` — MinIO/S3 storage
- [x] `neo4j-driver` — Neo4j graph DB
- [x] `bullmq` / `ioredis` — Queue system
- [x] `pdf-parse` / `xlsx` / `tesseract.js` — Document processors
- [x] `dotenv` — Environment loading
- [ ] ~~`openai`~~ — **NOT needed. Remove from checklist.**
- [ ] ~~`@qdrant/js-client-rest`~~ — **NOT needed. `@langchain/qdrant` handles this.**

---

## 🛠️ Step 1: Storage & Driver Singletons — ✅ COMPLETE

- [x] **MinIO / S3 Storage**: `backend/services/storage.service.ts` — upload, download, delete, presigned URL
- [x] **Neo4j Driver**: `backend/lib/graph-driver.ts` — lazy `getDriver()` singleton (fixed from eager init)
- [x] **PostgreSQL / Prisma**: `backend/lib/db.ts` — Prisma client
- [x] **Redis**: `backend/queues/config/redis.config.ts` — `createRedisConnection()`

### ⚠️ Open Issues

- [x] **Typo in `.env` line 33**: `QDRANT_URL = http://loaclhost:6333` — "loaclhost" must be "localhost". All embedding and vector search operations silently fail with this typo.
- [ ] **`REDIS_HOST`/`REDIS_PORT` not in `.env`**: Relies on defaults (`localhost:6379`) — works as long as `eliza-local-redis` Docker container is up. Should be documented.
- [ ] **MinIO bucket auto-creation not guaranteed**: `StorageService` assumes bucket `black-box` exists. If MinIO is freshly started, bucket must be created manually via MinIO Console (`localhost:9001`).

---

## 🔄 Step 2: Queue Workers & Document Processors — ⚠️ PARTIALLY COMPLETE

### Queue Definitions — ✅ All defined
- [x] `ingestion.queue.ts`, `processing.queue.ts`, `graph.queue.ts`, `reasoning.queue.ts`, `dead-letter.queue.ts`, `maintainence.queue.ts`

### Workers — ⚠️ One critical gap
- [x] `workers/ingestion.worker.ts` — handles `UPLOAD_EVIDENCE`, `CLASSIFY_EVIDENCE`
- [x] `workers/graph.worker.ts` — handles `UPDATE_GRAPH`, `BUILD_TIMELINE`, `EXTRACT_ENTITIES`
- [x] `workers/reasoning.worker.ts` — handles `UPDATE_HYPOTHESES`, `GENERATE_EMBEDDINGS`, `SCAN_CONTRADICTIONS`
- [ ] **`workers/processing.worker.ts` — MISSING** — No worker file exists to consume the `processing` queue. `PROCESS_PDF`, `PROCESS_IMAGE`, `PROCESS_TEXT`, `PROCESS_SPREADSHEET`, `PROCESS_EMAIL` jobs are enqueued but **never executed**. The entire document processing pipeline is silently dead after classification.

### Document Processors — ✅ Mostly implemented (blocked by missing worker above)
- [x] `pdf.processor.ts` — parses with `pdf-parse`, uploads normalized text, queues `EXTRACT_ENTITIES`
- [x] `image.processor.ts` — OCR via `tesseract.js`, uploads normalized text, queues `EXTRACT_ENTITIES`
- [x] `spreadsheet.processor.ts` — parses with `xlsx`, serializes rows, queues `EXTRACT_ENTITIES`
- [x] `text.processor.ts` — reads buffer as UTF-8, uploads normalized text, queues `EXTRACT_ENTITIES`
- [ ] **`email.processor.ts` — MISSING** — `processJobMap` in `ingestion.processor.ts` references `PROCESS_EMAIL` but no processor file exists. Email uploads will be dispatched to a handler that is never registered.

### ⚠️ Open Issues

- [ ] **`pdf.processor.ts` uses wrong `pdf-parse` API** (lines 4, 15): Imports `{ PDFParse }` and calls `new PDFParse(buffer).getText()`. The package exports a default async function, not a class. Fix: `import pdfParse from "pdf-parse"; const result = await pdfParse(buffer);`
- [ ] **`image.processor.ts` class is named `TextProcessor`** (copy-paste error from `text.processor.ts`) — should be `ImageProcessor`.

---

## 🧠 Step 3: LLM Cognitive Pipeline — ✅ COMPLETE (modulo worker gap above)

All processors use lazy initialization (no top-level env reads at module load time):

- [x] **Entity Extraction**: `extraction.processor.ts` — Groq LLM, structured Zod output (entities, relationships, events), uploads JSON to MinIO
- [x] **Graph Insertion**: `graph.processor.ts` — writes Entity nodes + RELATIONSHIP edges to Neo4j, triggers `GENERATE_EMBEDDINGS` + `BUILD_TIMELINE`
- [x] **Timeline Building**: `graph.processor.ts` `handleBuildTimeline` — writes `TimelineEvent` rows to Postgres
- [x] **Semantic Embeddings**: `embedding.processor.ts` — Fireworks `qwen3-embedding-8b`, chunks via `RecursiveCharacterTextSplitter`, upserts to Qdrant
- [x] **Hypothesis Generation**: `reasoning.processor.ts` — Groq LLM, Qdrant similarity search for context, generates falsifiable hypotheses with confidence scores
- [x] **Contradiction Detection**: `contradictions.processor.ts` — Groq LLM, semantic search against existing evidence, stores to Postgres

### ⚠️ Open Issues

- [ ] **Field name mismatch — extraction → graph handoff** (`extraction.processor.ts:72`): Enqueues `UPDATE_GRAPH` with field `extractionKey` but `UpdateGraphPayload` type expects `extractionResultKey`. The graph processor receives `undefined` for `extractionResultKey` — **entire graph pipeline silently fails after extraction.**
- [ ] **`reasoning.processor.ts` Qdrant filter syntax**: Passes `{ must: [...] }` as a LangChain metadata filter. Verify this Qdrant-specific syntax works with the installed `@langchain/qdrant` version.
- [ ] **Model availability**: Confirm `openai/gpt-oss-120b` is available on your Groq account tier and has not been deprecated.

---

## 🔌 Step 4: REST Routes & Controllers — ✅ MOSTLY COMPLETE

All routes implemented, mounted in `index.ts`, protected by `authenticateToken`:

- [x] **Auth**: `POST /auth/register`, `POST /auth/login`
- [x] **Cases**: `GET /cases`, `POST /cases`, `GET /cases/:id` — scoped to `userId` (access control fixed)
- [x] **Evidence**: `POST /cases/:caseId/evidence`, `GET /cases/:caseId/evidence`, `GET /evidence/:id/status`, `DELETE /evidence/:id`
- [x] **Graph**: `GET /cases/:caseId/graph`
- [x] **Timeline**: `GET /cases/:caseId/timeline`
- [x] **Hypotheses**: `GET /cases/:caseId/hypotheses`, `PATCH /hypotheses/:id`, `POST /cases/:caseId/hypotheses/trigger`
- [x] **Contradictions**: `GET /cases/:caseId/contradictions`, `PATCH /contradictions/:id`, `POST /cases/:caseId/contradictions/scan`

### ⚠️ Open Issues

- [ ] **`getEvidenceByCase` returns `404` for empty evidence list** (`evidence.controller.ts:77`): Should return `200` with `{ evidence: [] }`. Currently causes "FAILED TO RETRIEVE EVIDENCE LOGS" error on any case with no uploaded files yet.
- [ ] **`updateCase` and `deleteCase` are empty stubs** (`cases.controller.ts:68,70`): Both handlers are `(req, res) => {}` — requests will hang indefinitely with no response ever sent.
- [ ] **`timeline.controller.ts` orders by `createdAt`** instead of `occuredAt` — timeline events will not appear in true chronological order of when events actually happened.

---

## 💻 Step 5: Frontend API Clients — ⚠️ INCOMPLETE

- [x] `lib/api/client.ts` — base `apiClient` fetch wrapper
- [x] `lib/api/auth.ts` — login, register
- [x] `lib/api/cases.ts` — CRUD for cases
- [x] `lib/api/evidence.ts` — upload (XHR + progress), list by case, status, delete
- [ ] **`lib/api/graph.ts` — MISSING** — No frontend client for `GET /cases/:caseId/graph`
- [ ] **`lib/api/timeline.ts` — MISSING** — No frontend client for `GET /cases/:caseId/timeline`
- [ ] **`lib/api/hypothesis.ts` — MISSING** — No frontend client for hypotheses endpoints
- [ ] **`lib/api/contradictions.ts` — MISSING** — No frontend client for contradictions endpoints
- [ ] **`frontend/.env.local` — MISSING** — `NEXT_PUBLIC_API_URL` is unset. All API clients fall back to hardcoded `http://localhost:3001`. Create `.env.local` at project root with `NEXT_PUBLIC_API_URL=http://localhost:3001`.

---

## 🖥️ Step 6: Frontend UI Views — ⚠️ INCOMPLETE

- [ ] **Graph Visualizer Panel** — Interactive entity-relationship network (Canvas/SVG with pan/zoom nodes)
- [ ] **Timeline Feed** — Chronological list of extracted case events with dates
- [ ] **Hypotheses Lab** — Confidence meter dashboard with status controls (ACTIVE / CONFIRMED / REJECTED)
- [ ] **Contradictions Alert Panel** — Warning list with severity badges and dismiss/resolve controls
- [ ] **Evidence Status Polling** — Real-time progress updates after upload (currently shows static PENDING, no polling after upload completes)
- [ ] **Case severity / status editing** — `updateCase` backend stub is empty; no frontend UI for it either

---

## 🐛 Critical Bugs — Fix Before Frontend Integration

| Priority | Location | Issue |
|---|---|---|
| 🔴 CRITICAL | `workers/` | **`processing.worker.ts` does not exist** — document pipeline never runs after classification |
| 🔴 CRITICAL | `extraction.processor.ts:72` | **`extractionKey` ≠ `extractionResultKey`** — graph processor receives `undefined`, pipeline breaks silently |
| 🔴 CRITICAL | `backend/.env:33` | **`loaclhost` typo in `QDRANT_URL`** — all vector operations fail silently |
| 🟠 HIGH | `pdf.processor.ts:4,15` | **Wrong `pdf-parse` API** — uses class syntax, will throw at runtime |
| 🟠 HIGH | `evidence.controller.ts:77` | **`getEvidenceByCase` returns 404 for empty list** — breaks frontend on new cases |
| 🟡 MEDIUM | `cases.controller.ts:68,70` | **`updateCase` / `deleteCase` are empty stubs** — requests hang indefinitely |
| 🟡 MEDIUM | `email.processor.ts` | **File missing** — email uploads queued but never processed |
| 🟡 MEDIUM | `image.processor.ts:7` | **Class named `TextProcessor`** — should be `ImageProcessor` |
| 🟡 MEDIUM | `timeline.controller.ts:9` | **Orders by `createdAt` not `occuredAt`** — wrong chronological order |
| 🟢 LOW | `prisma/schema.prisma:144` | **Typo: `occuredAt`** should be `occurredAt` (requires migration) |

---

## 🌿 `.env` Audit

| Variable | Status | Notes |
|---|---|---|
| `PORT` | ✅ | `3001` |
| `DATABASE_URL` | ✅ | Prisma Postgres cloud |
| `ACCESS_TOKEN_SECRET` | ⚠️ | Present but weak entropy — regenerate before production |
| `NEO4J_URI` / `_USERNAME` / `_PASSWORD` | ✅ | Aura free instance |
| `STORAGE_ENDPOINT` / `_ACCESS_KEY` / `_SECRET_KEY` / `_BUCKET` | ✅ | MinIO local |
| `QDRANT_URL` | ❌ | **Typo: `loaclhost`** — fix to `localhost` immediately |
| `QDRANT_COLLECTION` | ✅ | `black-box` |
| `GROQ_API_KEY` | ✅ | Present |
| `FIREWORKS_API_KEY` | ✅ | Present |
| `REDIS_HOST` / `REDIS_PORT` | ⚠️ | Not in `.env` — relies on `localhost:6379` default (uses `eliza-local-redis` container) |
| `NEXT_PUBLIC_API_URL` | ⚠️ | Frontend `.env.local` does not exist — each API file hardcodes `localhost:3001` fallback |
