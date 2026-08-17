import type { UploadEvidencePayload, EvidenceTypes } from "../../types/task-payloads";
import db from "../../lib/db";

export const classifyByMimeType = (mimeType: string): EvidenceTypes => {
    if (mimeType === "application/pdf") return "pdf";
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("text/")) return "text";
    if (
        mimeType === "application/vnd.ms-excel" ||
        mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) return "spreadsheet";
    if (mimeType.startsWith("message/")) return "email";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    return "unknown";
};

export class IngestionProcessor {
    /**
     * Mark evidence as PROCESSING and return classified evidence type.
     * Previously split across upload + classify BullMQ jobs — now a single pure function.
     */
    static async handle(payload: UploadEvidencePayload): Promise<{ evidenceId: string; evidenceType: EvidenceTypes }> {
        const { caseId, evidenceId, mimeType } = payload;

        console.log(`[INGESTION] ▶ START evidenceId=${evidenceId} caseId=${caseId} mimeType=${mimeType}`);

        console.log(`[INGESTION] Updating evidence status to PROCESSING...`);
        await db.evidence.update({
            where: { id: evidenceId },
            data: { status: "PROCESSING" },
        });
        console.log(`[INGESTION] Evidence status set to PROCESSING`);

        const evidenceType = classifyByMimeType(mimeType);
        console.log(`[INGESTION] Classified as evidenceType=${evidenceType}`);

        console.log(`[INGESTION] ✓ DONE evidenceId=${evidenceId} evidenceType=${evidenceType}`);
        return { evidenceId, evidenceType };
    }
}