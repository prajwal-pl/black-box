import { task, tasks } from "@trigger.dev/sdk";
import { ImageProcessor } from "../../queues/processors/processing/image.processor";
import type { ProcessEvidencePayload } from "../../types/task-payloads";
import type { extractEntitiesTask } from "../graph/extract-entities.task";
import db from "../../lib/db";

export const processImageTask = task({
    id: "process-image",
    machine: "small-2x",
    maxDuration: 300,
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 5_000 },

    onFailure: async ({ payload, error }) => {
        console.error(`[TASK:IMAGE] ✗ All retries exhausted for evidenceId=${payload.evidenceId}.`, (error as Error).message);
        try {
            await db.evidence.update({ where: { id: payload.evidenceId }, data: { status: "FAILED" } });
        } catch (dbErr) {
            console.error(`[TASK:IMAGE] Failed to update status to FAILED:`, dbErr);
        }
    },

    run: async (payload: ProcessEvidencePayload) => {
        console.log(`[TASK:IMAGE] Processing evidenceId=${payload.evidenceId}`);

        const result = await ImageProcessor.handle(payload);

        await db.evidence.update({ where: { id: payload.evidenceId }, data: { status: "COMPLETED" } });
        console.log(`[TASK:IMAGE] Evidence status → COMPLETED`);

        await tasks.trigger<typeof extractEntitiesTask>("extract-entities", {
            evidenceId: result.evidenceId,
            caseId: result.caseId,
            normalizedTextKey: result.normalizedTextKey,
            processorVersion: "1.0.0",
        });

        console.log(`[TASK:IMAGE] ✓ Done, extraction triggered for evidenceId=${result.evidenceId}`);
        return result;
    },
});
