import dotenv from "dotenv";
dotenv.config();

import { Worker, type ConnectionOptions } from "bullmq";
import { JOB_NAMES, QUEUE_NAMES } from "../queues/jobs/types";
import { GraphProcessor } from "../queues/processors/graph.processor";
import { ExtractionProcessor } from "../queues/processors/extraction.processor";
import { createRedisConnection } from "../queues/config/redis.config";
import { EvidenceQueueService } from "../services/evidence.queue.service";

const worker = new Worker(QUEUE_NAMES.GRAPH, async (job) => {
    switch (job.name) {
        case JOB_NAMES.UPDATE_GRAPH:
            return GraphProcessor.handleUpdateGraph(job)
        case JOB_NAMES.BUILD_TIMELINE:
            return GraphProcessor.handleBuildTimeline(job)
        case JOB_NAMES.EXTRACT_ENTITIES:
            return ExtractionProcessor.handle(job)
        default:
            throw new Error(`Unknown job name: ${job.name}`)
    }
},
    {
        concurrency: 3,
        connection: createRedisConnection() as ConnectionOptions,
    })

worker.on("failed", async (job, err) => {
    if (!job) return
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        await EvidenceQueueService.sendToDeadLetter({
            originalQueue: QUEUE_NAMES.GRAPH,
            originalJobName: job.name,
            originalPayload: job.data,
            failureReason: err.message,
            failedAt: new Date(),
            attempts: job.attemptsMade,
        })
    }
})

worker.on("error", (err) => {
    console.error("Graph Worker error:", err);
})

process.on("SIGTERM", async () => {
    await worker.close()
    process.exit(0)
})

console.log("Graph Worker started...")