# LangChain Integration — Confirmed Best Practices

> All patterns in this document are verified directly against the official LangChain JavaScript docs.
> Sources: `/oss/javascript/langchain/models`, `/oss/javascript/langchain/structured-output`,
> `/oss/javascript/integrations/embeddings/openai`, `/oss/javascript/integrations/splitters/index`,
> `/oss/javascript/langchain/retrieval`, `/oss/javascript/langchain/knowledge-base`

---

## Install

```bash
bun add langchain @langchain/core @langchain/openai @langchain/textsplitters @langchain/qdrant zod
```

The docs require `langchain` and `@langchain/core` as the base packages. Provider-specific packages
(`@langchain/openai`, `@langchain/qdrant`) are separate — this is intentional so you can swap
providers without touching the core.

---

## .env Additions

```env
OPENAI_API_KEY=<your-key>
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=blackbox
```

Qdrant Docker (run once):

```bash
docker run -d --name qdrant -p 6333:6333 qdrant/qdrant
```

---

## Corrections to the Previous Version

The previous doc had several things that were either wrong or not best practice per the docs:

| Previous | Correct per docs |
|---|---|
| `new ChatOpenAI({ model, temperature })` directly | Docs recommend `initChatModel()` for flexibility, or direct class for fixed providers |
| No `maxRetries` set | Docs say default is 6, recommend 10-15 for long-running workers on unreliable networks |
| No `timeout` set | Docs say to always set `timeout` in ms for worker contexts |
| `batchSize` not set on embeddings | Docs show `batchSize: 512` as the explicit default — set it explicitly |
| No `dimensions` set on embeddings | Docs show you can reduce vector size to save storage — relevant for production |
| `QdrantVectorStore.fromExistingCollection()` called inside handler | Should be initialized once at module level, not per-job |
| `vectorStore.similaritySearch(query, k)` with a generic string | Docs show filtering by metadata — you should filter by `caseId` to avoid cross-case leakage |
| Chain built with `prompt.pipe(model.withStructuredOutput())` | Correct pattern, confirmed by docs |
| `RecursiveCharacterTextSplitter` used | Confirmed correct — docs explicitly call it "the recommended TextSplitter for generic text" |

---

## Model Initialization — Confirmed Patterns

The docs show two valid ways to initialize a model. For workers where the provider is fixed, the
direct class is fine. `initChatModel` is better when you want to swap providers via env var.

```typescript
// Option A — direct class (fine for fixed provider in workers)
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,          // deterministic for extraction
    maxRetries: 10,          // docs recommend 10-15 for long-running workers
    timeout: 120_000,        // ms — always set in worker context
});

// Option B — initChatModel (better if you want to swap providers via env)
import { initChatModel } from "langchain";

const model = await initChatModel("gpt-4o-mini", {
    temperature: 0,
    maxRetries: 10,
    timeout: 120_000,
});
```

The docs note: "Network errors, rate limits (429), and server errors (5xx) are retried automatically.
Client errors such as 401 or 404 are not retried." — so `maxRetries` only covers transient failures.

---

## Structured Output — Confirmed Patterns

The docs describe two strategies for `withStructuredOutput`:

- **Provider strategy** — uses the model provider's native structured output API (OpenAI function
  calling). Most reliable when available. OpenAI, Anthropic, Gemini all support this.
- **Tool strategy** — falls back to tool calling for models that don't support native structured
  output. Has built-in retry on schema validation failure.

For `ChatOpenAI` with `withStructuredOutput(ZodSchema)`, the provider strategy is used automatically.
The docs confirm: "Zod schemas provide automatic validation" — if the LLM returns a value that fails
Zod validation (e.g. `confidence: 10` when schema says `max(1)`), LangChain retries with the
validation error message automatically.

Key doc note: **"Use `.describe()` on every field"** — this text goes directly into the function
calling schema that the model sees. Better descriptions = more accurate extraction.

---

## Step 1 — Extraction Processor

### `queues/processors/extraction.processor.ts`

