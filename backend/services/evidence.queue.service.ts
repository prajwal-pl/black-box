import { deadLetterQueue } from "../queues/definitions/dead-letter.queue";
import { ingestionQueue } from "../queues/definitions/ingestion.queue"
import { maintenanceQueue } from "../queues/definitions/maintainence.queue";
import { reasoningQueue } from "../queues/definitions/reasoning.queue";
import { processingQueue } from "../queues/definitions/processing.queue";
import { JOB_NAMES, JOB_PRIORITY, type DeadLetterPayload, type MergeEntitiesPayload, type ScanContradictionsPayload, type UpdateHypothesesPayload, type UploadEvidencePayload, type ProcessEvidencePayload, type EvidenceTypes } from "../queues/jobs/types";
import db from "../lib/db";

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

export class EvidenceQueueService {
    static async enqueueEvidenceUpload(payload: UploadEvidencePayload) {
        return await ingestionQueue.add(JOB_NAMES.UPLOAD_EVIDENCE, payload, {
            priority: JOB_PRIORITY.OCR
        });
    }

    static async enqueueEvidenceClassification(payload: UploadEvidencePayload) {
        return await ingestionQueue.add(JOB_NAMES.CLASSIFY_EVIDENCE, payload)
    }

    static async enqueueMergeEntities(payload: MergeEntitiesPayload) {
        return await maintenanceQueue.add(JOB_NAMES.MERGE_ENTITIES, payload, {
            priority: JOB_PRIORITY.CLEANUP
        })
    }

    static async sendToDeadLetter(payload: DeadLetterPayload) {
        return await deadLetterQueue.add(JOB_NAMES.DEAD_LETTER, payload)
    }

    static async getJobStatus(jobId: string) {
        const job = await ingestionQueue.getJob(jobId);
        if (!job) {
            return null;
        }

        return {
            id: job.id,
            name: job.name,
            state: await job.getState(),
            progress: job.progress,
            failedReason: job.failedReason,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            attemptsMade: job.attemptsMade,
        }
    }

    static async getQueueStats() {
        const queues = { ingestionQueue, maintenanceQueue }
        const stats: Record<string, object> = {}

        for (const [name, queue] of Object.entries(queues)) {
            const [waiting, active, completed, failed, delayed] = await Promise.all([
                queue.getWaitingCount(),
                queue.getActiveCount(),
                queue.getCompletedCount(),
                queue.getFailedCount(),
                queue.getDelayedCount()
            ]);

            stats[name] = {
                waiting,
                active,
                completed,
                failed,
                delayed
            }
        }
        return stats
    }

    static async enqueueScanContradictions(payload: ScanContradictionsPayload) {
        return await reasoningQueue.add(JOB_NAMES.SCAN_CONTRADICTIONS, payload, {
            priority: JOB_PRIORITY.HYPOTHESES
        })
    }

    static async manualHypothesisUpdate(caseId: string) {
        return await reasoningQueue.add(JOB_NAMES.UPDATE_HYPOTHESES, {
            caseId,
            triggerReason: "manual"
        } satisfies UpdateHypothesesPayload)
    }

    static async requeueEvidenceProcessing(evidenceId: string) {
        const evidence = await db.evidence.findUnique({ where: { id: evidenceId } });
        if (!evidence) {
            throw new Error("Evidence not found");
        }

        // Clear old extraction/embedding data
        await db.evidence.update({
            where: { id: evidenceId },
            data: { status: "PENDING" }
        });

        const evidenceType = classifyByMimeType(evidence.mimeType);
        const processorJob = processJobMap[evidenceType];

        console.log(`[EVIDENCE:REPROCESS] Requeuing evidenceId=${evidenceId} type=${evidenceType} → ${processorJob}`);

        return await processingQueue.add(processorJob, {
            evidenceId,
            caseId: evidence.caseId,
            storageKey: evidence.storageKey,
            evidenceType,
            processorVersion: "1.0"
        }, { priority: evidenceType === "image" ? JOB_PRIORITY.OCR : JOB_PRIORITY.ENTITY_EXTRACTION });
    }
}