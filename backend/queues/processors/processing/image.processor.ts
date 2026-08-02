import type { Job } from "bullmq";
import { JOB_NAMES, JOB_PRIORITY, type ProcessEvidencePayload } from "../../jobs/types";
import { StorageService } from "../../../services/storage.service";
import Tesseract from "tesseract.js";
import { graphQueue } from "../../definitions/graph.queue";

export class ImageProcessor {
    static async handle(job: Job<ProcessEvidencePayload>) {
        const { caseId, evidenceId, storageKey } = job.data;

        console.log(`[IMAGE] ▶ START evidenceId=${evidenceId} caseId=${caseId} storageKey=${storageKey}`);

        await job.updateProgress(10);
        console.log(`[IMAGE] Downloading from storage: ${storageKey}`);
        const buffer = await StorageService.download(storageKey);
        console.log(`[IMAGE] Downloaded ${buffer.byteLength} bytes`);

        await job.updateProgress(30);
        console.log(`[IMAGE] Running Tesseract OCR...`);
        const { data: { text } } = await Tesseract.recognize(buffer, "eng");
        console.log(`[IMAGE] OCR complete, extracted ${text.length} chars`);

        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        console.log(`[IMAGE] Uploading normalized text to: ${normalizedTextKey}`);
        await StorageService.upload(normalizedTextKey, Buffer.from(text), "text/plain");
        console.log(`[IMAGE] Normalized text uploaded successfully`);

        await job.updateProgress(80);
        console.log(`[IMAGE] Enqueuing EXTRACT_ENTITIES job for evidenceId=${evidenceId}`);
        const enqueued = await graphQueue.add(JOB_NAMES.EXTRACT_ENTITIES, {
            evidenceId,
            caseId,
            normalizedTextKey: normalizedTextKey,
            processorVersion: "1.0.0",
        }, { priority: JOB_PRIORITY.OCR });
        console.log(`[IMAGE] EXTRACT_ENTITIES job enqueued: jobId=${enqueued.id}`);

        await job.updateProgress(100);
        console.log(`[IMAGE] ✓ DONE evidenceId=${evidenceId}`);
        return { evidenceId, caseId, normalizedTextKey };
    }
}