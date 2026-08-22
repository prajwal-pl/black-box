import { task, tasks } from "@trigger.dev/sdk";
import { ExtractionProcessor } from "../../queues/processors/extraction.processor";
import type { ExtractEntitiesPayload } from "../../types/task-payloads";
import type { updateGraphTask } from "./update-graph.task";
import db from "../../lib/db";

/**
 * Extracts entities, relationships, and events from normalized text via LLM.
 * Pure I/O (Fireworks API calls) — micro machine is sufficient.
 */
export const extractEntitiesTask = task({
    id: "extract-entities",
    machine: "micro",
    maxDuration: 900, // 15 min — large docs (182k chars) can take longer for LLM extraction
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 10_000 },

    onFailure: async ({ payload, error }) => {
        console.error(`[TASK:EXTRACT] ✗ All retries exhausted for evidenceId=${payload.evidenceId}. Marking FAILED.`, (error as Error).message);
        try {
            await db.evidence.update({ where: { id: payload.evidenceId }, data: { status: "FAILED" } });
        } catch (dbErr) {
            console.error(`[TASK:EXTRACT] Failed to update status to FAILED:`, dbErr);
        }
    },

    run: async (payload: ExtractEntitiesPayload) => {
        console.log(`[TASK:EXTRACT] Extracting entities for evidenceId=${payload.evidenceId}`);

        await db.evidence.update({ where: { id: payload.evidenceId }, data: { status: "EXTRACTING_ENTITIES" } });
        console.log(`[TASK:EXTRACT] Evidence status → EXTRACTING_ENTITIES`);

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
