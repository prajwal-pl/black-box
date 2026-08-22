import { task } from "@trigger.dev/sdk";
import { ContradictionProcessor } from "../../queues/processors/contradictions.processor";
import type { ScanContradictionsPayload } from "../../types/task-payloads";
import db from "../../lib/db";

/** Scans for contradictions between new and existing evidence via LLM + Qdrant. */
export const scanContradictionsTask = task({
    id: "scan-contradictions",
    machine: "micro",
    maxDuration: 600, // 10 min — Qdrant similarity search + LLM comparison
    retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 10_000 },

    // Terminal step of the per-evidence pipeline — mark FAILED if all retries exhaust
    onFailure: async ({ payload, error }) => {
        console.error(`[TASK:CONTRADICTIONS] ✗ All retries exhausted for evidenceId=${payload.evidenceId}. Marking FAILED.`, (error as Error).message);
        try {
            await db.evidence.update({ where: { id: payload.evidenceId }, data: { status: "FAILED" } });
        } catch (dbErr) {
            console.error(`[TASK:CONTRADICTIONS] Failed to update status to FAILED:`, dbErr);
        }
    },

    run: async (payload: ScanContradictionsPayload) => {
        console.log(`[TASK:CONTRADICTIONS] Scanning contradictions for evidenceId=${payload.evidenceId}`);
        const result = await ContradictionProcessor.handle(payload);

        await db.evidence.update({ where: { id: payload.evidenceId }, data: { status: "COMPLETED" } });
        console.log(`[TASK:CONTRADICTIONS] Evidence status → COMPLETED`);

        return result;
    },
});
