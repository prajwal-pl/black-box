import type { Job } from "bullmq";
import { JOB_NAMES, JOB_PRIORITY, type ProcessEvidencePayload } from "../../jobs/types";
import { StorageService } from "../../../services/storage.service";
import { PDFParse } from "pdf-parse";
import { graphQueue } from "../../definitions/graph.queue";

export class PdfProcessor {
    static async handle(job: Job<ProcessEvidencePayload>) {
        const { caseId, evidenceId, storageKey } = job.data;

        console.log(`[PDF] ▶ START evidenceId=${evidenceId} caseId=${caseId} storageKey=${storageKey}`);

        await job.updateProgress(10);
        console.log(`[PDF] Downloading from storage: ${storageKey}`);
        const buffer = await StorageService.download(storageKey);
        console.log(`[PDF] Downloaded ${buffer.byteLength} bytes`);

        await job.updateProgress(40);
        console.log(`[PDF] Parsing PDF...`);
        // pdf-parse v2: constructor takes options object with `data` field
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        const text = result.text;
        const pageCount = result.total;
        console.log(`[PDF] Parsed ${pageCount} pages, extracted ${text.length} chars of text`);

        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        console.log(`[PDF] Uploading normalized text to: ${normalizedTextKey}`);
        await StorageService.upload(normalizedTextKey, Buffer.from(text), "text/plain");
        console.log(`[PDF] Normalized text uploaded successfully`);

        await job.updateProgress(80);
        console.log(`[PDF] Enqueuing EXTRACT_ENTITIES job for evidenceId=${evidenceId}`);
        const enqueued = await graphQueue.add(JOB_NAMES.EXTRACT_ENTITIES, {
            evidenceId,
            caseId,
            normalizedTextKey,
            processorVersion: "1.0.0",
        }, { priority: JOB_PRIORITY.ENTITY_EXTRACTION });
        console.log(`[PDF] EXTRACT_ENTITIES job enqueued: jobId=${enqueued.id}`);

        await job.updateProgress(100);
        console.log(`[PDF] ✓ DONE evidenceId=${evidenceId} pageCount=${pageCount}`);
        return { evidenceId, caseId, normalizedTextKey, pageCount };
    }
}