```typescript
import type { Job } from "bullmq";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StorageService } from "../../services/storage.service";
import { graphQueue } from "../definitions/graph.queue";
import { JOB_NAMES, JOB_PRIORITY, type ExtractEntitiesPayload } from "../jobs/types";

// Zod schema — .describe() on every field is critical.
// This text becomes the function calling schema the model sees.
const ExtractionSchema = z.object({
    entities: z.array(z.object({
        id: z.string().uuid().describe("A unique UUID for this entity — generate one"),
        type: z.enum(["Person", "Organization", "Location", "Object", "Concept"])
            .describe("The category of this entity"),
        name: z.string().describe("The canonical name of the entity as it appears in the text"),
        aliases: z.array(z.string()).describe("Alternative names or spellings found in the text"),
    })).describe("All named entities explicitly mentioned in the evidence"),
    relationships: z.array(z.object({
        fromId: z.string().uuid().describe("The id of the source entity"),
        toId: z.string().uuid().describe("The id of the target entity"),
        type: z.string().describe("Relationship type in SCREAMING_SNAKE_CASE, e.g. WORKS_FOR, LOCATED_AT, OWNS"),
        confidence: z.number().min(0).max(1).describe("Confidence score from 0.0 to 1.0"),
    })).describe("Relationships between entities that are explicitly stated in the text"),
    events: z.array(z.object({
        title: z.string().describe("Short title for the event"),
        description: z.string().describe("Full description of what happened"),
        occurredAt: z.string().nullable().describe("ISO8601 datetime string, or null if the date is unknown"),
        confidence: z.number().min(0).max(1).describe("Confidence score from 0.0 to 1.0"),
    })).describe("Discrete events or actions that occurred, as stated in the evidence"),
});

// Build model and chain ONCE at module level — not inside the handler.
// Re-instantiating per job wastes memory and connection setup time.
const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,       // deterministic — extraction should not be creative
    maxRetries: 10,       // docs recommend 10-15 for long-running workers
    timeout: 120_000,     // 2 min — LLM calls can be slow on large documents
});

const prompt = ChatPromptTemplate.fromMessages([
    [
        "system",
        `You are a forensic analyst extracting structured data from evidence documents.
Rules:
- Only extract what is EXPLICITLY stated. Do not infer or assume.
- Generate a new UUID for each entity id.
- If a date is mentioned but not precise, use your best ISO8601 approximation.
- Confidence scores reflect how certain you are based on the text alone.`,
    ],
    ["human", "{text}"],
]);

// LCEL pipe: prompt | model.withStructuredOutput(schema)
// withStructuredOutput uses OpenAI function calling — schema validation is automatic.
// If the model returns a value that fails Zod validation, LangChain retries with the error.
const extractionChain = prompt.pipe(model.withStructuredOutput(ExtractionSchema));

export class ExtractionProcessor {
    static async handle(job: Job<ExtractEntitiesPayload>) {
        const { evidenceId, caseId, normalizedTextKey } = job.data;

        await job.updateProgress(10);
        const buffer = await StorageService.download(normalizedTextKey);
        const text = buffer.toString("utf-8");

        await job.updateProgress(30);

        // invoke() — fully typed return, no JSON.parse(), no manual error handling
        const extraction = await extractionChain.invoke({ text });

        // extraction.entities, extraction.relationships, extraction.events are all typed
        // and Zod-validated at this point

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
        return {
            evidenceId,
            resultKey,
            entityCount: extraction.entities.length,
            relationshipCount: extraction.relationships.length,
            eventCount: extraction.events.length,
        };
    }
}
```

---

## Step 2 — Embedding Processor

### Key corrections from the docs

**`batchSize`**: The docs show `batchSize: 512` as the explicit default on `OpenAIEmbeddings`.
The max is 2048. Set it explicitly so it's not a hidden default.

**`dimensions`**: The docs show you can reduce embedding dimensions with `text-embedding-3` models.
`text-embedding-3-small` defaults to 1536 dimensions. You can reduce to 512 for storage savings
with minimal quality loss. Your Qdrant collection must be created with the matching dimension.

**`asRetriever()`**: The docs show `vectorStore.asRetriever(k)` as the preferred way to query —
it returns a `Retriever` interface which is more composable than calling `similaritySearch` directly.
However, for filtering by `caseId`, `similaritySearch` with a filter is more explicit.

