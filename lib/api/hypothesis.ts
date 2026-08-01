import { apiClient } from "./client";

export type HypothesisStatus = "ACTIVE" | "CONFIRMED" | "REJECTED";

export interface Hypothesis {
    id: string;
    caseId: string;
    content: string;
    confidence: number;
    status: HypothesisStatus;
    createdAt: string;
    updatedAt: string;
}

export const hypothesisApi = {
    getByCase: async (caseId: string): Promise<Hypothesis[]> => {
        return apiClient<Hypothesis[]>(`/cases/${caseId}/hypotheses`);
    },

    updateStatus: async (id: string, status: HypothesisStatus): Promise<Hypothesis> => {
        return apiClient<Hypothesis>(`/hypotheses/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ status }),
        });
    },

    triggerUpdate: async (caseId: string): Promise<{ jobId: string }> => {
        return apiClient<{ jobId: string }>(`/cases/${caseId}/hypotheses/trigger`, {
            method: "POST",
        });
    },
};
