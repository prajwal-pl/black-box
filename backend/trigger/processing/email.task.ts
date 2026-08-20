import { task, tasks } from "@trigger.dev/sdk";
import { EmailProcessor } from "../../queues/processors/processing/email.processor";
import type { ProcessEvidencePayload } from "../../types/task-payloads";
import type { extractEntitiesTask } from "../graph/extract-entities.task";
import db from "../../lib/db";

/** Processes email evidence (RFC-2822). Lightweight — uses micro machine. */
export const processEmailTask = task({
    id: "process-email",
    machine: "micro",
    maxDuration: 120,
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 5_000 },

    onFailure: async ({ payload, error }) => {
        console.error(`[TASK:EMAIL] ✗ All retries exhausted for evidenceId=${payload.evidenceId}.`, (error as Error).message);
        try {
            await db.evidence.update({ where: { id: payload.evidenceId }, data: { status: "FAILED" } });
        } catch (dbErr) {
            console.error(`[TASK:EMAIL] Failed to update status to FAILED:`, dbErr);
        }
    },

    run: async (payload: ProcessEvidencePayload) => {
        console.log(`[TASK:EMAIL] Processing evidenceId=${payload.evidenceId}`);

        const result = await EmailProcessor.handle(payload);

        await db.evidence.update({ where: { id: payload.evidenceId }, data: { status: "COMPLETED" } });
        console.log(`[TASK:EMAIL] Evidence status → COMPLETED`);

        await tasks.trigger<typeof extractEntitiesTask>("extract-entities", {
            evidenceId: result.evidenceId,
            caseId: result.caseId,
            normalizedTextKey: result.normalizedTextKey,
            processorVersion: "1.0.0",
        });

        console.log(`[TASK:EMAIL] ✓ Done, extraction triggered for evidenceId=${result.evidenceId}`);
        return result;
    },
});
