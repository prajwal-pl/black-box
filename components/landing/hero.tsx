"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { IntelGraphCanvas } from "./intel-graph-canvas";
import { DecryptText } from "./decrypt-text";
import { ArrowRight, Shield, Cpu, Network } from "lucide-react";

export const Hero: React.FC = () => {
  const router = useRouter();
  const [time, setTime] = useState("");
  const [isSystemAccessTriggered, setIsSystemAccessTriggered] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toISOString().replace("T", " ").substring(0, 19) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAccess = () => {
    setIsSystemAccessTriggered(true);
    // Add a slight delay for the decryption transition feel before navigating
    setTimeout(() => {
      router.push("/login");
    }, 1200);
  };

  return (
    <section className="relative w-full min-h-screen flex flex-col justify-between items-center bg-black text-white overflow-hidden py-8 px-6 md:px-12 border-b border-hairline select-none">
      {/* 3D Interactive Canvas Background */}
      <div className="absolute inset-0 z-0">
        <IntelGraphCanvas />
      </div>

      {/* Vignette Overlay for Depth */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.85)_90%)]" />

      {/* Scanline/Grid Overlay (Subtle) */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[size:100%_4px,6px_100%]" />

      {/* Top Header HUD */}
      <header className="w-full max-w-[1440px] flex justify-between items-center z-20 font-mono-precision text-[9px] md:text-[10px] tracking-[0.25em] text-muted border-b border-hairline pb-4 pt-2">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 bg-white animate-pulse" />
          <span className="text-white font-bold">BLACKBOX // CLASSIFIED</span>
        </div>
        <div className="hidden lg:flex items-center space-x-8 text-center">
          <span>SECURE CHANNEL GR-23</span>
          <span className="text-warning">LEVEL 4 CLEARANCE REQUIRED</span>
        </div>
        <div className="text-right">
          <span>{time || "0000-00-00 00:00:00 UTC"}</span>
        </div>
      </header>

      {/* Main Core Hero Content */}
      <div className="w-full max-w-[1000px] flex flex-col items-center justify-center flex-1 text-center z-20 py-12 md:py-20 relative">
        
        {/* Decorative corner brackets */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-muted-soft pointer-events-none" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-muted-soft pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-muted-soft pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-muted-soft pointer-events-none" />

        {/* Small classified badge */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 flex items-center space-x-2 bg-hairline px-3 py-1 border border-hairline-strong text-[9px] md:text-[10px] tracking-[0.3em] uppercase text-muted"
        >
          <Shield size={10} className="text-warning animate-pulse" />
          <span>INTELLIGENCE AGENCY CLEARANCE APPROVED</span>
        </motion.div>

        {/* Massive encrypted title reveal */}
        <div className="overflow-hidden mb-6 py-2 px-6">
          <motion.h1 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-5xl md:text-7xl lg:text-9xl font-bold tracking-[0.1em] text-white leading-none uppercase selection:bg-white selection:text-black"
          >
            BLACKBOX
          </motion.h1>
        </div>

        {/* Decrypting Tagline */}
        <div className="mb-8 font-mono-precision text-[10px] md:text-[12px] tracking-[0.35em] text-muted-soft uppercase max-w-[600px] leading-relaxed">
          <DecryptText text="INTELLIGENCE OPERATING SYSTEM" delay={400} duration={1200} />
        </div>

        {/* Mission Statement (Copy) */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="font-sans-body text-sm md:text-[15px] text-muted max-w-[560px] leading-relaxed mb-12"
        >
          Transform thousands of disconnected evidence artifacts into a continuously evolving intelligence graph capable of reasoning over investigations.
        </motion.p>

        {/* CTA System Access Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative group cursor-pointer"
          onClick={handleAccess}
        >
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          
          <button 
            disabled={isSystemAccessTriggered}
            className="relative bg-transparent hover:bg-white hover:text-black text-white border border-white font-mono-precision text-[10px] md:text-[11px] tracking-[0.25em] font-semibold py-4 px-8 md:px-12 transition-all duration-500 rounded-none overflow-hidden uppercase flex items-center space-x-3"
          >
            {/* Scanline transition effect inside button */}
            <span className="absolute top-0 left-0 w-full h-[1px] bg-white/50 -translate-y-full group-hover:animate-scan" />
            
            <span>
              {isSystemAccessTriggered ? (
                <DecryptText text="DECRYPTING ACCESS PORT..." duration={800} />
              ) : (
                "INITIATE SYSTEM ACCESS"
              )}
            </span>
            <ArrowRight size={12} className="group-hover:translate-x-1.5 transition-transform duration-300" />
          </button>

          {/* Dotted border indicator lines around button */}
          <div className="absolute -top-1.5 -left-1.5 w-2 h-2 border-t border-l border-white/50" />
          <div className="absolute -top-1.5 -right-1.5 w-2 h-2 border-t border-r border-white/50" />
          <div className="absolute -bottom-1.5 -left-1.5 w-2 h-2 border-b border-l border-white/50" />
          <div className="absolute -bottom-1.5 -right-1.5 w-2 h-2 border-b border-r border-white/50" />
        </motion.div>
      </div>

      {/* Bottom Footer HUD */}
      <footer className="w-full max-w-[1440px] flex flex-col md:flex-row justify-between items-center z-20 font-mono-precision text-[9px] tracking-[0.2em] text-muted border-t border-hairline pt-4 gap-4 md:gap-0">
        <div className="flex items-center space-x-6">
          <span>SYS_REV: V0.8.2-BETA</span>
          <span className="hidden sm:inline">|</span>
          <span className="hidden sm:inline">ALGO_KEY: 256-BIT ECC / RSA</span>
        </div>
        
        {/* Animated Scroll indicator */}
        <div className="flex items-center space-x-2 text-white animate-pulse">
          <span>[</span>
          <span className="tracking-[0.3em] uppercase text-[8px]">SCROLL TO DECIPHER</span>
          <span>]</span>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-1.5">
            <Cpu size={10} className="text-success" />
            <span>SECURE ENCLAVE ACTIVE</span>
          </div>
        </div>
      </footer>
    </section>
  );
};
