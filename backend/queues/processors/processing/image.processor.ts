import type { ProcessEvidencePayload } from "../../../types/task-payloads";
import { StorageService } from "../../../services/storage.service";
import Tesseract from "tesseract.js";

export class ImageProcessor {
    static async handle(
        payload: ProcessEvidencePayload,
    ): Promise<{ evidenceId: string; caseId: string; normalizedTextKey: string }> {
        const { caseId, evidenceId, storageKey } = payload;

        console.log(`[IMAGE] ▶ START evidenceId=${evidenceId} caseId=${caseId} storageKey=${storageKey}`);

        console.log(`[IMAGE] Downloading from storage: ${storageKey}`);
        const buffer = await StorageService.download(storageKey);
        console.log(`[IMAGE] Downloaded ${buffer.byteLength} bytes`);

        console.log(`[IMAGE] Running Tesseract OCR...`);
        const { data: { text } } = await Tesseract.recognize(buffer, "eng");
        console.log(`[IMAGE] OCR complete, extracted ${text.length} chars`);

        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        console.log(`[IMAGE] Uploading normalized text to: ${normalizedTextKey}`);
        await StorageService.upload(normalizedTextKey, Buffer.from(text), "text/plain");
        console.log(`[IMAGE] Normalized text uploaded successfully`);

        console.log(`[IMAGE] ✓ DONE evidenceId=${evidenceId}`);
        return { evidenceId, caseId, normalizedTextKey };
    }
}