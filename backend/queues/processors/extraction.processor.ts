import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatFireworks } from "@langchain/fireworks";
import type { Job } from "bullmq";
import z from "zod/v4";
import { JOB_NAMES, JOB_PRIORITY, type ExtractEntitiesPayload } from "../jobs/types";
import { StorageService } from "../../services/storage.service";
import { graphQueue } from "../definitions/graph.queue";
import { getDriver } from "../../lib/graph-driver";
import db from "../../lib/db";

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

// Lazy singletons — instantiated on first use so process.env is populated by then
let _model: ChatFireworks | null = null;
let _extractionChain: ReturnType<typeof buildExtractionChain> | null = null;

function getModel() {
    if (!_model) {
        console.log(`[EXTRACTION] Initialising ChatFireworks model...`);
        _model = new ChatFireworks({
            model: "accounts/fireworks/models/deepseek-v4-flash-0731",
            temperature: 0.0,
            maxRetries: 10,
            timeout: 120_000,
        });
        console.log(`[EXTRACTION] ChatFireworks model ready`);
    }
    return _model;
}

async function fetchCaseContext(caseId: string): Promise<{ entities: string; hypotheses: string }> {
    const driver = getDriver();
    const session = driver.session();

    let existingEntities = "None yet";
    let existingHypotheses = "None yet";

    try {
        // Fetch existing entities from Neo4j
        const entityResult = await session.run(
            `MATCH (e:Entity {caseId: $caseId})
             RETURN e.id as id, e.type as type, e.name as name, e.aliases as aliases
             LIMIT 50`,
            { caseId }
        );

        if (entityResult.records.length > 0) {
            existingEntities = entityResult.records.map(r => 
                `- ${r.get("name")} (${r.get("type")}) [id: ${r.get("id")}]`
            ).join("\n");
        }

        // Fetch existing hypotheses from PostgreSQL
        const hypotheses = await db.hypothesis.findMany({
            where: { caseId },
            orderBy: { confidence: "desc" },
            take: 10
        });

        if (hypotheses.length > 0) {
            existingHypotheses = hypotheses.map(h => 
                `- ${h.content} (confidence: ${h.confidence})`
            ).join("\n");
        }
    } catch (err) {
        console.warn(`[EXTRACTION] ⚠ Failed to fetch case context for caseId=${caseId}:`, (err as Error).message);
    } finally {
        await session.close();
    }

    return { entities: existingEntities, hypotheses: existingHypotheses };
}

function buildExtractionChain() {
    const prompt = ChatPromptTemplate.fromMessages([
        [
            "system",
            `You are a forensic analyst extracting structured data from evidence documents.
Rules:
- Only extract what is EXPLICITLY stated. Do not infer or assume.
- Generate a new UUID for each entity id.
- If a date is mentioned but not precise, use your best ISO8601 approximation.
- Confidence scores reflect how certain you are based on the text alone.
- REUSE existing entity IDs when the same entity is mentioned — do not create duplicates.
- Use the existing hypotheses as investigative context to focus extraction.`,
        ],
        ["human", `Evidence text to analyze:
{text}

Existing entities in this case (reuse these IDs if the same entity appears):
{entities}

Existing hypotheses in this case (context for focused extraction):
{hypotheses}

Extract entities, relationships, and events from the evidence text above.`],
    ]);
    return prompt.pipe(getModel().withStructuredOutput(ExtractionSchema));
}

function getExtractionChain() {
    if (!_extractionChain) {
        _extractionChain = buildExtractionChain();
    }
    return _extractionChain;
}

export class ExtractionProcessor {
    static async handle(job: Job<ExtractEntitiesPayload>) {
        const { evidenceId, caseId, normalizedTextKey } = job.data

        console.log(`[EXTRACTION] ▶ START evidenceId=${evidenceId} caseId=${caseId} normalizedTextKey=${normalizedTextKey}`);

        await job.updateProgress(10);
        console.log(`[EXTRACTION] Downloading normalized text from: ${normalizedTextKey}`);
        const buffer = await StorageService.download(normalizedTextKey);
        let text = buffer.toString("utf-8");
        text = text.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, " ");
        
        console.log(`[EXTRACTION] Downloaded and sanitized text: ${text.length} chars`);
        console.log(`[EXTRACTION] First 300 chars of text: "${text.substring(0, 300)}"`);
        
