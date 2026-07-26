import { Worker, type ConnectionOptions } from "bullmq";
import { JOB_NAMES, QUEUE_NAMES } from "../queues/jobs/types";
import { ReasoningProcessor } from "../queues/processors/reasoning.processor";
import { EmbeddingProcessor } from "../queues/processors/embedding.processor";
import { createRedisConnection } from "../queues/config/redis.config";
import { EvidenceQueueService } from "../services/evidence.queue.service";

const worker = new Worker(QUEUE_NAMES.REASONING, async (job) => {
    switch (job.name) {
        case JOB_NAMES.UPDATE_HYPOTHESES:
            return ReasoningProcessor.handle(job)
        case JOB_NAMES.GENERATE_EMBEDDINGS:
            return EmbeddingProcessor.handle(job)
        default:
            throw new Error(`Unknown job name: ${job.name}`)
    }
}, {
    concurrency: 2,
    connection: createRedisConnection() as ConnectionOptions,
})

worker.on("failed", async (job, err) => {
    if (!job) return
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
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
    console.error("Reasoning Worker error:", err);
})

process.on("SIGTERM", async () => {
    await worker.close()
    process.exit(0)
})

console.log("Reasoning Worker started...")