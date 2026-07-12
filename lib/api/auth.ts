import { apiClient } from "./client";

export interface User {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AuthResponse {
    message: string;
    token: string;
    user: User;
}

export const authApi = {
    login: async (credentials: Record<string, string>): Promise<AuthResponse> => {
        return apiClient<AuthResponse>("/auth/login", {
            method: "POST",
            body: JSON.stringify(credentials),
        });
    },

    register: async (data: Record<string, string>): Promise<AuthResponse> => {
        return apiClient<AuthResponse>("/auth/register", {
            method: "POST",
            body: JSON.stringify(data),
        });
    },
    
    logout: () => {
        if (typeof window !== "undefined") {
            localStorage.removeItem("bb_token");
            localStorage.removeItem("bb_user");
            window.location.href = "/login";
        }
    },

    getCurrentUser: (): User | null => {
        if (typeof window !== "undefined") {
            const userStr = localStorage.getItem("bb_user");
            if (userStr) {
                try {
                    return JSON.parse(userStr) as User;
                } catch {
                    return null;
                }
            }
        }
        return null;
    }
};
