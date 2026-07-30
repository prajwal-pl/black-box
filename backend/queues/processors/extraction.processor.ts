import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatFireworks } from "@langchain/fireworks"
import { ChatGroq } from "@langchain/groq"
import type { Job } from "bullmq";
import z from "zod/v4";
import { JOB_NAMES, JOB_PRIORITY, type ExtractEntitiesPayload } from "../jobs/types";
import { StorageService } from "../../services/storage.service";
import { graphQueue } from "../definitions/graph.queue";

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
let _model: ChatGroq | null = null;
let _extractionChain: ReturnType<typeof buildExtractionChain> | null = null;

function getModel() {
    if (!_model) {
        _model = new ChatGroq({
            model: "openai/gpt-oss-120b",
            temperature: 0.0,
            maxRetries: 10,
            timeout: 120_000,
        });
    }
    return _model;
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
- Confidence scores reflect how certain you are based on the text alone.`,
        ],
        ["human", "{text}"],
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

        await job.updateProgress(10);
        const buffer = await StorageService.download(normalizedTextKey);
        const text = buffer.toString("utf-8");

        await job.updateProgress(30);
        const extraction = await getExtractionChain().invoke({ text });

        await job.updateProgress(80);
        const extractionKey = `cases/${caseId}/extraction/${evidenceId}.json`;
        await StorageService.upload(extractionKey, Buffer.from(JSON.stringify(extraction, null, 2)), "application/json");

        await graphQueue.add(JOB_NAMES.UPDATE_GRAPH, {
            evidenceId,
            caseId,
            extractionKey,
            extractionVersion: "1.0"
        }, { priority: JOB_PRIORITY.GRAPH_UPDATE });

        await job.updateProgress(100);
        return { evidenceId, extractionKey, entityCount: extraction.entities.length };
    }
}