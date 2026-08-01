# BlackBox Backend Sync Checklist

This document tracks all backend components, message processors, queues, and API routes required to achieve complete end-to-end functionality for the intelligence enclaves.

Last audited: 2026-08-01

---

## 📦 Packages

### ~~`openai`~~ — NOT required, NOT needed

The `openai` package was listed as a requirement. **This is incorrect — remove it from consideration.** The actual LLM stack is:

- **Reasoning / Extraction / Contradictions**: `@langchain/groq` → model `openai/gpt-oss-120b` via Groq's API. The "openai/" prefix is just the model name on Groq — it does NOT require an OpenAI subscription or the `openai` npm package.
- **Embeddings**: `@langchain/fireworks` → `qwen3-embedding-8b` (already installed, will remain in production)
- **Vector Store**: `@langchain/qdrant` — already installed, wraps Qdrant REST API directly. No separate `@qdrant/js-client-rest` needed.

### Backend Dependencies — ✅ All present

- [x] `@langchain/groq` — LLM for reasoning, extraction, contradictions
- [x] `@langchain/fireworks` — Fireworks embeddings (production-ready)
- [x] `@langchain/qdrant` — Qdrant vector store via LangChain
- [x] `@langchain/core` / `@langchain/textsplitters` — LangChain primitives
- [x] `@aws-sdk/client-s3` / `@aws-sdk/s3-request-presigner` — MinIO/S3 storage
- [x] `neo4j-driver` — Neo4j graph DB
- [x] `bullmq` / `ioredis` — Queue system
- [x] `pdf-parse` / `xlsx` / `tesseract.js` — Document processors
- [x] `dotenv` — Environment loading

---

## 🛠️ Step 1: Storage & Driver Singletons — ✅ COMPLETE

- [x] **MinIO / S3 Storage**: `backend/services/storage.service.ts` — upload, download, delete, presigned URL
- [x] **Neo4j Driver**: `backend/lib/graph-driver.ts` — lazy `getDriver()` singleton
- [x] **PostgreSQL / Prisma**: `backend/lib/db.ts` — Prisma client
- [x] **Redis**: `backend/queues/config/redis.config.ts` — `createRedisConnection()`
- [x] **`QDRANT_URL` typo fixed**: `loaclhost` → `localhost` in `backend/.env`

### ⚠️ Remaining Notes

- [ ] **`REDIS_HOST`/`REDIS_PORT` not in `.env`**: Relies on defaults (`localhost:6379`) — works as long as `eliza-local-redis` Docker container is up.
- [ ] **MinIO bucket not auto-created**: `StorageService` assumes bucket `black-box` exists. On a fresh MinIO start, create it manually via MinIO Console (`localhost:9001`).

---

## 🔄 Step 2: Queue Workers & Document Processors — ✅ COMPLETE

### Queue Definitions — ✅ All defined
- [x] `ingestion.queue.ts`, `processing.queue.ts`, `graph.queue.ts`, `reasoning.queue.ts`, `dead-letter.queue.ts`, `maintainence.queue.ts`

### Workers — ✅ All created
- [x] `workers/ingestion.worker.ts` — handles `UPLOAD_EVIDENCE`, `CLASSIFY_EVIDENCE`
- [x] `workers/graph.worker.ts` — handles `UPDATE_GRAPH`, `BUILD_TIMELINE`, `EXTRACT_ENTITIES`
- [x] `workers/reasoning.worker.ts` — handles `UPDATE_HYPOTHESES`, `GENERATE_EMBEDDINGS`, `SCAN_CONTRADICTIONS`
- [x] `workers/processing.worker.ts` — **created** — handles all `PROCESS_*` jobs, updates evidence status in DB on completion/failure, dead-letters after retry exhaustion