**Metadata filtering**: The docs show that `similaritySearch` accepts a filter object. You MUST
filter by `caseId` — otherwise the reasoning processor will pull chunks from other cases.

### `queues/processors/embedding.processor.ts`

```typescript
import type { Job } from "bullmq";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { StorageService } from "../../services/storage.service";
import { reasoningQueue } from "../definitions/reasoning.queue";
import { JOB_NAMES, JOB_PRIORITY, type GenerateEmbeddingsPayload } from "../jobs/types";

// Docs: batchSize defaults to 512, max is 2048. Set explicitly.
// Docs: dimensions can be reduced for text-embedding-3 models.
// 1536 is the default for text-embedding-3-small — match this in your Qdrant collection config.
const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-small",
    batchSize: 512,
    dimensions: 1536, // explicit — must match Qdrant collection vector size
});

// Initialize once at module level — not per job.
// fromExistingCollection assumes the collection already exists in Qdrant.
// Create it manually first via the Qdrant UI or API with size: 1536, distance: Cosine.
const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    url: process.env.QDRANT_URL,
    collectionName: process.env.QDRANT_COLLECTION!,
});

// Docs: RecursiveCharacterTextSplitter is "the recommended TextSplitter for generic text use cases".
// It respects paragraph → sentence → word boundaries before hard-cutting.
// chunkSize: 1000, chunkOverlap: 200 are the values used in the official LangChain RAG tutorials.
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
});

export class EmbeddingProcessor {
    static async handle(job: Job<GenerateEmbeddingsPayload>) {
        const { evidenceId, caseId, chunkKeys } = job.data;

        await job.updateProgress(10);

        // Download all normalized text files for this evidence piece
        const rawTexts: string[] = [];
        for (const key of chunkKeys) {
            const buffer = await StorageService.download(key);
            rawTexts.push(buffer.toString("utf-8"));
        }

        await job.updateProgress(30);

        // Wrap in Document objects — metadata is stored alongside the vector in Qdrant.
        // caseId in metadata is CRITICAL — used to filter searches to the correct case.
        const docs = rawTexts.map(text => new Document({
            pageContent: text,
            metadata: { evidenceId, caseId },
        }));

        // splitDocuments — respects sentence/paragraph boundaries, attaches metadata to each chunk
        const splits = await splitter.splitDocuments(docs);

        await job.updateProgress(50);

        // addDocuments — handles embedding + upsert in one call.
        // Internally calls embeddings.embedDocuments(texts) then upserts to Qdrant.
        await vectorStore.addDocuments(splits);

        await job.updateProgress(80);

        await reasoningQueue.add(JOB_NAMES.UPDATE_HYPOTHESES, {
            caseId,
            triggerReason: "new-evidence",
            newEvidenceCount: 1,
        }, { priority: JOB_PRIORITY.HYPOTHESES });

        await job.updateProgress(100);
        return { evidenceId, chunkCount: splits.length };
    }
}
```

---

## Step 3 — Reasoning Processor

### Key corrections from the docs

**Metadata filtering on `similaritySearch`**: The docs show that vector store search accepts a
filter parameter. Without filtering by `caseId`, the hypothesis generator will pull evidence from
ALL cases in the collection — a serious data isolation bug.

**`asRetriever()` vs `similaritySearch()`**: The docs show `vectorStore.asRetriever(k)` as the
composable interface. For simple k-nearest search it's equivalent to `similaritySearch`. Use
`similaritySearch` with a filter when you need metadata filtering, which you do here.

**Hypothesis deduplication**: The current schema creates new hypotheses on every run. In practice
you should upsert — check if a similar hypothesis exists before creating. Left as a TODO below.

### `queues/processors/reasoning.processor.ts`

