import { task, tasks } from "@trigger.dev/sdk";
import { IngestionProcessor, classifyByMimeType } from "../queues/processors/ingestion.processor";
import type { UploadEvidencePayload, EvidenceTypes } from "../types/task-payloads";
import type { processPdfTask } from "./processing/pdf.task";
import type { processImageTask } from "./processing/image.task";
import type { processTextTask } from "./processing/text.task";
import type { processSpreadsheetTask } from "./processing/spreadsheet.task";
import type { processEmailTask } from "./processing/email.task";

/**
 * Entry point for the full evidence ingestion pipeline.
 * Combines the old upload-evidence + classify-evidence BullMQ jobs.
 * After classifying the MIME type, dispatches to the appropriate processing task.
 */
export const ingestEvidenceTask = task({
    id: "ingest-evidence",
    machine: "micro",
    maxDuration: 120,
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 5_000 },
    run: async (payload: UploadEvidencePayload) => {
        console.log(`[TASK:INGEST] Starting ingestion for evidenceId=${payload.evidenceId}`);

        const { evidenceId, evidenceType } = await IngestionProcessor.handle(payload);

        // Dispatch to the appropriate processing task based on MIME type
        const processingPayload = {
            evidenceId,
            caseId: payload.caseId,
            storageKey: payload.storageKey,
            evidenceType,
            processorVersion: "1.0.0",
        };

        const processorMap: Record<EvidenceTypes, string> = {
            pdf: "process-pdf",
            image: "process-image",
            text: "process-text",
            spreadsheet: "process-spreadsheet",
            email: "process-email",
            audio: "process-text",   // fallback: treat audio transcript as text if available
            video: "process-text",   // fallback
            unknown: "process-text", // fallback
        };

        const taskId = processorMap[evidenceType];
        console.log(`[TASK:INGEST] Triggering ${taskId} for evidenceId=${evidenceId}`);

        // Type-safe dispatch per evidence type
        if (evidenceType === "pdf") {
            await tasks.trigger<typeof processPdfTask>("process-pdf", processingPayload);
        } else if (evidenceType === "image") {
            await tasks.trigger<typeof processImageTask>("process-image", processingPayload);
        } else if (evidenceType === "spreadsheet") {
            await tasks.trigger<typeof processSpreadsheetTask>("process-spreadsheet", processingPayload);
        } else if (evidenceType === "email") {
            await tasks.trigger<typeof processEmailTask>("process-email", processingPayload);
        } else {
            // text, audio, video, unknown — all fall through to text processing
            await tasks.trigger<typeof processTextTask>("process-text", processingPayload);
        }

        console.log(`[TASK:INGEST] ✓ Ingestion complete, processing task triggered for evidenceId=${evidenceId}`);
        return { evidenceId, evidenceType };
    },
});
