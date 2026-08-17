import { task, tasks } from "@trigger.dev/sdk/v3";
import { PdfProcessor } from "../../queues/processors/processing/pdf.processor";
import type { ProcessEvidencePayload } from "../../types/task-payloads";
import type { extractEntitiesTask } from "../graph/extract-entities.task";

/**
 * Processes PDF evidence: pdf-parse + Tesseract OCR fallback via pdftoppm.
 * Uses small-2x machine (1 vCPU / 1 GB RAM) for OCR workload.
 */
export const processPdfTask = task({
    id: "process-pdf",
    machine: { preset: "small-2x" }, // 1 vCPU, 1 GB RAM — handles Tesseract WASM
    maxDuration: 600, // 10 minutes for large/scanned PDFs
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 10_000 },
    run: async (payload: ProcessEvidencePayload) => {
        console.log(`[TASK:PDF] Processing evidenceId=${payload.evidenceId}`);

        const result = await PdfProcessor.handle(payload);

        // Trigger entity extraction with the normalized text
        await tasks.trigger<typeof extractEntitiesTask>("extract-entities", {
            evidenceId: result.evidenceId,
            caseId: result.caseId,
            normalizedTextKey: result.normalizedTextKey,
            processorVersion: "1.0.0",
        });

        console.log(`[TASK:PDF] ✓ Done, extraction triggered for evidenceId=${result.evidenceId}`);
        return result;
    },
});
