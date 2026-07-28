import { ChatPromptTemplate } from "@langchain/core/prompts";
import { FireworksEmbeddings } from "@langchain/fireworks";
import { ChatGroq } from "@langchain/groq";
import { QdrantVectorStore } from "@langchain/qdrant";
import type { Job } from "bullmq";
import { z } from "zod/v4";
import type { ScanContradictionsPayload } from "../jobs/types";
import db from "../../lib/db";
import { StorageService } from "../../services/storage.service";

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

        const evidence = await db.evidence.findUniqueOrThrow({
            where: {
                id: evidenceId,
            },
            select: {
                storageKey: true,
            },
        })
        const buffer = await StorageService.download(evidence.storageKey);
        const newEvidenceText = buffer.toString("utf-8");

        await job.updateProgress(30);

        const similarChunks = await vectorStore.similaritySearch(
            newEvidenceText,
            10,
            {
                must: [
                    {
                        key: "metadata.caseId",
                        match: {
                            value: caseId,
                        }
                    }]
            }
        )

        if (!similarChunks.length) {
            await job.updateProgress(100);
            return { evidenceId, contradictions: [] };
        }

        const existingEvidenceText = similarChunks.map(chunk => chunk.pageContent).join("\n---\n");

        const result = await contradictionChain.invoke({
            newEvidence: newEvidenceText,
            existingEvidence: existingEvidenceText,
        });

        await job.updateProgress(80);

        for (const c of result.contradictions) {
            await db.contradictions.create({
                data: {
                    caseId,
                    title: c.title,
                    description: c.description,
                    evidenceIds: [evidenceId]
                }
            })
        }

        await job.updateProgress(100);
        return { evidenceId, contradictionCount: result.contradictions.length };
    }
}