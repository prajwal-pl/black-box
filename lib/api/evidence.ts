import { apiClient } from "./client";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface Evidence {
    id: string;
    caseId: string;
    description: string | null;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    storageKey: string;
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
    createdAt: string;
    updatedAt: string;
}

export interface EvidenceListResponse {
    evidence: Evidence[];
}

export interface EvidenceStatusResponse {
    id: string;
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
}

export interface UploadResponse {
    evidenceId: string;
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
    message?: string;
}

export const evidenceApi = {
    upload: async (
        caseId: string, 
        file: File, 
        onProgress?: (progress: number) => void
    ): Promise<UploadResponse> => {
        return new Promise((resolve, reject) => {
            const token = typeof window !== "undefined" ? localStorage.getItem("bb_token") : null;
            const xhr = new XMLHttpRequest();
            const url = `${BASE_URL}/cases/${caseId}/evidence`;
            
            xhr.open("POST", url, true);
            if (token) {
                xhr.setRequestHeader("Authorization", `Bearer ${token}`);
            }

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && onProgress) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    onProgress(percentComplete);
                }
            };

            xhr.onload = () => {
                let data: any = null;
                const contentType = xhr.getResponseHeader("content-type");
                if (contentType && contentType.includes("application/json")) {
                    try {
                        data = JSON.parse(xhr.responseText);
                    } catch {
                        data = xhr.responseText;
                    }
                } else {
                    data = xhr.responseText;
                }

                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(data);
                } else {
                    const message = data?.message || data?.error || `Upload failed with status ${xhr.status}`;
                    reject(new Error(message));
                }
            };

            xhr.onerror = () => {
                reject(new Error("Network error during file upload."));
            };

            const formData = new FormData();
            formData.append("file", file);
            xhr.send(formData);
        });
    },

    getByCase: async (caseId: string): Promise<Evidence[]> => {
        const response = await apiClient<EvidenceListResponse>(`/cases/${caseId}/evidence`);
        return response.evidence;
    },

    getStatus: async (id: string): Promise<EvidenceStatusResponse> => {
        return apiClient<EvidenceStatusResponse>(`/evidence/${id}/status`);
    },

    delete: async (id: string): Promise<{ message: string }> => {
        return apiClient<{ message: string }>(`/evidence/${id}`, {
            method: "DELETE",
        });
    },
};
