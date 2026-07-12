import type { Job } from "bullmq";
import { JOB_NAMES, JOB_PRIORITY, type ProcessEvidencePayload } from "../../jobs/types";
import { StorageService } from "../../../services/storage.service";
import * as XLSX from "xlsx";
import { graphQueue } from "../../definitions/graph.queue";

export class SpreadsheetProcessor {
    static async handle(job: Job<ProcessEvidencePayload>) {
        const { evidenceId, caseId, storageKey } = job.data;

        await job.updateProgress(10);
        const buffer = await StorageService.download(storageKey);

        const workbook = XLSX.read(buffer)
        const lines: string[] = [];

        for (const sheetName of workbook.SheetNames) {
            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
                workbook.Sheets[sheetName]!
            );
            for (const row of rows) {
                lines.push(Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(", "));
            }
        }

        const text = lines.join("\n");
        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        await StorageService.upload(normalizedTextKey, Buffer.from(text), "text/plain");

        await job.updateProgress(80);
        await graphQueue.add(JOB_NAMES.EXTRACT_ENTITIES, {
            evidenceId,
            caseId,
            normalizedTextKey,
            processorVersion: "1.0",
        }, { priority: JOB_PRIORITY.ENTITY_EXTRACTION });

        await job.updateProgress(100);
        return { evidenceId, normalizedTextKey };
    }
}