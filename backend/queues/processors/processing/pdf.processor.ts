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

        await job.updateProgress(40);
        // pdf-parse v2: constructor takes options object with `data` field
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        const text = result.text;
        const pageCount = result.total;

        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        await StorageService.upload(normalizedTextKey, Buffer.from(text), "text/plain");

        await job.updateProgress(80);
        await graphQueue.add(JOB_NAMES.EXTRACT_ENTITIES, {
            evidenceId,
            caseId,
            normalizedTextKey,
            processorVersion: "1.0.0",
        }, { priority: JOB_PRIORITY.ENTITY_EXTRACTION });

        await job.updateProgress(100);
        return { evidenceId, caseId, normalizedTextKey, pageCount };
    }
}