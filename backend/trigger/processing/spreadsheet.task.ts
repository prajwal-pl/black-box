import { task, tasks } from "@trigger.dev/sdk/v3";
import { SpreadsheetProcessor } from "../../queues/processors/processing/spreadsheet.processor";
import type { ProcessEvidencePayload } from "../../types/task-payloads";
import type { extractEntitiesTask } from "../graph/extract-entities.task";

/** Processes spreadsheet evidence (XLSX/XLS). Lightweight — uses micro machine. */
export const processSpreadsheetTask = task({
    id: "process-spreadsheet",
    machine: { preset: "micro" },
    maxDuration: 120,
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 5_000 },
    run: async (payload: ProcessEvidencePayload) => {
        console.log(`[TASK:SPREADSHEET] Processing evidenceId=${payload.evidenceId}`);

        const result = await SpreadsheetProcessor.handle(payload);

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
