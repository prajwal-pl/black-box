import { task, tasks } from "@trigger.dev/sdk";
import { GraphProcessor } from "../../queues/processors/graph.processor";
import type { UpdateGraphPayload } from "../../types/task-payloads";
import type { buildTimelineTask } from "./build-timeline.task";
import type { generateEmbeddingsTask } from "../reasoning/embeddings.task";
import db from "../../lib/db";

/**
 * Writes extracted entities and relationships to Neo4j.
 * Fan-out: triggers both build-timeline and generate-embeddings after completion.
 */
export const updateGraphTask = task({
    id: "update-graph",
    machine: "micro",
    maxDuration: 180,
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 5_000 },

    onFailure: async ({ payload, error }) => {
        console.error(`[TASK:GRAPH] ✗ All retries exhausted for evidenceId=${payload.evidenceId}. Marking FAILED.`, (error as Error).message);
        try {
            await db.evidence.update({ where: { id: payload.evidenceId }, data: { status: "FAILED" } });
        } catch (dbErr) {
            console.error(`[TASK:GRAPH] Failed to update status to FAILED:`, dbErr);
        }
    },

    run: async (payload: UpdateGraphPayload) => {
        console.log(`[TASK:GRAPH] Updating graph for evidenceId=${payload.evidenceId}`);

        await db.evidence.update({ where: { id: payload.evidenceId }, data: { status: "UPDATING_GRAPH" } });
        console.log(`[TASK:GRAPH] Evidence status → UPDATING_GRAPH`);

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
