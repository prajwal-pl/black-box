import { task, tasks } from "@trigger.dev/sdk/v3";
import { GraphProcessor } from "../../queues/processors/graph.processor";
import type { UpdateGraphPayload } from "../../types/task-payloads";
import type { buildTimelineTask } from "./build-timeline.task";
import type { generateEmbeddingsTask } from "../reasoning/embeddings.task";

/**
 * Writes extracted entities and relationships to Neo4j.
 * Fan-out: triggers both build-timeline and generate-embeddings after completion.
 */
export const updateGraphTask = task({
    id: "update-graph",
    machine: { preset: "micro" },
    maxDuration: 180,
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 5_000 },
    run: async (payload: UpdateGraphPayload) => {
        console.log(`[TASK:GRAPH] Updating graph for evidenceId=${payload.evidenceId}`);

        const result = await GraphProcessor.handleUpdateGraph(payload);

        // Fan-out: fire both downstream tasks concurrently
        const normalizedTextKey = `cases/${payload.caseId}/normalized/${payload.evidenceId}.txt`;

        await Promise.all([
            tasks.trigger<typeof buildTimelineTask>("build-timeline", {
                evidenceId: payload.evidenceId,
                caseId: payload.caseId,
                extractionResultKey: payload.extractionResultKey,
                processorVersion: "1.0.0",
            }),
            tasks.trigger<typeof generateEmbeddingsTask>("generate-embeddings", {
                evidenceId: payload.evidenceId,
                caseId: payload.caseId,
                chunkKeys: [normalizedTextKey],
                processorVersion: "1.0.0",
            }),
        ]);

        console.log(`[TASK:GRAPH] ✓ Done, timeline + embeddings triggered for evidenceId=${payload.evidenceId}`);
        return result;
    },
});
