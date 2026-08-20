import { task } from "@trigger.dev/sdk";
import { ReasoningProcessor } from "../../queues/processors/reasoning.processor";
import type { UpdateHypothesesPayload } from "../../types/task-payloads";

/** Generates/updates investigative hypotheses via LLM + Qdrant RAG. */
export const updateHypothesesTask = task({
    id: "update-hypotheses",
    machine: "micro",
    maxDuration: 600, // 10 min — Qdrant RAG retrieval + LLM synthesis
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 10_000 },
    // Limit to 1 concurrent run per case to avoid duplicate hypothesis generation
    queue: {
        name: "hypotheses-queue",
        concurrencyLimit: 5,
    },
    run: async (payload: UpdateHypothesesPayload) => {
        console.log(`[TASK:HYPOTHESES] Updating hypotheses for caseId=${payload.caseId}`);
        const result = await ReasoningProcessor.handle(payload);
        console.log(`[TASK:HYPOTHESES] ✓ Done for caseId=${payload.caseId}`);
        return result;
    },
});
