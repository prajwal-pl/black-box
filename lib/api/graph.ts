import { apiClient } from "./client";

export interface GraphNode {
    id: string;
    name: string;
    type: string;
    caseId?: string;
}

export interface GraphEdge {
    from: string;
    to: string;
    type: string;
    confidence: number;
    caseId?: string;
}

export interface GraphResponse {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export const graphApi = {
    getGraph: async (caseId: string): Promise<GraphResponse> => {
        return apiClient<GraphResponse>(`/cases/${caseId}/graph`);
    },
};
