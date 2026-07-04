import { Queue, type ConnectionOptions } from "bullmq";
import { QUEUE_NAMES } from "../jobs/types";
import { createRedisConnection } from "../config/redis.config";

export const maintenanceQueue = new Queue(QUEUE_NAMES.MAINTENANCE, {
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