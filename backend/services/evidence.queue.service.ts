import { deadLetterQueue } from "../queues/definitions/dead-letter.queue";
import { ingestionQueue } from "../queues/definitions/ingestion.queue"
import { maintenanceQueue } from "../queues/definitions/maintainence.queue";
import { JOB_NAMES, JOB_PRIORITY, type DeadLetterPayload, type MergeEntitiesPayload, type UploadEvidencePayload } from "../queues/jobs/types";

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
}