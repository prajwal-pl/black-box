import dotenv from "dotenv";
dotenv.config();

import { Worker, type ConnectionOptions } from 'bullmq';
import { JOB_NAMES, QUEUE_NAMES } from '../queues/jobs/types';
import { IngestionProcessor } from '../queues/processors/ingestion.processor';
import { createRedisConnection } from '../queues/config/redis.config';
import { EvidenceQueueService } from '../services/evidence.queue.service';

const worker = new Worker(QUEUE_NAMES.INGESTION, async (job) => {
    console.log(`[INGESTION WORKER] ⚙ Received job: name=${job.name} id=${job.id} data=${JSON.stringify(job.data)}`);
    switch (job.name) {
        case JOB_NAMES.UPLOAD_EVIDENCE:
            return await IngestionProcessor.handleUpload(job);
        case JOB_NAMES.CLASSIFY_EVIDENCE:
            return await IngestionProcessor.handleClassification(job);
        default:
            console.error(`[INGESTION WORKER] ✗ Unknown job name: ${job.name}`);
            throw new Error(`Unknown job name: ${job.name}`);
    }
}, {
    concurrency: 10,
    connection: createRedisConnection() as ConnectionOptions,
})

worker.on('completed', (job, result) => {
    console.log(`[INGESTION WORKER] ✓ Job COMPLETED: name=${job.name} id=${job.id} result=${JSON.stringify(result)}`);
})

worker.on('failed', async (job, error) => {
    if (!job) return;

    console.error(`[INGESTION WORKER] ✗ Job FAILED: name=${job.name} id=${job.id} attempt=${job.attemptsMade} error=${error.message}`, error.stack);

    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        console.error(`[INGESTION WORKER] ✗ Job exhausted all retries — sending to dead letter queue`);
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
    console.error("[INGESTION WORKER] ✗ Worker error:", error)
})

process.on("SIGTERM", async () => {
    console.log("SIGTERM received, shutting down ingestion worker...");
    await worker.close();
    process.exit(0);
});

console.log("Ingestion Worker Started...")