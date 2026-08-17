import { task, tasks } from "@trigger.dev/sdk/v3";
import { ImageProcessor } from "../../queues/processors/processing/image.processor";
import type { ProcessEvidencePayload } from "../../types/task-payloads";
import type { extractEntitiesTask } from "../graph/extract-entities.task";

/**
 * Processes image evidence via Tesseract.js OCR.
 * Uses small-2x machine for OCR workload.
 */
export const processImageTask = task({
    id: "process-image",
    machine: { preset: "small-2x" }, // 1 vCPU, 1 GB RAM — handles tesseract.js WASM
    maxDuration: 300,
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 5_000 },
    run: async (payload: ProcessEvidencePayload) => {
        console.log(`[TASK:IMAGE] Processing evidenceId=${payload.evidenceId}`);

        const result = await ImageProcessor.handle(payload);

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
