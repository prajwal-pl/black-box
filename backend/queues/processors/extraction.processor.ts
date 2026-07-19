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
        id: z.string().describe("The unique identifier for the entity"),
        type: z.enum(["Person", "Organization", "Location", "Object", "Concept"]),
        name: z.string(),
        aliases: z.array(z.string())
    })),
    relationships: z.array(z.object({
        fromId: z.string(),
        toId: z.string(),
        type: z.string().describe("The type of relationship between the entities, for eg. WORKS_FOR, LOCATED_AT, OWNS, etc."),
        confidence: z.number().min(0).max(1).describe("A confidence score between 0 and 1 indicating the model's confidence in the relationship.")
    })),
    events: z.array(z.object({
        title: z.string(),
        description: z.string(),
        occuredAt: z.string().describe("ISO8601 date string or null if unknown"),
        confidence: z.number().min(0).max(1).describe("A confidence score between 0 and 1 indicating the model's confidence in the event.")
    }))
})

// const model = new ChatFireworks({
//     model: "accounts/fireworks/models/"
// })
const model = new ChatGroq({
    model: "openai/gpt-oss-120b"
})

const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a forensic analyst. Extract all the entities, relationships, and events from the evidence text. Only extract what is explicitly stated in the text, do not infer."],
    ["human", "{text}"]
]);

const extractionChain = prompt.pipe(model.withStructuredOutput(ExtractionSchema));

export class ExtractionProcessor {
    static async handle(job: Job<ExtractEntitiesPayload>) {
        const { evidenceId, caseId, normalizedTextKey } = job.data

        await job.updateProgress(10);
        const buffer = await StorageService.download(normalizedTextKey);
        const text = buffer.toString("utf-8");

        await job.updateProgress(30);
        const extraction = await extractionChain.invoke({ text });

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