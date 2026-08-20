import { task } from "@trigger.dev/sdk";
import { ContradictionProcessor } from "../../queues/processors/contradictions.processor";
import type { ScanContradictionsPayload } from "../../types/task-payloads";

/** Scans for contradictions between new and existing evidence via LLM + Qdrant. */
export const scanContradictionsTask = task({
    id: "scan-contradictions",
    machine: "micro",
    maxDuration: 600, // 10 min — Qdrant similarity search + LLM comparison
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 10_000 },
    run: async (payload: ScanContradictionsPayload) => {
        console.log(`[TASK:CONTRADICTIONS] Scanning contradictions for evidenceId=${payload.evidenceId}`);
        const result = await ContradictionProcessor.handle(payload);
        console.log(`[TASK:CONTRADICTIONS] ✓ Done for evidenceId=${payload.evidenceId}`);
        return result;
    },
});
