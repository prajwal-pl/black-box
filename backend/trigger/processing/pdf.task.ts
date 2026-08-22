import { task, tasks } from "@trigger.dev/sdk";
import { PdfProcessor } from "../../queues/processors/processing/pdf.processor";
import type { ProcessEvidencePayload } from "../../types/task-payloads";
import type { extractEntitiesTask } from "../graph/extract-entities.task";
import db from "../../lib/db";

/**
 * Processes PDF evidence: pdf-parse + parallel Tesseract OCR fallback via pdftoppm.
 * Uses small-2x machine (1 vCPU / 1 GB RAM) for OCR workload.
 * Status lifecycle: PROCESSING (set by ingest) → EXTRACTING → downstream stages → COMPLETED (set by scan-contradictions), FAILED on terminal failure.
 */
export const processPdfTask = task({
    id: "process-pdf",
    machine: "small-2x",
    maxDuration: 900, // 10 min — enough for 200-page scanned PDFs with parallel OCR
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 10_000 },

    // Called when all retry attempts are exhausted — mark evidence as FAILED
    onFailure: async ({ payload, error }) => {
        console.error(
            `[TASK:PDF] ✗ All retries exhausted for evidenceId=${payload.evidenceId}. Marking FAILED.`,
            (error as Error).message,
        );
        try {
            await db.evidence.update({
                where: { id: payload.evidenceId },
                data: { status: "FAILED" },
            });
        } catch (dbErr) {
            console.error(`[TASK:PDF] Failed to update status to FAILED:`, dbErr);
        }
    },

    run: async (payload: ProcessEvidencePayload) => {
        console.log(`[TASK:PDF] Processing evidenceId=${payload.evidenceId}`);

        await db.evidence.update({
            where: { id: payload.evidenceId },
            data: { status: "EXTRACTING" },
        });
        console.log(`[TASK:PDF] Evidence status → EXTRACTING`);

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