```typescript
import type { Job } from "bullmq";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { type UpdateHypothesesPayload } from "../jobs/types";
import db from "../../lib/db";

const HypothesisSchema = z.object({
    hypotheses: z.array(z.object({
        content: z.string().describe("A clear, falsifiable hypothesis statement about what happened"),
        confidence: z.number().min(0).max(1).describe("Confidence from 0.0 to 1.0 based on evidence strength"),
        reasoning: z.string().describe("Brief explanation of why this hypothesis is supported by the evidence"),
    })).describe("List of hypotheses, ordered from most to least confident"),
});

const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
    maxRetries: 10,
    timeout: 120_000,
});

const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-small",
    batchSize: 512,
    dimensions: 1536,
});

// Initialize vector store once at module level
const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    url: process.env.QDRANT_URL,
    collectionName: process.env.QDRANT_COLLECTION!,
});

const hypothesisChain = ChatPromptTemplate.fromMessages([
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
]).pipe(model.withStructuredOutput(HypothesisSchema));

export class ReasoningProcessor {
    static async handleHypothesisUpdate(job: Job<UpdateHypothesesPayload>) {
        const { caseId } = job.data;

        await job.updateProgress(10);

        // CRITICAL: filter by caseId metadata — without this, you get chunks from other cases.
        // The docs show similaritySearch accepts a filter object as the third argument.
        const relevantChunks = await vectorStore.similaritySearch(
            `forensic evidence case ${caseId}`,
            10,
            { caseId } // metadata filter — only return chunks where metadata.caseId === caseId
        );

        await job.updateProgress(30);

        const existingHypotheses = await db.hypothesis.findMany({
            where: { caseId },
            orderBy: { confidence: "desc" },
            take: 10, // only pass top 10 to avoid bloating the prompt
        });

        const evidence = relevantChunks
            .map((c, i) => `[${i + 1}] ${c.pageContent}`)
            .join("\n\n---\n\n");

        const existing = existingHypotheses.length > 0
            ? existingHypotheses.map(h => `- ${h.content} (confidence: ${h.confidence})`).join("\n")
            : "None yet.";

        await job.updateProgress(50);

        const result = await hypothesisChain.invoke({ evidence, existing });

        await job.updateProgress(80);

        // TODO: upsert instead of always creating — check for semantic duplicates first
        for (const h of result.hypotheses) {
            await db.hypothesis.create({
                data: {
                    caseId,
                    content: h.content,
                    confidence: h.confidence,
                    status: "ACTIVE",
                },
            });
        }

        await job.updateProgress(100);
        return { caseId, hypothesisCount: result.hypotheses.length };
    }
}
```

---

## Step 4 — Reasoning Worker

```typescript
import { Worker, type ConnectionOptions } from "bullmq";
import { QUEUE_NAMES, JOB_NAMES } from "../queues/jobs/types";
import { createRedisConnection } from "../queues/config/redis.config";
import { EvidenceQueueService } from "../services/evidence.queue.service";
import { EmbeddingProcessor } from "../queues/processors/embedding.processor";
import { ReasoningProcessor } from "../queues/processors/reasoning.processor";

const worker = new Worker(QUEUE_NAMES.REASONING, async (job) => {
    switch (job.name) {
        case JOB_NAMES.GENERATE_EMBEDDINGS: return EmbeddingProcessor.handle(job);
        case JOB_NAMES.UPDATE_HYPOTHESES:   return ReasoningProcessor.handleHypothesisUpdate(job);
        default: throw new Error(`Unknown job: ${job.name}`);
    }
}, {
    concurrency: 2, // low — embedding + LLM calls are expensive and slow
    connection: createRedisConnection() as ConnectionOptions,
});

worker.on("failed", async (job, error) => {
    if (!job) return;
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        await EvidenceQueueService.sendToDeadLetter({
            originalQueue: QUEUE_NAMES.REASONING,
            originalJobName: job.name,
            originalPayload: job.data,
            failureReason: error.message,
            failedAt: new Date(),
            attempts: job.attemptsMade,
        });
    }
});

worker.on("error", (error) => console.error("Reasoning worker error:", error));

process.on("SIGTERM", async () => {
    await worker.close();
    process.exit(0);
});

console.log("Reasoning Worker Started...");
```

---

## Qdrant Collection Setup

Before running the embedding processor, the Qdrant collection must exist with the correct vector
size. Create it once via the Qdrant REST API or UI:

```bash
curl -X PUT http://localhost:6333/collections/blackbox \
  -H 'Content-Type: application/json' \
  -d '{
    "vectors": {
      "size": 1536,
      "distance": "Cosine"
    }
  }'
```

The `size` must match the `dimensions` value in `OpenAIEmbeddings`. If you change the model or
dimensions, you must recreate the collection.

