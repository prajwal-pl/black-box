import { Worker, type ConnectionOptions } from 'bullmq';
import { JOB_NAMES, QUEUE_NAMES } from '../queues/jobs/types';
import { IngestionProcessor } from '../queues/processors/ingestion.processor';
import { createRedisConnection } from '../queues/config/redis.config';
import { EvidenceQueueService } from '../services/evidence.queue.service';

const worker = new Worker(QUEUE_NAMES.INGESTION, async (job) => {
    switch (job.name) {
        case JOB_NAMES.UPLOAD_EVIDENCE:
            return await IngestionProcessor.handleUpload(job);
        case JOB_NAMES.CLASSIFY_EVIDENCE:
            return await IngestionProcessor.handleClassification(job);
        default:
            throw new Error(`Unknown job name: ${job.name}`);
    }
}, {
    concurrency: 10,
    connection: createRedisConnection() as ConnectionOptions,
})

worker.on('failed', async (job, error) => {
    if (!job) return;

    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        await EvidenceQueueService.sendToDeadLetter({
            originalQueue: QUEUE_NAMES.INGESTION,
            originalJobName: job.name,
            originalPayload: job.data,
            attempts: job.attemptsMade,
            failedAt: new Date(),
            failureReason: error.message
        })
    }
})

worker.on("error", (error) => {
    console.error("Ingestion worker error: ", error)
})

process.on("SIGTERM", async () => {
    console.log("SIGTERM received, shutting down ingestion worker...");
    await worker.close();
    process.exit(0);
});

console.log("Ingestion Worker Started...")