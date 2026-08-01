import { apiClient } from "./client";

export interface TimelineEvent {
    id: string;
    caseId: string;
    title: string;
    description: string;
    evidenceId: string;
    occuredAt: string | null; // Note database has occuredAt (single 'r')
    confidence: number;
    createdAt: string;
    updatedAt: string;
}

export const timelineApi = {
    getTimeline: async (caseId: string): Promise<TimelineEvent[]> => {
        return apiClient<TimelineEvent[]>(`/cases/${caseId}/timeline`);
    },
};
