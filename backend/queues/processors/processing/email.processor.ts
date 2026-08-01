import type { Job } from "bullmq";
import { JOB_NAMES, JOB_PRIORITY, type ProcessEvidencePayload } from "../../jobs/types";
import { StorageService } from "../../../services/storage.service";
import { graphQueue } from "../../definitions/graph.queue";

export class EmailProcessor {
    static async handle(job: Job<ProcessEvidencePayload>) {
        const { caseId, evidenceId, storageKey } = job.data;

        await job.updateProgress(10);
        const buffer = await StorageService.download(storageKey);

        await job.updateProgress(30);

        // Parse raw email text — extract headers and body into normalized plain text.
        // Supports simple RFC-2822-style text; full MIME parsing can be added later
        // by wiring in a library like `mailparser`.
        const raw = buffer.toString("utf-8");
        const lines = raw.split(/\r?\n/);

        const headers: Record<string, string> = {};
        let bodyStartIndex = 0;

        // Headers end at the first blank line
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

        // Build normalized text: surface important headers + full body
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

        await job.updateProgress(80);
        await graphQueue.add(JOB_NAMES.EXTRACT_ENTITIES, {
            evidenceId,
            caseId,
            normalizedTextKey,
            processorVersion: "1.0.0",
        }, { priority: JOB_PRIORITY.ENTITY_EXTRACTION });

        await job.updateProgress(100);
        return { evidenceId, caseId, normalizedTextKey };
    }
}
