import { task, tasks } from "@trigger.dev/sdk";
import { EmbeddingProcessor } from "../../queues/processors/embedding.processor";
import type { GenerateEmbeddingsPayload } from "../../types/task-payloads";
import type { updateHypothesesTask } from "./hypotheses.task";
import type { scanContradictionsTask } from "./contradictions.task";

/**
 * Generates vector embeddings and stores them in Qdrant.
 * Fan-out: triggers both update-hypotheses and scan-contradictions after completion.
 */
export const generateEmbeddingsTask = task({
    id: "generate-embeddings",
    machine: "micro",
    maxDuration: 600, // 10 min — large document chunking + Qdrant upsert batches
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 5_000 },
    run: async (payload: GenerateEmbeddingsPayload) => {
        console.log(`[TASK:EMBED] Generating embeddings for evidenceId=${payload.evidenceId}`);

        const result = await EmbeddingProcessor.handle(payload);

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
