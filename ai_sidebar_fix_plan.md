# AI Sidebar — Fix Plan

## Summary

The `CaseAIPanel` component is rendered on **5 pages** (Evidence, Hypotheses, Contradictions, Graph, Timeline), but it is entirely non-functional because **the backend has no `/ai/chat` endpoint**. The frontend is wired correctly — it sends requests and handles both streaming SSE and JSON responses — but the target API simply does not exist.

---

## Root Cause

The component ([`components/case/case-ai-panel.tsx`](file:///home/prajwal/code/projects/black-box/components/case/case-ai-panel.tsx)) POSTs to:

```
POST /ai/chat
```

The backend [`index.ts`](file:///home/prajwal/code/projects/black-box/backend/index.ts) registers these routes:

```
/auth       → authRoutes
/cases      → casesRoutes
/           → evidenceRoutes
/           → hypothesisRoutes
/           → timelineRoutes
/           → reasoningRoutes  (only contains /contradictions endpoints)
/           → graphRoutes
```

There is **no `/ai` route or controller** anywhere in the backend. The endpoint is missing entirely.

---

## What the Frontend Expects

From [`case-ai-panel.tsx` L170–L193](file:///home/prajwal/code/projects/black-box/components/case/case-ai-panel.tsx#L170-L193):

### Request

```
POST http://localhost:3001/ai/chat
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "message": "user's question",
  "context": {
    "type": "Evidence Ingestion Pipeline" | "Hypothesis Lab Reasoning Engine" | "Contradiction Scanner" | "Graph Intelligence" | "Timeline Intelligence",
    "selectedItem": "filename or null"
  },
  "history": [
    { "role": "user" | "assistant", "content": "..." },
    ...  (last 10 messages)
  ]
}
```

### Response (two accepted formats)

**Option A — Streaming SSE** (`Content-Type: text/event-stream`):
```
data: {"delta":"chunk of text"}
data: {"delta":"more text"}
data: [DONE]
```

**Option B — JSON** (`Content-Type: application/json`):
```json
{ "reply": "Full response text" }
```

The component parses: `data.reply ?? data.message ?? data.content ?? data.text`

---

## What Already Exists (Can Be Reused)

The backend **already has all the AI infrastructure** set up:

| Component | Location | Purpose |
|---|---|---|
| `ChatFireworks` LLM | [`reasoning.processor.ts`](file:///home/prajwal/code/projects/black-box/backend/queues/processors/reasoning.processor.ts) | DeepSeek model via Fireworks AI |
| `ChatGroq` LLM | Imported but available | Groq LLaMA models |
| `QdrantVectorStore` | [`embedding.processor.ts`](file:///home/prajwal/code/projects/black-box/backend/queues/processors/embedding.processor.ts) | Semantic vector search over case evidence |
| `FireworksEmbeddings` | Both processors | `qwen3-embedding-8b` model |
| `FIREWORKS_API_KEY` | [`backend/.env`](file:///home/prajwal/code/projects/black-box/backend/.env) | ✅ Already set |
| `GROQ_API_KEY` | [`backend/.env`](file:///home/prajwal/code/projects/black-box/backend/.env) | ✅ Already set |
| `QDRANT_URL` + `QDRANT_COLLECTION` | [`backend/.env`](file:///home/prajwal/code/projects/black-box/backend/.env) | ✅ Already set |
| JWT `authenticateToken` middleware | [`middleware.auth.ts`](file:///home/prajwal/code/projects/black-box/backend/middleware/middleware.auth.ts) | ✅ Already working |
| Prisma DB (`evidence`, `hypothesis`, `contradictions`, etc.) | [`prisma/schema.prisma`](file:///home/prajwal/code/projects/black-box/backend/prisma/schema.prisma) | ✅ Full schema exists |

---

## Implementation Plan

### Step 1 — Create the AI Controller

**File to create:** `backend/controllers/ai.controller.ts`

This controller should:

1. Accept the POST body `{ message, context, history }`.
2. Use the `context.type` to build a **context-aware system prompt** (see context types below).
3. **Optionally** perform a Qdrant vector search using the `message` as the query, filtered by `caseId` (if available). This grounds the AI's response in actual case evidence already ingested.
4. Build a LangChain `ChatPromptTemplate` with:
   - System prompt (role + context type + any retrieved evidence chunks)
   - Chat history (from `history` array)
   - Human message (from `message`)
5. Stream the response back using SSE, or return JSON if streaming fails.

**Context types and system prompts to implement:**

| `context.type` | System Prompt Focus |
|---|---|
| `Evidence Ingestion Pipeline` | Forensic analyst specializing in document analysis, OCR, file parsing |
| `Hypothesis Lab Reasoning Engine` | Forensic reasoning engine that generates and challenges hypotheses |
| `Contradiction Scanner` | Analyst identifying logical contradictions across evidence |
| `Graph Intelligence` | Entity and relationship extraction specialist |
| `Timeline Intelligence` | Temporal analyst reconstructing event sequences |

**caseId extraction:** The `context.selectedItem` contains file names or IDs, not the caseId. The caseId needs to be passed either as part of the request body or as a URL param (e.g., `POST /ai/chat/:caseId`). **The frontend currently doesn't pass caseId** — this is a secondary gap (see Step 4).

---

### Step 2 — Create the AI Route

**File to create:** `backend/routes/ai.ts`

```typescript
import { Router } from "express";
import { authenticateToken } from "../middleware/middleware.auth";
import { chatHandler } from "../controllers/ai.controller";

const router = Router();

// Option A: without caseId in URL (no Qdrant RAG)
router.post("/chat", authenticateToken, chatHandler);

// Option B: with caseId for RAG-grounded responses (recommended)
router.post("/chat/:caseId", authenticateToken, chatHandler);

export default router;
```

---

### Step 3 — Register the Route in `backend/index.ts`

**File to edit:** [`backend/index.ts`](file:///home/prajwal/code/projects/black-box/backend/index.ts)

Add the following:
```diff
+ import aiRoutes from "./routes/ai";

  app.use("/auth", authRoutes);
  app.use("/cases", casesRoutes);
  app.use("/", evidenceRoutes);
  app.use("/", hypothesisRoutes);
  app.use("/", timelineRoutes);
  app.use("/", reasoningRoutes);
  app.use("/", graphRoutes);
+ app.use("/ai", aiRoutes);
```

---

### Step 4 — Update the Frontend to Pass `caseId`

**File to edit:** [`components/case/case-ai-panel.tsx`](file:///home/prajwal/code/projects/black-box/components/case/case-ai-panel.tsx)

Currently the component posts to `/ai/chat` without any case context. To enable RAG (Retrieval Augmented Generation) from the Qdrant vector store, the `caseId` must be provided.

**Changes needed:**

1. Add a `caseId` prop to `CaseAIPanelProps`:
   ```typescript
   interface CaseAIPanelProps {
     ...
     caseId?: string;  // add this
   }
   ```

2. Update the fetch URL from:
   ```typescript
   const response = await fetch(`${BASE_URL}/ai/chat`, { ... })
   ```
   to:
   ```typescript
   const chatUrl = caseId ? `${BASE_URL}/ai/chat/${caseId}` : `${BASE_URL}/ai/chat`;
   const response = await fetch(chatUrl, { ... });
   ```

3. Update all 5 page call-sites to pass `caseId`:
   - [`evidence/page.tsx` L364](file:///home/prajwal/code/projects/black-box/app/cases/[id]/evidence/page.tsx#L364) — add `caseId={caseId}`
   - [`hypotheses/page.tsx` L226](file:///home/prajwal/code/projects/black-box/app/cases/[id]/hypotheses/page.tsx#L226) — add `caseId={caseId}`
   - [`contradictions/page.tsx` L249](file:///home/prajwal/code/projects/black-box/app/cases/[id]/contradictions/page.tsx) — add `caseId={caseId}`
   - [`graph/page.tsx` L489](file:///home/prajwal/code/projects/black-box/app/cases/[id]/graph/page.tsx) — add `caseId={caseId}`
   - [`timeline/page.tsx` L200](file:///home/prajwal/code/projects/black-box/app/cases/[id]/timeline/page.tsx) — add `caseId={caseId}`

---

## Recommended AI Controller Architecture

```
POST /ai/chat/:caseId
  │
  ├── 1. Validate JWT (middleware)
  ├── 2. Parse body: { message, context, history }
  ├── 3. Qdrant vector search (filter by caseId)  ← RAG grounding
  │       Uses: FireworksEmbeddings + QdrantVectorStore
  ├── 4. Build system prompt from context.type
  ├── 5. Build LangChain ChatPromptTemplate
  │       [system] → role + evidence chunks
  │       [history] → past messages
  │       [human] → message
  ├── 6. Stream response via SSE  (res.setHeader "text/event-stream")
  │       OR return JSON { reply: "..." }
  └── 7. Handle AbortController / connection drops
```

**Recommended LLM:** `ChatGroq` with `llama-3.3-70b-versatile` or `ChatFireworks` with `deepseek-v4-flash-0731` (both keys are already in `.env`).

**Streaming pattern** (using LangChain `.stream()`):
```typescript
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");

const stream = await chain.stream({ ... });
for await (const chunk of stream) {
  res.write(`data: ${JSON.stringify({ delta: chunk.content })}\n\n`);
}
res.write("data: [DONE]\n\n");
res.end();
```

---

## Files to Create / Edit — Summary

| Action | File | Notes |
|---|---|---|
| ✅ CREATE | `backend/controllers/ai.controller.ts` | Main chat logic with RAG + streaming |
| ✅ CREATE | `backend/routes/ai.ts` | Route binding with auth middleware |
| ✅ EDIT | `backend/index.ts` | Register `/ai` route |
| ✅ EDIT | `components/case/case-ai-panel.tsx` | Add `caseId` prop, update URL |
| ✅ EDIT | `app/cases/[id]/evidence/page.tsx` | Pass `caseId` to panel |
| ✅ EDIT | `app/cases/[id]/hypotheses/page.tsx` | Pass `caseId` to panel |
| ✅ EDIT | `app/cases/[id]/contradictions/page.tsx` | Pass `caseId` to panel |
| ✅ EDIT | `app/cases/[id]/graph/page.tsx` | Pass `caseId` to panel |
| ✅ EDIT | `app/cases/[id]/timeline/page.tsx` | Pass `caseId` to panel |

---

## Notes & Edge Cases

- **No `caseId` fallback:** If the panel is ever rendered outside a case context, the `/ai/chat` (no caseId) endpoint should still work — just without Qdrant RAG, replying from the LLM's general knowledge.
- **Qdrant must be running:** The RAG path requires `QDRANT_URL` to be reachable. If Qdrant is down, the controller should gracefully fall back to non-RAG responses rather than crashing.
- **CORS:** The backend already has `app.use(cors())` — no changes needed.
- **Streaming + Express 5:** Express 5 is already in use (`"express": "^5.2.1"`). SSE streaming with `res.write` works fine.
- **LangChain version:** `@langchain/core: ^1.2.3` — use `.stream()` on the chain for streaming support; this is the modern API.
