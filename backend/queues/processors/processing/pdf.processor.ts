import type { Job } from "bullmq";
import { JOB_NAMES, JOB_PRIORITY, type ProcessEvidencePayload } from "../../jobs/types";
import { StorageService } from "../../../services/storage.service";
import { PDFParse } from "pdf-parse";
import { graphQueue } from "../../definitions/graph.queue";

export class PdfProcessor {
    static async handle(job: Job<ProcessEvidencePayload>) {
        const { caseId, evidenceId, storageKey } = job.data;

        await job.updateProgress(10);
        const buffer = await StorageService.download(storageKey);

        job.updateProgress(40);
        const parsedPayload = new PDFParse(buffer);

        const textResult = await parsedPayload.getText();
        const text = textResult.text;
        const total = textResult.total;

        const normalizedTexKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        await StorageService.upload(normalizedTexKey, Buffer.from(text), "text/plain");

        await job.updateProgress(100);
        await graphQueue.add(JOB_NAMES.EXTRACT_ENTITIES, {
            evidenceId,
            caseId,
            normalizedTextKey: normalizedTexKey,
            processorVersion: "1.0.0",
        }, { priority: JOB_PRIORITY.ENTITY_EXTRACTION });

        await job.updateProgress(100);
        return { evidenceId, caseId, normalizedTextKey: normalizedTexKey, pageCount: total };
    }
}