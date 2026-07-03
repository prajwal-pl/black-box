import Redis, { type RedisOptions } from "ioredis";

export const redisConfig: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    maxRetriesPerRequest: null, // Disable max retries per request
    enableReadyCheck: true, // Enable ready check to ensure the connection is established
}

export const createRedisConnection = new Redis(redisConfig);