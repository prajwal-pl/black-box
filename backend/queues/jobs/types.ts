export const QUEUE_NAMES = {
    INGESTION: "ingestion",
    PROCESSING: "processing",
    GRAPH: "graph",
    REASONING: "reasoning",
    MAINTENANCE: "maintenance",
    DEAD_LETTER: "dead-letter",
} as const

export const JOB_NAMES = {
    // Ingestion Queue
    UPLOAD_EVIDENCE: "upload-evidence",
    CLASSIFY_EVIDENCE: "classify-evidence",

    // Processing Queue
    PROCESS_PDF: "process-pdf",
    PROCESS_IMAGE: "process-image",
    PROCESS_TEXT: "process-text",
    PROCESS_SPREADSHEET: "process-spreadsheet",
    PROCESS_EMAIL: "process-email",
    PROCESS_AUDIO: "process-audio",
    PROCESS_VIDEO: "process-video",

    // Graph Queue
    UPDATE_GRAPH: "update-graph",
    EXTRACT_ENTITIES: "extract-entities",
    EXTRACT_RELATIONSHIPS: "extract-relationships",

    // Reasoning Queue
    GENERATE_EMBEDDINGS: "generate-embeddings",
    UPDATE_HYPOTHESES: "update-hypotheses",
    SCAN_CONTRADICTIONS: "scan-contradictions",
    BUILD_TIMELINE: "build-timeline",

    // Maintenance Queue
    MERGE_ENTITIES: "merge-entities",
    RESOLVE_ALIASES: "resolve-aliases",
    DETECT_DUPLICATES: "detect-duplicates",
    CLEANUP_JOBS: "cleanup-jobs",

    // Dead Letter 
    DEAD_LETTER: "dead-letter",
} as const

export type EvidenceTypes = "pdf" | "image" | "text" | "spreadsheet" | "email" | "video" | "audio" | "unknown"

export const JOB_PRIORITY = {
    OCR: 10,
    ENTITY_EXTRACTION: 9,
    GRAPH_UPDATE: 8,
    EMBEDDINGS: 7,
    HYPOTHESES: 6,
    REPORTS: 5,
    CLEANUP: 1
} as const

export interface BaseJobPayload {
    caseId: string
    evidenceId: string
    processorVersion: string
    extractionVersion?: string
}

export interface UploadEvidencePayload extends BaseJobPayload {
    storageKey: string
    mimeType: string
    fileName: string
    fileSize: number
    uploadedBy: string
}

export interface ClassifyEvidencePayload extends BaseJobPayload {
    storageKey: string
    mimeType: string
}

export interface ProcessEvidencePayload extends BaseJobPayload {
    storageKey: string
    evidenceType: EvidenceTypes
}

export interface ExtractEntitiesPayload extends BaseJobPayload {
    normalizedTextKey: string
}

export interface UpdateGraphPayload extends BaseJobPayload {
    extractionResultKey: string
}

export interface GenerateEmbeddingsPayload extends BaseJobPayload {
    chunkKeys: string[]
}

export interface BuildTimelinePayload extends BaseJobPayload {
    extractionResultKey: string
}

export interface UpdateHypothesesPayload {
    caseId: string
    triggerReason: "new-evidence" | "contradiction-detected" | "manual"
    newEvidenceCount?: number
}

export interface ScanContradictionsPayload {
    caseId: string
    evidenceId: string
}

export interface MergeEntitiesPayload {
    caseId: string
    entityIds: string[]
    canonicalId: string
}

export interface DeadLetterPayload {
    originalQueue: string
    originalJobName: string
    originalPayload: any
    failureReason: string
    failedAt: Date
    attempts: number
}