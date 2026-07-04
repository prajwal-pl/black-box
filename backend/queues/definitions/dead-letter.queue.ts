import { Queue, type ConnectionOptions } from "bullmq";
import { QUEUE_NAMES } from "../jobs/types";
import { createRedisConnection } from "../config/redis.config";

export const deadLetterQueue = new Queue(QUEUE_NAMES.DEAD_LETTER, {
    connection: createRedisConnection() as ConnectionOptions,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
    }
})