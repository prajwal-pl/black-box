import type { Job } from "bullmq";
import { JOB_NAMES, JOB_PRIORITY, type ProcessEvidencePayload } from "../../jobs/types";
import { StorageService } from "../../../services/storage.service";
import { graphQueue } from "../../definitions/graph.queue";

export class TextProcessor {
    static async handle(job: Job<ProcessEvidencePayload>) {
        const { caseId, storageKey, evidenceId } = job.data;

        console.log(`[TEXT] ▶ START evidenceId=${evidenceId} caseId=${caseId} storageKey=${storageKey}`);

        await job.updateProgress(10);
        console.log(`[TEXT] Downloading from storage: ${storageKey}`);
        const buffer = await StorageService.download(storageKey);
        console.log(`[TEXT] Downloaded ${buffer.byteLength} bytes`);

        const text = buffer.toString("utf-8");
        console.log(`[TEXT] Decoded to ${text.length} chars`);
        await job.updateProgress(50);

        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        console.log(`[TEXT] Uploading normalized text to: ${normalizedTextKey}`);
        await StorageService.upload(normalizedTextKey, Buffer.from(text), "text/plain");
        console.log(`[TEXT] Normalized text uploaded successfully`);

        await job.updateProgress(80);
        console.log(`[TEXT] Enqueuing EXTRACT_ENTITIES job for evidenceId=${evidenceId}`);
        const enqueued = await graphQueue.add(JOB_NAMES.EXTRACT_ENTITIES, {
            evidenceId,
            caseId,
            normalizedTextKey: normalizedTextKey,
            processorVersion: "1.0.0",
        }, { priority: JOB_PRIORITY.ENTITY_EXTRACTION });
        console.log(`[TEXT] EXTRACT_ENTITIES job enqueued: jobId=${enqueued.id}`);

        await job.updateProgress(100);
        console.log(`[TEXT] ✓ DONE evidenceId=${evidenceId}`);
        return { evidenceId, normalizedTextKey };
    }
}