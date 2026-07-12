import { apiClient } from "./client";

export interface Case {
    id: string;
    name: string;
    status: "ACTIVE" | "ARCHIVED" | "CLOSED";
    userId: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    createdAt: string;
    updatedAt: string;
}

export interface CasesResponse {
    message: string;
    cases: Case[];
}

export interface CaseResponse {
    message: string;
    case: Case;
}

export const casesApi = {
    getAll: async (): Promise<Case[]> => {
        const response = await apiClient<CasesResponse>("/cases");
        return response.cases;
    },

    getById: async (id: string): Promise<Case> => {
        const response = await apiClient<CaseResponse>(`/cases/${id}`);
        return response.case;
    },

    create: async (data: { name: string }): Promise<Case> => {
        const response = await apiClient<CaseResponse>("/cases", {
            method: "POST",
            body: JSON.stringify(data),
        });
        return response.case;
    },
};
