import { tasks } from "@trigger.dev/sdk/v3";
import type { ingestEvidenceTask } from "../trigger/ingestion.task";
import type { updateHypothesesTask } from "../trigger/reasoning/hypotheses.task";
import type { scanContradictionsTask } from "../trigger/reasoning/contradictions.task";
import type { processPdfTask } from "../trigger/processing/pdf.task";
import type { processImageTask } from "../trigger/processing/image.task";
import type { processTextTask } from "../trigger/processing/text.task";
import type { processSpreadsheetTask } from "../trigger/processing/spreadsheet.task";
import type { processEmailTask } from "../trigger/processing/email.task";
import type {
    UploadEvidencePayload,
    ScanContradictionsPayload,
    UpdateHypothesesPayload,
    EvidenceTypes,
} from "../types/task-payloads";
import db from "../lib/db";

/** Classifies MIME type to an EvidenceTypes value. Mirrors ingestion.processor logic. */
function classifyByMimeType(mimeType: string): EvidenceTypes {
    if (mimeType === "application/pdf") return "pdf";
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("text/")) return "text";
    if (
        mimeType === "application/vnd.ms-excel" ||
        mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) return "spreadsheet";
    if (mimeType.startsWith("message/")) return "email";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    return "unknown";
}

/**
 * Service layer that triggers Trigger.dev tasks in place of BullMQ queue.add() calls.
 * Replaces EvidenceQueueService.
 */
export class EvidenceTaskService {
    /** Triggered when a new file is uploaded — starts the full evidence pipeline. */
    static async enqueueEvidenceUpload(payload: UploadEvidencePayload): Promise<{ id: string }> {
        const handle = await tasks.trigger<typeof ingestEvidenceTask>(
            "ingest-evidence",
            payload,
        );
        return { id: handle.id };
    }

    /**
     * Re-triggers evidence processing from the processing stage (skips ingestion).
     * Used by the reprocess endpoint.
     */
    static async requeueEvidenceProcessing(evidenceId: string): Promise<{ id: string }> {
        const evidence = await db.evidence.findUnique({ where: { id: evidenceId } });
        if (!evidence) {
            throw new Error(`Evidence not found: ${evidenceId}`);
        }

        // Reset status so the UI shows PROCESSING again
        await db.evidence.update({
            where: { id: evidenceId },
            data: { status: "PENDING" },
        });

        const evidenceType = classifyByMimeType(evidence.mimeType);
        const processingPayload = {
            evidenceId,
            caseId: evidence.caseId,
            storageKey: evidence.storageKey,
            evidenceType,
            processorVersion: "1.0.0",
        };

        console.log(
            `[EVIDENCE:REPROCESS] Requeuing evidenceId=${evidenceId} type=${evidenceType}`,
        );

        let handle: { id: string };
        if (evidenceType === "pdf") {
            handle = await tasks.trigger<typeof processPdfTask>("process-pdf", processingPayload);
        } else if (evidenceType === "image") {
            handle = await tasks.trigger<typeof processImageTask>("process-image", processingPayload);
        } else if (evidenceType === "spreadsheet") {
            handle = await tasks.trigger<typeof processSpreadsheetTask>("process-spreadsheet", processingPayload);
        } else if (evidenceType === "email") {
            handle = await tasks.trigger<typeof processEmailTask>("process-email", processingPayload);
        } else {
            handle = await tasks.trigger<typeof processTextTask>("process-text", processingPayload);
        }

        return { id: handle.id };
    }

    /** Manually triggers hypothesis update for a case. */
    static async manualHypothesisUpdate(caseId: string): Promise<{ id: string }> {
        const handle = await tasks.trigger<typeof updateHypothesesTask>(
            "update-hypotheses",
            { caseId, triggerReason: "manual" } satisfies UpdateHypothesesPayload,
        );
        return { id: handle.id };
    }

    /** Triggers contradiction scan for a specific evidence item. */
    static async enqueueScanContradictions(
        payload: ScanContradictionsPayload,
    ): Promise<{ id: string }> {
        const handle = await tasks.trigger<typeof scanContradictionsTask>(
            "scan-contradictions",
            payload,
        );
        return { id: handle.id };
    }
}
