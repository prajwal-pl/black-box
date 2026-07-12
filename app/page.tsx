"use client"

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("bb_token");
    if (token) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-black text-white min-h-screen">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="animate-spin text-white" size={32} />
        <p className="font-mono-precision text-[10px] tracking-[0.3em] text-muted">
          INITIALIZING OS...
        </p>
      </div>
    </div>
  );
}
