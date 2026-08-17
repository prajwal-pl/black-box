import { task } from "@trigger.dev/sdk/v3";
import { GraphProcessor } from "../../queues/processors/graph.processor";
import type { BuildTimelinePayload } from "../../types/task-payloads";

/** Extracts timeline events from the extraction JSON and persists them to PostgreSQL. */
export const buildTimelineTask = task({
    id: "build-timeline",
    machine: { preset: "micro" },
    maxDuration: 120,
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 5_000 },
    run: async (payload: BuildTimelinePayload) => {
        console.log(`[TASK:TIMELINE] Building timeline for evidenceId=${payload.evidenceId}`);
        const result = await GraphProcessor.handleBuildTimeline(payload);
        console.log(`[TASK:TIMELINE] ✓ Done for evidenceId=${payload.evidenceId}`);
        return result;
    },
});