### Document Processors — ✅ All implemented
- [x] `pdf.processor.ts` — fixed to use correct `pdf-parse` v2 class API (`new PDFParse({ data: buffer }).getText()`)
- [x] `image.processor.ts` — OCR via `tesseract.js`; class renamed `ImageProcessor` (was `TextProcessor`)
- [x] `spreadsheet.processor.ts` — parses with `xlsx`, serializes rows to CSV-style text
- [x] `text.processor.ts` — reads buffer as UTF-8, uploads normalized text
- [x] `email.processor.ts` — **created** — parses RFC-2822 headers (From, To, Subject, Date) + body into normalized text

---

## 🧠 Step 3: LLM Cognitive Pipeline — ✅ COMPLETE

All processors use lazy initialization (no top-level env reads at module load time):

- [x] **Entity Extraction**: `extraction.processor.ts` — Groq LLM, structured Zod output (entities, relationships, events), uploads JSON to MinIO. **Fixed**: field name mismatch `extractionKey` → `extractionResultKey` in `UPDATE_GRAPH` job payload.
- [x] **Graph Insertion**: `graph.processor.ts` — writes Entity nodes + RELATIONSHIP edges to Neo4j, triggers `GENERATE_EMBEDDINGS` + `BUILD_TIMELINE`
- [x] **Timeline Building**: `graph.processor.ts` `handleBuildTimeline` — writes `TimelineEvent` rows to Postgres
- [x] **Semantic Embeddings**: `embedding.processor.ts` — Fireworks `qwen3-embedding-8b`, chunks via `RecursiveCharacterTextSplitter`, upserts to Qdrant
- [x] **Hypothesis Generation**: `reasoning.processor.ts` — Groq LLM, Qdrant similarity search for context, generates falsifiable hypotheses with confidence scores
- [x] **Contradiction Detection**: `contradictions.processor.ts` — Groq LLM, semantic search against existing evidence, stores to Postgres

### ⚠️ Remaining Notes

- [ ] **`reasoning.processor.ts` Qdrant filter syntax**: Passes `{ must: [...] }` as a LangChain metadata filter. Verify this Qdrant-specific syntax works with the installed `@langchain/qdrant` version at runtime.
- [ ] **Model availability**: Confirm `openai/gpt-oss-120b` is available on your Groq account tier and has not been deprecated.

---

## 🔌 Step 4: REST Routes & Controllers — ✅ COMPLETE

All routes implemented, mounted in `index.ts`, protected by `authenticateToken`:

- [x] **Auth**: `POST /auth/register`, `POST /auth/login`
- [x] **Cases**: `GET /cases`, `POST /cases`, `GET /cases/:id`, `PUT /cases/:id`, `DELETE /cases/:id` — all scoped to `userId`. **Fixed**: `updateCase` and `deleteCase` were empty stubs, now fully implemented.
- [x] **Evidence**: `POST /cases/:caseId/evidence`, `GET /cases/:caseId/evidence`, `GET /evidence/:id/status`, `DELETE /evidence/:id`. **Fixed**: `getEvidenceByCase` now returns `200` with `{ evidence: [] }` instead of `404` on empty.
- [x] **Graph**: `GET /cases/:caseId/graph`
- [x] **Timeline**: `GET /cases/:caseId/timeline` — **Fixed**: now orders by `occuredAt` (true event date) with `createdAt` as fallback.
- [x] **Hypotheses**: `GET /cases/:caseId/hypotheses`, `PATCH /hypotheses/:id`, `POST /cases/:caseId/hypotheses/trigger`
- [x] **Contradictions**: `GET /cases/:caseId/contradictions`, `PATCH /contradictions/:id`, `POST /cases/:caseId/contradictions/scan`

---

## 💻 Step 5: Frontend API Clients — ✅ COMPLETE

