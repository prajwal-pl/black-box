import type { ProcessEvidencePayload } from "../../../types/task-payloads";
import { StorageService } from "../../../services/storage.service";

export class TextProcessor {
    static async handle(
        payload: ProcessEvidencePayload,
    ): Promise<{ evidenceId: string; normalizedTextKey: string }> {
        const { caseId, storageKey, evidenceId } = payload;

        console.log(`[TEXT] ▶ START evidenceId=${evidenceId} caseId=${caseId} storageKey=${storageKey}`);

        console.log(`[TEXT] Downloading from storage: ${storageKey}`);
        const buffer = await StorageService.download(storageKey);
        console.log(`[TEXT] Downloaded ${buffer.byteLength} bytes`);

        const text = buffer.toString("utf-8");
        console.log(`[TEXT] Decoded to ${text.length} chars`);

        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        console.log(`[TEXT] Uploading normalized text to: ${normalizedTextKey}`);
        await StorageService.upload(normalizedTextKey, Buffer.from(text), "text/plain");
        console.log(`[TEXT] Normalized text uploaded successfully`);

        console.log(`[TEXT] ✓ DONE evidenceId=${evidenceId}`);
        return { evidenceId, normalizedTextKey };
    }
}