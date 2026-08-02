import type { Job } from "bullmq";
import { JOB_NAMES, JOB_PRIORITY, type ClassifyEvidencePayload, type EvidenceTypes, type UploadEvidencePayload } from "../jobs/types";
import { ingestionQueue } from "../definitions/ingestion.queue";
import db from "../../lib/db";
import { processingQueue } from "../definitions/processing.queue";

const classifyByMimeType = (mimeType: string): EvidenceTypes => {
    if (mimeType === "application/pdf") {
        return "pdf";
    }
    if (mimeType.startsWith("image/")) {
        return "image";
    }
    if (mimeType.startsWith("text/")) {
        return "text";
    }
    if (mimeType === "application/vnd.ms-excel" || mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
        return "spreadsheet";
    }
    if (mimeType.startsWith("message/")) {
        return "email";
    }
    if (mimeType.startsWith("video/")) {
        return "video";
    }
    if (mimeType.startsWith("audio/")) {
        return "audio";
    }
    return "unknown"
}

const processJobMap: Record<EvidenceTypes, string> = {
    pdf: JOB_NAMES.PROCESS_PDF,
    audio: JOB_NAMES.PROCESS_AUDIO,
    image: JOB_NAMES.PROCESS_IMAGE,
    text: JOB_NAMES.PROCESS_TEXT,
    spreadsheet: JOB_NAMES.PROCESS_SPREADSHEET,
    email: JOB_NAMES.PROCESS_EMAIL,
    video: JOB_NAMES.PROCESS_VIDEO,
    unknown: JOB_NAMES.PROCESS_TEXT,
}

export class IngestionProcessor {
    static async handleUpload(job: Job<UploadEvidencePayload>) {
        const { caseId, evidenceId, storageKey, mimeType } = job.data;

        console.log(`[INGESTION:UPLOAD] ▶ START evidenceId=${evidenceId} caseId=${caseId} mimeType=${mimeType} storageKey=${storageKey}`);

        await job.updateProgress(10);
        console.log(`[INGESTION:UPLOAD] Updating evidence status to PROCESSING...`);

        await db.evidence.update({
            where: {
                id: evidenceId
            },
            data: {
                status: "PROCESSING"
            }
        })
        console.log(`[INGESTION:UPLOAD] Evidence status set to PROCESSING`);

        console.log(`[INGESTION:UPLOAD] Enqueuing CLASSIFY_EVIDENCE job...`);
        const enqueued = await ingestionQueue.add(JOB_NAMES.CLASSIFY_EVIDENCE, {
            evidenceId,
            caseId,
            storageKey,
            mimeType,
            processorVersion: "1.0"
        })
        console.log(`[INGESTION:UPLOAD] CLASSIFY_EVIDENCE job enqueued: jobId=${enqueued.id}`);

        await job.updateProgress(100);
        console.log(`[INGESTION:UPLOAD] ✓ DONE evidenceId=${evidenceId}`);
        return { evidenceId, status: "queued-for-classification" };
    }

    static async handleClassification(job: Job<ClassifyEvidencePayload>) {
        const { caseId, evidenceId, mimeType, storageKey } = job.data;

        console.log(`[INGESTION:CLASSIFY] ▶ START evidenceId=${evidenceId} caseId=${caseId} mimeType=${mimeType}`);

        await job.updateProgress(20);

        const evidenceType = classifyByMimeType(mimeType);
        const processorJob = processJobMap[evidenceType];
        console.log(`[INGESTION:CLASSIFY] Classified as evidenceType=${evidenceType} → dispatchTo=${processorJob}`);

        await job.updateProgress(60);

        console.log(`[INGESTION:CLASSIFY] Enqueuing processing job: ${processorJob}`);
        const enqueued = await processingQueue.add(processorJob, {
            evidenceId,
            caseId,
            storageKey,
            evidenceType,
            processorVersion: "1.0"
        }, { priority: evidenceType === "image" ? JOB_PRIORITY.OCR : JOB_PRIORITY.ENTITY_EXTRACTION });
        console.log(`[INGESTION:CLASSIFY] Processing job enqueued: jobId=${enqueued.id} name=${processorJob}`);

        await job.updateProgress(100);
        console.log(`[INGESTION:CLASSIFY] ✓ DONE evidenceId=${evidenceId} type=${evidenceType}`);
        return { evidenceId, evidenceType, dispatchedTo: processorJob };
    }
}