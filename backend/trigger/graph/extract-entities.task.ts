import { task, tasks } from "@trigger.dev/sdk";
import { ExtractionProcessor } from "../../queues/processors/extraction.processor";
import type { ExtractEntitiesPayload } from "../../types/task-payloads";
import type { updateGraphTask } from "./update-graph.task";

/**
 * Extracts entities, relationships, and events from normalized text via LLM.
 * Pure I/O (Fireworks API calls) — micro machine is sufficient.
 */
export const extractEntitiesTask = task({
    id: "extract-entities",
    machine: "micro",
    maxDuration: 300, // 5 min — LLM calls can be slow
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 10_000 },
    run: async (payload: ExtractEntitiesPayload) => {
        console.log(`[TASK:EXTRACT] Extracting entities for evidenceId=${payload.evidenceId}`);

        const result = await ExtractionProcessor.handle(payload);

        await tasks.trigger<typeof updateGraphTask>("update-graph", {
            evidenceId: result.evidenceId,
            caseId: payload.caseId,
            extractionResultKey: result.extractionKey,
            processorVersion: "1.0.0",
            extractionVersion: "1.0.0",
        });

        console.log(`[TASK:EXTRACT] ✓ Done, graph update triggered for evidenceId=${result.evidenceId}`);
        return result;
    },
});
