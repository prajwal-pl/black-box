/**
 * Shared payload types for all Trigger.dev tasks.
 * Replaces the BullMQ jobs/types.ts payload definitions.
 */

export type EvidenceTypes =
    | "pdf"
    | "image"
    | "text"
    | "spreadsheet"
    | "email"
    | "video"
    | "audio"
    | "unknown";

export interface BaseTaskPayload {
    caseId: string;
    evidenceId: string;
    processorVersion: string;
    extractionVersion?: string;
}

export interface UploadEvidencePayload extends BaseTaskPayload {
    storageKey: string;
    mimeType: string;
    fileName: string;
    fileSize: number;
    uploadedBy: string;
}

export interface ProcessEvidencePayload extends BaseTaskPayload {
    storageKey: string;
    evidenceType: EvidenceTypes;
}

export interface ExtractEntitiesPayload extends BaseTaskPayload {
    normalizedTextKey: string;
}

export interface UpdateGraphPayload extends BaseTaskPayload {
    extractionResultKey: string;
}

export interface GenerateEmbeddingsPayload extends BaseTaskPayload {
    chunkKeys: string[];
}

export interface BuildTimelinePayload extends BaseTaskPayload {
    extractionResultKey: string;
}

export interface UpdateHypothesesPayload {
    caseId: string;
    triggerReason: "new-evidence" | "contradiction-detected" | "manual";
    newEvidenceCount?: number;
}

export interface ScanContradictionsPayload {
    caseId: string;
    evidenceId: string;
}

export interface MergeEntitiesPayload {
    caseId: string;
    entityIds: string[];
    canonicalId: string;
}
