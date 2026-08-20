import { task, tasks } from "@trigger.dev/sdk";
import { SpreadsheetProcessor } from "../../queues/processors/processing/spreadsheet.processor";
import type { ProcessEvidencePayload } from "../../types/task-payloads";
import type { extractEntitiesTask } from "../graph/extract-entities.task";
import db from "../../lib/db";

/** Processes spreadsheet evidence (XLSX/XLS). Lightweight — uses micro machine. */
export const processSpreadsheetTask = task({
    id: "process-spreadsheet",
    machine: "micro",
    maxDuration: 120,
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 5_000 },

    onFailure: async ({ payload, error }) => {
        console.error(`[TASK:SPREADSHEET] ✗ All retries exhausted for evidenceId=${payload.evidenceId}.`, (error as Error).message);
        try {
            await db.evidence.update({ where: { id: payload.evidenceId }, data: { status: "FAILED" } });
        } catch (dbErr) {
            console.error(`[TASK:SPREADSHEET] Failed to update status to FAILED:`, dbErr);
        }
    },

    run: async (payload: ProcessEvidencePayload) => {
        console.log(`[TASK:SPREADSHEET] Processing evidenceId=${payload.evidenceId}`);

        const result = await SpreadsheetProcessor.handle(payload);

        await db.evidence.update({ where: { id: payload.evidenceId }, data: { status: "COMPLETED" } });
        console.log(`[TASK:SPREADSHEET] Evidence status → COMPLETED`);

        await tasks.trigger<typeof extractEntitiesTask>("extract-entities", {
            evidenceId: result.evidenceId,
            caseId: payload.caseId,
            normalizedTextKey: result.normalizedTextKey,
            processorVersion: "1.0.0",
        });

        console.log(`[TASK:SPREADSHEET] ✓ Done, extraction triggered for evidenceId=${result.evidenceId}`);
        return result;
    },
});
