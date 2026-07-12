import type { Job } from "bullmq";
import { JOB_NAMES, JOB_PRIORITY, type ProcessEvidencePayload } from "../../jobs/types";
import { StorageService } from "../../../services/storage.service";
import { graphQueue } from "../../definitions/graph.queue";

export class TextProcessor {
    static async handle(job: Job<ProcessEvidencePayload>) {
        const { caseId, storageKey, evidenceId } = job.data;

        await job.updateProgress(10);
        const buffer = await StorageService.download(storageKey);

        const text = buffer.toString("utf-8");
        await job.updateProgress(50);

        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        await StorageService.upload(normalizedTextKey, Buffer.from(text), "text/plain");

        await job.updateProgress(80);
        await graphQueue.add(JOB_NAMES.EXTRACT_ENTITIES, {
            evidenceId,
            caseId,
            normalizedTextKey: normalizedTextKey,
            processorVersion: "1.0.0",
        }, { priority: JOB_PRIORITY.ENTITY_EXTRACTION });

        await job.updateProgress(100);
        return { evidenceId, normalizedTextKey };
    }
}