import type { Job } from "bullmq";
import { JOB_NAMES, JOB_PRIORITY, type ProcessEvidencePayload } from "../../jobs/types";
import { StorageService } from "../../../services/storage.service";
import Tesseract from "tesseract.js";
import { graphQueue } from "../../definitions/graph.queue";

export class TextProcessor {
    static async handle(job: Job<ProcessEvidencePayload>) {
        const { caseId, evidenceId, storageKey } = job.data;

        await job.updateProgress(10);
        const buffer = await StorageService.download(storageKey);

        await job.updateProgress(30);
        const { data: { text } } = await Tesseract.recognize(buffer, "eng");

        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        await StorageService.upload(normalizedTextKey, Buffer.from(text), "text/plain");

        await job.updateProgress(80);
        await graphQueue.add(JOB_NAMES.EXTRACT_ENTITIES, {
            evidenceId,
            caseId,
            normalizedTextKey: normalizedTextKey,
            processorVersion: "1.0.0",
        }, { priority: JOB_PRIORITY.OCR });

        await job.updateProgress(100);
        return { evidenceId, caseId, normalizedTextKey };
    }
}