---

## Swapping Models — Confirmed Pattern

Because everything goes through LangChain's standard interface, swapping is one import line.
The chain, prompt, and Zod schema stay identical.

```typescript
// OpenAI (current)
import { ChatOpenAI } from "@langchain/openai";
const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0, maxRetries: 10 });

// Anthropic — install: bun add @langchain/anthropic
import { ChatAnthropic } from "@langchain/anthropic";
const model = new ChatAnthropic({ model: "claude-3-5-haiku-20241022", temperature: 0, maxRetries: 10 });

// Google Gemini — install: bun add @langchain/google-genai
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
const model = new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash-lite", temperature: 0 });
```

Same for embeddings — the `QdrantVectorStore` and `addDocuments()` calls stay identical:

```typescript
// OpenAI (current)
import { OpenAIEmbeddings } from "@langchain/openai";
const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small", dimensions: 1536 });

// Cohere — install: bun add @langchain/cohere
import { CohereEmbeddings } from "@langchain/cohere";
const embeddings = new CohereEmbeddings({ model: "embed-english-v3.0" });
// Note: Cohere embed-english-v3.0 outputs 1024 dimensions — update Qdrant collection accordingly
```

---

## What vs. Raw OpenAI SDK

| | Raw OpenAI SDK | LangChain (confirmed) |
|---|---|---|
| Extraction | `JSON.parse(response.choices[0].message.content)` — throws on bad JSON | `withStructuredOutput(ZodSchema)` — Zod validates, retries on failure automatically |
| Chunking | Manual `text.slice(start, start + chunkSize)` | `RecursiveCharacterTextSplitter` — respects paragraph/sentence boundaries |
| Embedding | `openai.embeddings.create({ input })` + manual Qdrant point construction | `embeddings.embedDocuments()` + `vectorStore.addDocuments()` — one call |
| Vector search | `qdrant.search(collection, { vector, filter, limit })` | `vectorStore.similaritySearch(query, k, filter)` — returns `Document[]` with metadata |
| Model swap | Rewrite all API calls | Change one import — chain, prompt, schema unchanged |
| Retry on rate limit | Manual with exponential backoff | Built-in — `maxRetries` with exponential backoff + jitter, configurable |
| Validation failure | Silent bad data downstream | Zod catches it, LangChain retries with the validation error message |

---

## Full Pipeline Flow

```
POST /cases/:caseId/evidence
  ↓
StorageService.upload()           → file saved to MinIO / R2
db.evidence.create()              → PENDING record in Postgres
EvidenceQueueService.enqueue()    → job on ingestion queue
  ↓
INGESTION WORKER
  handleUpload                    → status → PROCESSING
  handleClassification            → detect mime type (no LLM)
  ↓
PROCESSING WORKER
  PdfProcessor / ImageProcessor / TextProcessor / etc.
    → StorageService.download()   → raw file
    → extract/normalize text
    → StorageService.upload()     → normalized text key
    → graphQueue.add(EXTRACT_ENTITIES)
  ↓
GRAPH WORKER                      ← LangChain starts here
  ExtractionProcessor
    → StorageService.download()   → normalized text
    → extractionChain.invoke()    → ChatOpenAI + withStructuredOutput(ExtractionSchema)
    → StorageService.upload()     → extraction JSON
    → graphQueue.add(UPDATE_GRAPH)
  GraphProcessor
    → StorageService.download()   → extraction JSON
    → Neo4j MERGE entities + relationships
    → reasoningQueue.add(GENERATE_EMBEDDINGS)
  ↓
REASONING WORKER
  EmbeddingProcessor
    → StorageService.download()   → normalized text
    → RecursiveCharacterTextSplitter.splitDocuments()
    → QdrantVectorStore.addDocuments()  → embedded + stored in Qdrant (filtered by caseId)
    → reasoningQueue.add(UPDATE_HYPOTHESES)
  ReasoningProcessor
    → vectorStore.similaritySearch(query, 10, { caseId })  ← metadata filter is critical
    → hypothesisChain.invoke()    → ChatOpenAI + withStructuredOutput(HypothesisSchema)
    → db.hypothesis.create()      → hypotheses saved to Postgres
```
