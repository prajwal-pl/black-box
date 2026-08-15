import Redis from "ioredis";

/**
 * Creates a BullMQ-compatible Redis connection.
 *
 * In production (Upstash), set REDIS_URL to a rediss:// URL for TLS.
 * In local dev, set REDIS_URL to redis://localhost:6379 or leave unset
 * to fall back to the local default.
 *
 * BullMQ requirements:
 *   - maxRetriesPerRequest: null  (must be null, not a number)
 *   - enableReadyCheck: false     (Upstash doesn't support the READY check command)
 */
export const createRedisConnection = () => {
    const url = process.env.REDIS_URL!
    const isTLS = url.startsWith("rediss://");

    return new Redis(url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        ...(isTLS ? { tls: {} } : {}),
    });
};