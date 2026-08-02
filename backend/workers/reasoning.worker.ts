import dotenv from "dotenv";
dotenv.config();

import { Worker, type ConnectionOptions } from "bullmq";
import { JOB_NAMES, QUEUE_NAMES } from "../queues/jobs/types";
import { ReasoningProcessor } from "../queues/processors/reasoning.processor";
import { EmbeddingProcessor } from "../queues/processors/embedding.processor";
import { createRedisConnection } from "../queues/config/redis.config";
import { EvidenceQueueService } from "../services/evidence.queue.service";
import { ContradictionProcessor } from "../queues/processors/contradictions.processor";

const worker = new Worker(QUEUE_NAMES.REASONING, async (job) => {
    console.log(`[REASONING WORKER] ⚙ Received job: name=${job.name} id=${job.id} data=${JSON.stringify(job.data)}`);
    switch (job.name) {
        case JOB_NAMES.UPDATE_HYPOTHESES:
            return ReasoningProcessor.handle(job)
        case JOB_NAMES.GENERATE_EMBEDDINGS:
            return EmbeddingProcessor.handle(job)
        case JOB_NAMES.SCAN_CONTRADICTIONS:
            return ContradictionProcessor.handle(job)
        default:
            console.error(`[REASONING WORKER] ✗ Unknown job name: ${job.name}`);
            throw new Error(`Unknown job name: ${job.name}`)
    }
}, {
    concurrency: 2,
    connection: createRedisConnection() as ConnectionOptions,
})

worker.on("completed", (job, result) => {
    console.log(`[REASONING WORKER] ✓ Job COMPLETED: name=${job.name} id=${job.id} result=${JSON.stringify(result)}`);
})

worker.on("failed", async (job, err) => {
    if (!job) return
    console.error(`[REASONING WORKER] ✗ Job FAILED: name=${job.name} id=${job.id} attempt=${job.attemptsMade} error=${err.message}`, err.stack);
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        console.error(`[REASONING WORKER] ✗ Job exhausted all retries — sending to dead letter queue`);
        await EvidenceQueueService.sendToDeadLetter({
            originalQueue: QUEUE_NAMES.REASONING,
            originalJobName: job.name,
            originalPayload: job.data,
            failureReason: err.message,
            failedAt: new Date(),
            attempts: job.attemptsMade,
        })
    }
})

worker.on("error", (err) => {
    console.error("[REASONING WORKER] ✗ Worker error:", err);
})

process.on("SIGTERM", async () => {
    await worker.close()
    process.exit(0)
})

console.log("Reasoning Worker started...")