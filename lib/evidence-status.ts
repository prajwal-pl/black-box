export type EvidenceStatus =
    | "PENDING"
    | "PROCESSING"
    | "EXTRACTING"
    | "EXTRACTING_ENTITIES"
    | "UPDATING_GRAPH"
    | "GENERATING_EMBEDDINGS"
    | "ANALYZING"
    | "COMPLETED"
    | "FAILED";

export const EVIDENCE_STATUSES = Object.values({
    PENDING: "PENDING",
    PROCESSING: "PROCESSING",
    EXTRACTING: "EXTRACTING",
    EXTRACTING_ENTITIES: "EXTRACTING_ENTITIES",
    UPDATING_GRAPH: "UPDATING_GRAPH",
    GENERATING_EMBEDDINGS: "GENERATING_EMBEDDINGS",
    ANALYZING: "ANALYZING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
}) as EvidenceStatus[];

/** Stages that still have pipeline work in flight — poll until none remain. */
export const isEvidenceProcessing = (status: string): boolean =>
    status !== "COMPLETED" && status !== "FAILED";

export interface EvidenceStageMeta {
    /** Human-readable label shown in the UI */
    label: string;
    /** Approximate pipeline completion fraction, drives the progress bar */
    progress: number;
}

export const EVIDENCE_STAGE_META: Record<EvidenceStatus, EvidenceStageMeta> = {
    PENDING: { label: "QUEUED", progress: 5 },
    PROCESSING: { label: "INGESTING", progress: 12 },
    EXTRACTING: { label: "EXTRACTING TEXT", progress: 30 },
    EXTRACTING_ENTITIES: { label: "EXTRACTING ENTITIES", progress: 50 },
    UPDATING_GRAPH: { label: "BUILDING GRAPH", progress: 65 },
    GENERATING_EMBEDDINGS: { label: "INDEXING VECTORS", progress: 80 },
    ANALYZING: { label: "ANALYZING", progress: 92 },
    COMPLETED: { label: "COMPLETE", progress: 100 },
    FAILED: { label: "FAILED", progress: 100 },
};
