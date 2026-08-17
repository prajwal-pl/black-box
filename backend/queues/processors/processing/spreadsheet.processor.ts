import type { ProcessEvidencePayload } from "../../../types/task-payloads";
import { StorageService } from "../../../services/storage.service";
import * as XLSX from "xlsx";

export class SpreadsheetProcessor {
    static async handle(
        payload: ProcessEvidencePayload,
    ): Promise<{ evidenceId: string; normalizedTextKey: string }> {
        const { evidenceId, caseId, storageKey } = payload;

        console.log(`[SPREADSHEET] ▶ START evidenceId=${evidenceId} caseId=${caseId}`);

        const buffer = await StorageService.download(storageKey);
        const workbook = XLSX.read(buffer);
        const lines: string[] = [];

        for (const sheetName of workbook.SheetNames) {
            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
                workbook.Sheets[sheetName]!,
            );
            for (const row of rows) {
                lines.push(
                    Object.entries(row)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", "),
                );
            }
        }

        const text = lines.join("\n");
        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        await StorageService.upload(normalizedTextKey, Buffer.from(text), "text/plain");

        console.log(`[SPREADSHEET] ✓ DONE evidenceId=${evidenceId} lines=${lines.length}`);
        return { evidenceId, normalizedTextKey };
    }
}