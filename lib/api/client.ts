const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface RequestOptions extends RequestInit {
    params?: Record<string, string>;
}

class ApiError extends Error {
    status: number;
    data: any;

    constructor(message: string, status: number, data: any) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers, ...customConfig } = options;
    
    // Build URL with query params if provided
    let url = `${BASE_URL}${endpoint}`;
    if (params) {
        const searchParams = new URLSearchParams(params);
        url += `?${searchParams.toString()}`;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("bb_token") : null;
    
    const defaultHeaders: HeadersInit = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    // If body is FormData, do not set Content-Type header to let browser set boundary automatically
    if (options.body instanceof FormData) {
        delete (defaultHeaders as Record<string, string>)["Content-Type"];
    }

    const config: RequestInit = {
        method: options.method || "GET",
        headers: {
            ...defaultHeaders,
            ...headers,
        },
        ...customConfig,
    };

    try {
        const response = await fetch(url, config);
        
        if (response.status === 401) {
            if (typeof window !== "undefined") {
                localStorage.removeItem("bb_token");
                localStorage.removeItem("bb_user");
                // Avoid infinite redirect loop if already on login page
                if (!window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register")) {
                    window.location.href = "/login";
                }
            }
        }

        const contentType = response.headers.get("content-type");
        let data: any = null;
        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (!response.ok) {
            const errorMessage = data?.message || data?.error || `Request failed with status ${response.status}`;
            throw new ApiError(errorMessage, response.status, data);
        }

        return data as T;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new Error(error instanceof Error ? error.message : "Network error");
    }
}
