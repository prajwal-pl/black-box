import type { ProcessEvidencePayload } from "../../../types/task-payloads";
import { StorageService } from "../../../services/storage.service";

export class EmailProcessor {
    static async handle(
        payload: ProcessEvidencePayload,
    ): Promise<{ evidenceId: string; caseId: string; normalizedTextKey: string }> {
        const { caseId, evidenceId, storageKey } = payload;

        console.log(`[EMAIL] ▶ START evidenceId=${evidenceId} caseId=${caseId}`);

        const buffer = await StorageService.download(storageKey);

        // Parse raw email — extract headers and body into normalized plain text.
        // Supports simple RFC-2822-style text; full MIME parsing can be added later
        // by wiring in a library like `mailparser`.
        const raw = buffer.toString("utf-8");
        const lines = raw.split(/\r?\n/);

        const headers: Record<string, string> = {};
        let bodyStartIndex = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line === "" || line === undefined) {
                bodyStartIndex = i + 1;
                break;
            }
            const colonIdx = line.indexOf(":");
            if (colonIdx !== -1) {
                const key = line.substring(0, colonIdx).trim().toLowerCase();
                const value = line.substring(colonIdx + 1).trim();
                headers[key] = value;
            }
        }

        const body = lines.slice(bodyStartIndex).join("\n").trim();

        const normalizedParts: string[] = [];
        if (headers["from"]) normalizedParts.push(`From: ${headers["from"]}`);
        if (headers["to"]) normalizedParts.push(`To: ${headers["to"]}`);
        if (headers["subject"]) normalizedParts.push(`Subject: ${headers["subject"]}`);
        if (headers["date"]) normalizedParts.push(`Date: ${headers["date"]}`);
        if (body) {
            normalizedParts.push("");
            normalizedParts.push(body);
        }

        const normalizedText = normalizedParts.join("\n");
        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        await StorageService.upload(normalizedTextKey, Buffer.from(normalizedText), "text/plain");

        console.log(`[EMAIL] ✓ DONE evidenceId=${evidenceId}`);
        return { evidenceId, caseId, normalizedTextKey };
    }
}
