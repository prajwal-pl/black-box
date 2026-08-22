import { task, tasks } from "@trigger.dev/sdk";
import { EmbeddingProcessor } from "../../queues/processors/embedding.processor";
import type { GenerateEmbeddingsPayload } from "../../types/task-payloads";
import type { updateHypothesesTask } from "./hypotheses.task";
import type { scanContradictionsTask } from "./contradictions.task";
import db from "../../lib/db";

/**
 * Generates vector embeddings and stores them in Qdrant.
 * Fan-out: triggers both update-hypotheses and scan-contradictions after completion.
 */
export const generateEmbeddingsTask = task({
    id: "generate-embeddings",
    machine: "micro",
    maxDuration: 600, // 10 min — large document chunking + Qdrant upsert batches
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 5_000 },

    onFailure: async ({ payload, error }) => {
        console.error(`[TASK:EMBED] ✗ All retries exhausted for evidenceId=${payload.evidenceId}. Marking FAILED.`, (error as Error).message);
        try {
            await db.evidence.update({ where: { id: payload.evidenceId }, data: { status: "FAILED" } });
        } catch (dbErr) {
            console.error(`[TASK:EMBED] Failed to update status to FAILED:`, dbErr);
        }
    },

    run: async (payload: GenerateEmbeddingsPayload) => {
        console.log(`[TASK:EMBED] Generating embeddings for evidenceId=${payload.evidenceId}`);

        await db.evidence.update({ where: { id: payload.evidenceId }, data: { status: "GENERATING_EMBEDDINGS" } });
        console.log(`[TASK:EMBED] Evidence status → GENERATING_EMBEDDINGS`);

        const result = await EmbeddingProcessor.handle(payload);

        // Per-evidence pipeline is done — case-level reasoning (hypotheses +
        // contradictions) starts next. scan-contradictions owns the final
        // COMPLETED transition for this evidence.
        await db.evidence.update({ where: { id: payload.evidenceId }, data: { status: "ANALYZING" } });
        console.log(`[TASK:EMBED] Evidence status → ANALYZING`);

        // Fan-out: fire hypothesis update and contradiction scan concurrently
        await Promise.all([
            tasks.trigger<typeof updateHypothesesTask>("update-hypotheses", {
                caseId: payload.caseId,
                triggerReason: "new-evidence",
                newEvidenceCount: 1,
            }),
            tasks.trigger<typeof scanContradictionsTask>("scan-contradictions", {
                caseId: payload.caseId,
                evidenceId: payload.evidenceId,
            }),
        ]);

        console.log(`[TASK:EMBED] ✓ Done, hypotheses + contradictions triggered for evidenceId=${payload.evidenceId}`);
        return result;
    },
});
