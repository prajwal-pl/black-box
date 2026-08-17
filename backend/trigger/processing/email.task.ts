import { task, tasks } from "@trigger.dev/sdk/v3";
import { EmailProcessor } from "../../queues/processors/processing/email.processor";
import type { ProcessEvidencePayload } from "../../types/task-payloads";
import type { extractEntitiesTask } from "../graph/extract-entities.task";

/** Processes email evidence (RFC-2822). Lightweight — uses micro machine. */
export const processEmailTask = task({
    id: "process-email",
    machine: { preset: "micro" },
    maxDuration: 120,
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 5_000 },
    run: async (payload: ProcessEvidencePayload) => {
        console.log(`[TASK:EMAIL] Processing evidenceId=${payload.evidenceId}`);

        const result = await EmailProcessor.handle(payload);

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
