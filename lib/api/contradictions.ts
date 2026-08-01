import { apiClient } from "./client";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ContradictionStatus = "OPEN" | "RESOLVED" | "DISMISSED";

export interface Contradiction {
    id: string;
    caseId: string;
    title: string;
    description: string;
    severity: Severity;
    status: ContradictionStatus;
    evidenceIds: string[];
    createdAt: string;
    updatedAt: string;
}

export const contradictionsApi = {
    getByCase: async (caseId: string): Promise<Contradiction[]> => {
        return apiClient<Contradiction[]>(`/cases/${caseId}/contradictions`);
    },

    updateStatus: async (id: string, status: ContradictionStatus): Promise<Contradiction> => {
        return apiClient<Contradiction>(`/contradictions/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ status }),
        });
    },

    triggerScan: async (caseId: string, evidenceId: string): Promise<{ jobId: string }> => {
        return apiClient<{ jobId: string }>(`/cases/${caseId}/contradictions/scan`, {
            method: "POST",
            body: JSON.stringify({ evidenceId }),
        });
    },
};