        const extractionKey = `cases/${caseId}/extraction/${evidenceId}.json`;

        if (text.trim().length < 100) {
            console.warn(`[EXTRACTION] ⚠ WARNING: normalized text is very short (${text.length} chars). Skipping LLM.`);
            const emptyExtraction = { entities: [], relationships: [], events: [] };
            await StorageService.upload(extractionKey, Buffer.from(JSON.stringify(emptyExtraction, null, 2)), "application/json");
            
            console.log(`[EXTRACTION] Enqueuing UPDATE_GRAPH job with empty extraction...`);
            await graphQueue.add(JOB_NAMES.UPDATE_GRAPH, {
                evidenceId,
                caseId,
                extractionResultKey: extractionKey,
                processorVersion: "1.0",
                extractionVersion: "1.0"
            }, { priority: JOB_PRIORITY.GRAPH_UPDATE });
            
            return { evidenceId, extractionKey, entityCount: 0 };
        }

        // Fetch case context (existing entities & hypotheses) for the LLM
        await job.updateProgress(15);
        console.log(`[EXTRACTION] Fetching case context (entities, hypotheses) for caseId=${caseId}...`);
        const { entities: existingEntities, hypotheses: existingHypotheses } = await fetchCaseContext(caseId);
        console.log(`[EXTRACTION] Existing entities: ${existingEntities === "None yet" ? 0 : existingEntities.split("\n").length}`);
        console.log(`[EXTRACTION] Existing hypotheses: ${existingHypotheses === "None yet" ? 0 : existingHypotheses.split("\n").length}`);

        // Truncate very long texts to avoid LLM context window overflow.
        // ~16000 chars ≈ 4000 tokens, well within model limits.
        const MAX_EXTRACTION_CHARS = 16_000;
        const truncated = text.length > MAX_EXTRACTION_CHARS;
        const textForLLM = truncated ? text.substring(0, MAX_EXTRACTION_CHARS) : text;
        if (truncated) {
            console.warn(`[EXTRACTION] ⚠ Text truncated from ${text.length} to ${MAX_EXTRACTION_CHARS} chars to avoid context overflow`);
        }

        await job.updateProgress(30);
        console.log(`[EXTRACTION] Calling LLM for entity/relationship/event extraction (sending ${textForLLM.length} chars + context)...`);
        let extraction;
        try {
            extraction = await getExtractionChain().invoke({ 
                text: textForLLM,
                entities: existingEntities,
                hypotheses: existingHypotheses
            });
        } catch (err) {
            console.error(`[EXTRACTION] ✗ LLM call FAILED for evidenceId=${evidenceId}:`, err);
            throw err;
        }
        console.log(`[EXTRACTION] LLM extraction complete — entities=${extraction.entities.length} relationships=${extraction.relationships.length} events=${extraction.events.length}`);
        console.log(`[EXTRACTION] Entities:`, JSON.stringify(extraction.entities.map(e => ({ name: e.name, type: e.type }))));
        console.log(`[EXTRACTION] Events:`, JSON.stringify(extraction.events.map(e => ({ title: e.title, occurredAt: e.occurredAt }))));

        await job.updateProgress(80);
        console.log(`[EXTRACTION] Uploading extraction result to: ${extractionKey}`);
        await StorageService.upload(extractionKey, Buffer.from(JSON.stringify(extraction, null, 2)), "application/json");
        console.log(`[EXTRACTION] Extraction JSON uploaded`);

        console.log(`[EXTRACTION] Enqueuing UPDATE_GRAPH job...`);
        const enqueued = await graphQueue.add(JOB_NAMES.UPDATE_GRAPH, {
            evidenceId,
            caseId,
            extractionResultKey: extractionKey,
            processorVersion: "1.0",
            extractionVersion: "1.0"
        }, { priority: JOB_PRIORITY.GRAPH_UPDATE });
        console.log(`[EXTRACTION] UPDATE_GRAPH job enqueued: jobId=${enqueued.id}`);

        await job.updateProgress(100);
        console.log(`[EXTRACTION] ✓ DONE evidenceId=${evidenceId} entityCount=${extraction.entities.length}`);
        return { evidenceId, extractionKey, entityCount: extraction.entities.length };
    }
}