- [x] `lib/api/client.ts` — base `apiClient` fetch wrapper
- [x] `lib/api/auth.ts` — login, register
- [x] `lib/api/cases.ts` — CRUD for cases
- [x] `lib/api/evidence.ts` — upload (XHR + progress), list by case, status, delete
- [x] `lib/api/graph.ts` — Relational Graph data fetches
- [x] `lib/api/timeline.ts` — Chronological event list fetches
- [x] `lib/api/hypothesis.ts` — Hypothesis generation controls
- [x] `lib/api/contradictions.ts` — Discrepancies and contradiction triggers
- [x] `frontend/.env.local` — Created with `NEXT_PUBLIC_API_URL=http://localhost:3001`

---

## 🖥️ Step 6: Frontend UI Views — ✅ COMPLETE

- [x] **Graph Visualizer Panel** — Interactive entity-relationship network (Canvas/SVG with spring force layout)
- [x] **Timeline Feed** — Chronological timeline stream of evidence events
- [x] **Hypotheses Lab** — Hypothesis workbench with status and confidence controls
- [x] **Contradictions Alert Panel** — Discrepancies listing, resolution updates, and manual scanning triggers
- [x] **Evidence Status Polling** — Multi-step status updates automatically trigger querying logic
- [ ] **Case severity / status editing** — Backend supports it; frontend UI details page can show editable metadata fields in future scope


---

## 🐛 Bug Tracker

| Priority | Location | Issue | Status |
|---|---|---|---|
| 🔴 CRITICAL | `workers/` | `processing.worker.ts` missing — document pipeline never ran | ✅ Fixed |
| 🔴 CRITICAL | `extraction.processor.ts` | `extractionKey` ≠ `extractionResultKey` — graph pipeline silently broken | ✅ Fixed |
| 🔴 CRITICAL | `backend/.env` | `loaclhost` typo in `QDRANT_URL` — all vector ops failed | ✅ Fixed |
| 🟠 HIGH | `pdf.processor.ts` | Wrong `pdf-parse` v2 API — would throw at runtime | ✅ Fixed |
| 🟠 HIGH | `evidence.controller.ts` | `getEvidenceByCase` returned 404 for empty list | ✅ Fixed |
| 🟡 MEDIUM | `cases.controller.ts` | `updateCase` / `deleteCase` were empty stubs | ✅ Fixed |
| 🟡 MEDIUM | `email.processor.ts` | File missing — email uploads never processed | ✅ Fixed |
| 🟡 MEDIUM | `image.processor.ts` | Class named `TextProcessor` instead of `ImageProcessor` | ✅ Fixed |
| 🟡 MEDIUM | `timeline.controller.ts` | Ordered by `createdAt` not `occuredAt` | ✅ Fixed |
| 🟢 LOW | `prisma/schema.prisma` | Typo: `occuredAt` should be `occurredAt` | ⏳ Pending (requires migration) |

---

## 🌿 `.env` Audit

| Variable | Status | Notes |
|---|---|---|
| `PORT` | ✅ | `3001` |
| `DATABASE_URL` | ✅ | Prisma Postgres cloud |
| `ACCESS_TOKEN_SECRET` | ⚠️ | Present but weak entropy — regenerate before production |
| `NEO4J_URI` / `_USERNAME` / `_PASSWORD` | ✅ | Aura free instance |
| `STORAGE_ENDPOINT` / `_ACCESS_KEY` / `_SECRET_KEY` / `_BUCKET` | ✅ | MinIO local |
| `QDRANT_URL` | ✅ | Fixed — `localhost:6333` |
| `QDRANT_COLLECTION` | ✅ | `black-box` |
| `GROQ_API_KEY` | ✅ | Present |
| `FIREWORKS_API_KEY` | ✅ | Present |
| `REDIS_HOST` / `REDIS_PORT` | ⚠️ | Not in `.env` — relies on `localhost:6379` default (`eliza-local-redis` container) |
| `NEXT_PUBLIC_API_URL` | ⚠️ | Frontend `.env.local` does not exist — each API file hardcodes `localhost:3001` fallback |
