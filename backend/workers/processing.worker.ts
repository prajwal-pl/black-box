import dotenv from "dotenv";
dotenv.config();

import { Worker, type ConnectionOptions } from "bullmq";
import { JOB_NAMES, QUEUE_NAMES } from "../queues/jobs/types";
import { PdfProcessor } from "../queues/processors/processing/pdf.processor";
import { ImageProcessor } from "../queues/processors/processing/image.processor";
import { TextProcessor } from "../queues/processors/processing/text.processor";
import { SpreadsheetProcessor } from "../queues/processors/processing/spreadsheet.processor";
import { EmailProcessor } from "../queues/processors/processing/email.processor";
import { createRedisConnection } from "../queues/config/redis.config";
import { EvidenceQueueService } from "../services/evidence.queue.service";
import db from "../lib/db";

const worker = new Worker(
    QUEUE_NAMES.PROCESSING,
    async (job) => {
        console.log(`[PROCESSING WORKER] ⚙ Received job: name=${job.name} id=${job.id} data=${JSON.stringify(job.data)}`);
        switch (job.name) {
            case JOB_NAMES.PROCESS_PDF:
                return await PdfProcessor.handle(job);
            case JOB_NAMES.PROCESS_IMAGE:
                return await ImageProcessor.handle(job);
            case JOB_NAMES.PROCESS_TEXT:
                return await TextProcessor.handle(job);
            case JOB_NAMES.PROCESS_SPREADSHEET:
                return await SpreadsheetProcessor.handle(job);
            case JOB_NAMES.PROCESS_EMAIL:
                return await EmailProcessor.handle(job);
            case JOB_NAMES.PROCESS_AUDIO:
            case JOB_NAMES.PROCESS_VIDEO:
                // Audio/video not yet supported — mark as failed with a clear message
                console.error(`[PROCESSING WORKER] ✗ Unsupported job type: ${job.name}`);
                throw new Error(`Processing for ${job.name} is not yet supported`);
            default:
                console.error(`[PROCESSING WORKER] ✗ Unknown job name: ${job.name}`);
                throw new Error(`Unknown job name: ${job.name}`);
        }
    },
    {
        concurrency: 5,
        connection: createRedisConnection() as ConnectionOptions,
    }
);

worker.on("completed", async (job, result) => {
    console.log(`[PROCESSING WORKER] ✓ Job COMPLETED: name=${job.name} id=${job.id} result=${JSON.stringify(result)}`);
    // Mark evidence as COMPLETED in DB
    const { evidenceId } = job.data;
    await db.evidence.update({
        where: { id: evidenceId },
        data: { status: "COMPLETED" },
    }).catch((err) => console.error("[PROCESSING WORKER] Failed to mark evidence COMPLETED:", err));
});

worker.on("failed", async (job, error) => {
    if (!job) return;

    console.error(`[PROCESSING WORKER] ✗ Job FAILED: name=${job.name} id=${job.id} attempt=${job.attemptsMade} error=${error.message}`, error.stack);

    // Mark evidence as FAILED in DB
    const { evidenceId } = job.data;
    await db.evidence.update({
        where: { id: evidenceId },
        data: { status: "FAILED" },
    }).catch((err) => console.error("[PROCESSING WORKER] Failed to mark evidence FAILED:", err));

    // Send to dead letter queue after exhausting all retries
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        console.error(`[PROCESSING WORKER] ✗ Job exhausted all retries — sending to dead letter queue`);
        await EvidenceQueueService.sendToDeadLetter({
            originalQueue: QUEUE_NAMES.PROCESSING,
            originalJobName: job.name,
            originalPayload: job.data,
            attempts: job.attemptsMade,
            failedAt: new Date(),
            failureReason: error.message,
        });
    }
});

worker.on("error", (error) => {
    console.error("[PROCESSING WORKER] ✗ Worker error:", error);
});

process.on("SIGTERM", async () => {
    console.log("SIGTERM received, shutting down processing worker...");
    await worker.close();
    process.exit(0);
});

console.log("Processing Worker Started...");
