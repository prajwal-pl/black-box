"use client"

import React, { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"

export function ClientProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 5000,
                        refetchOnWindowFocus: false,
                        retry: 1,
                    },
                },
            })
    )

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <Toaster 
                theme="dark" 
                toastOptions={{
                    style: {
                        background: "#0d0d0d",
                        color: "#ffffff",
                        border: "1px solid #262626",
                        borderRadius: "0px",
                        fontFamily: "var(--font-mono), monospace",
                    }
                }} 
            />
        </QueryClientProvider>
    )
}
