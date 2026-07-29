"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Terminal, ArrowRight, Lock } from "lucide-react";
import { DecryptText } from "./decrypt-text";

export const ClosingCta: React.FC = () => {
  const router = useRouter();
  const [time, setTime] = useState("");
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toISOString().replace("T", " ").substring(0, 19) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full min-h-screen bg-black flex flex-col justify-between items-center py-16 px-6 md:px-12 relative z-30 overflow-hidden select-none border-t border-hairline">
      {/* Absolute dark vignette backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_10%,#000000_80%)] pointer-events-none" />
      
      {/* Top telemetry indicator */}
      <div className="w-full max-w-[1440px] flex justify-between items-center font-mono text-[9px] text-muted-soft tracking-[0.2em] border-b border-hairline pb-4 pt-2">
        <span>SECURITY_PORT_99 // SYSTEM_TERMINATION</span>
        <span>{time || "0000-00-00 00:00:00 UTC"}</span>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-[800px] text-center space-y-12 my-auto z-10 py-12 relative">
        {/* Animated corner lines */}
        <div className="absolute -top-6 -left-6 w-3 h-3 border-t border-l border-muted-soft" />
        <div className="absolute -top-6 -right-6 w-3 h-3 border-t border-r border-muted-soft" />
        <div className="absolute -bottom-6 -left-6 w-3 h-3 border-b border-l border-muted-soft" />
        <div className="absolute -bottom-6 -right-6 w-3 h-3 border-b border-r border-muted-soft" />

        <div className="flex justify-center">
          <div className="p-3 border border-hairline bg-surface-soft text-muted-soft flex items-center space-x-2 rounded-none">
            <Lock size={12} className="text-warning animate-pulse" />
            <span className="font-mono text-[8px] tracking-[0.3em] uppercase">SYSTEM DISCONNECT SECURE</span>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-3xl md:text-6xl tracking-wider text-white uppercase leading-tight">
            <DecryptText text="THE INVESTIGATION REVOLUTION" delay={200} duration={1000} />
          </h2>
          <p className="font-sans-body text-sm md:text-base text-muted max-w-[600px] mx-auto leading-relaxed">
            Ready to deploy the BlackBox intelligence operating system to your secure environment? Select your authorization protocol to begin.
          </p>
        </div>

        {/* Dynamic Interactive CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
          {/* Main Action: Register */}
          <div className="relative group cursor-pointer" onClick={() => router.push("/register")}>
            <button className="bg-white hover:bg-transparent text-black hover:text-white border border-white font-mono-precision text-[10px] md:text-[11px] tracking-[0.25em] font-semibold py-4 px-8 transition-all duration-300 rounded-none uppercase flex items-center space-x-2">
              <span>INITIALIZE SECURITY CORE</span>
              <ArrowRight size={11} className="group-hover:translate-x-1 transition-transform duration-300" />
            </button>
            <div className="absolute -top-1 -left-1 w-1.5 h-1.5 border-t border-l border-white/50" />
            <div className="absolute -top-1 -right-1 w-1.5 h-1.5 border-t border-r border-white/50" />
            <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 border-b border-l border-white/50" />
            <div className="absolute -bottom-1 -right-1 w-1.5 h-1.5 border-b border-r border-white/50" />
          </div>

          {/* Secondary Action: Login */}
          <button 
            onClick={() => router.push("/login")}
            className="bg-transparent hover:bg-hairline text-muted hover:text-white border border-hairline hover:border-muted font-mono-precision text-[10px] md:text-[11px] tracking-[0.25em] font-semibold py-4 px-8 transition-all duration-300 rounded-none uppercase flex items-center space-x-2"
          >
            <span>OPERATOR LOGIN</span>
          </button>
        </div>

        {/* Small live audit ledger representing active security logs */}
        <div className="border border-hairline bg-surface-soft/60 p-4 font-mono text-[8px] md:text-[9px] text-muted-soft text-left max-w-[480px] mx-auto select-none space-y-1">
          <div className="flex justify-between items-center text-[7px] text-muted border-b border-hairline pb-2 mb-2">
            <span>SECURE_ENCLAVE_SYSTEM_LOGS</span>
            <span className="text-success">[ONLINE]</span>
          </div>
          <p>&gt; SECURE_LOGOUT_CLEANUP... COMPLETE</p>
          <p>&gt; WIPING CACHED EVIDENCE IDENTIFIERS... OK</p>
          <p>&gt; PORT 443 TERMINATING IDLE HANDSHAKES...</p>
        </div>
      </div>

      {/* Bottom Footer Credits */}
      <footer className="w-full max-w-[1440px] flex flex-col sm:flex-row justify-between items-center font-mono text-[9px] text-muted-soft tracking-[0.2em] border-t border-hairline pt-4 gap-4 sm:gap-0">
        <div className="flex items-center space-x-2">
          <ShieldCheck size={10} className="text-success" />
          <span>FIPS 140-2 COMPLIANT SECURITY CORE</span>
        </div>
        <span>BLACKBOX INC. // ALL RIGHTS RESERVED</span>
      </footer>
    </div>
  );
};
