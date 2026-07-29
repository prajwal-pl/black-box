"use client";

import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRouter } from "next/navigation";
import { DecryptText } from "./decrypt-text";
import { IntelGraphCanvas } from "./intel-graph-canvas";
import { Shield, Cpu, Lock, ArrowRight, Activity, Terminal, AlertTriangle } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export const CinematicBriefing: React.FC = () => {
  const router = useRouter();
  const [time, setTime] = useState("");
  const [accessTriggered, setAccessTriggered] = useState(false);

  // References for pinning and scrolling
  const pinContainerRef = useRef<HTMLDivElement | null>(null);

  // Video references
  const video1Ref = useRef<HTMLVideoElement | null>(null);
  const video2Ref = useRef<HTMLVideoElement | null>(null);
  const video3Ref = useRef<HTMLVideoElement | null>(null);
  const video4Ref = useRef<HTMLVideoElement | null>(null);

  // Scene overlay references
  const scene1Ref = useRef<HTMLDivElement | null>(null);
  const scene2Ref = useRef<HTMLDivElement | null>(null);
  const scene3Ref = useRef<HTMLDivElement | null>(null);
  const scene4Ref = useRef<HTMLDivElement | null>(null);

  // Extra overlays
  const telemetryFeedRef = useRef<HTMLDivElement | null>(null);
  const reasoningStatsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toISOString().replace("T", " ").substring(0, 19) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const pinContainer = pinContainerRef.current;
    if (!pinContainer) return;

    // Synchronize playheads of videos and scale overlays
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: pinContainer,
        start: "top top",
        end: "+=600%", // 6 screens worth of scroll
        pin: true,
        scrub: 1.5,
        invalidateOnRefresh: true,
      },
    });

    // Helper settings
    const segment = 1;

    // --- ACT I: SYSTEMS INGRESS (Scene 1) ---
    tl.to(video1Ref.current, { scale: 1.15, ease: "none" }, 0)
      .to(scene1Ref.current, { y: -80, opacity: 0, duration: segment }, 0.8)
      .to(video1Ref.current, { opacity: 0, duration: segment }, 0.8)

      // --- ACT II: INGESTION & DECRYPTION (Scene 2) ---
      .fromTo(
        video2Ref.current,
        { opacity: 0, scale: 0.95 },
        { opacity: 0.5, scale: 1.1, duration: segment },
        0.8
      )
      .fromTo(
        scene2Ref.current,
        { opacity: 0, y: 80 },
        { opacity: 1, y: 0, duration: segment },
        1.0
      )
      // Slide in telemetry lists overlay for Scene 2
      .fromTo(
        telemetryFeedRef.current,
        { opacity: 0, x: 100 },
        { opacity: 1, x: 0, duration: segment },
        1.2
      )
      .to(scene2Ref.current, { y: -80, opacity: 0, duration: segment }, 2.0)
      .to(telemetryFeedRef.current, { opacity: 0, x: -100, duration: segment }, 2.0)
      .to(video2Ref.current, { opacity: 0, duration: segment }, 2.0)

      // --- ACT III: COGNITIVE REASONING (Scene 3) ---
      .fromTo(
        video3Ref.current,
        { opacity: 0, scale: 0.95 },
        { opacity: 0.5, scale: 1.15, duration: segment },
        2.0
      )
      .fromTo(
        scene3Ref.current,
        { opacity: 0, y: 80 },
        { opacity: 1, y: 0, duration: segment },
        2.2
      )
      // Reveal reasoning metrics
      .fromTo(
        reasoningStatsRef.current,
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: segment },
        2.4
      )
      .to(scene3Ref.current, { y: -80, opacity: 0, duration: segment }, 3.2)
      .to(reasoningStatsRef.current, { opacity: 0, scale: 0.9, duration: segment }, 3.2)
      .to(video3Ref.current, { opacity: 0, duration: segment }, 3.2)

      // --- ACT IV: GLOBAL FINALE (Scene 4) ---
      .fromTo(
        video4Ref.current,
        { opacity: 0, scale: 0.8 },
        { opacity: 0.7, scale: 1.05, duration: segment * 1.5 },
        3.2
      )
      .fromTo(
        scene4Ref.current,
        { opacity: 0, y: 100 },
        { opacity: 1, y: 0, duration: segment * 1.2 },
        3.5
      );

    return () => {
      ScrollTrigger.getAll().forEach((t) => {
        if (t.trigger === pinContainer) t.kill();
      });
    };
  }, []);

  const handleAccess = () => {
    setAccessTriggered(true);
    setTimeout(() => {
      router.push("/login");
    }, 1200);
  };

  return (
    <div ref={pinContainerRef} className="w-full h-screen bg-black overflow-hidden relative select-none">
      
      {/* Background Video Layers */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        
        {/* Video 1: Infrastructure */}
        <video
          ref={video1Ref}
          src="/assets/data-center.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-35 mix-blend-screen transition-all duration-300"
          style={{ maskImage: "radial-gradient(circle at center, black 40%, transparent 85%)", WebkitMaskImage: "radial-gradient(circle at center, black 40%, transparent 85%)" }}
        />

        {/* Video 2: Network Ingestion */}
        <video
          ref={video2Ref}
          src="/assets/network.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-0 mix-blend-screen transition-all duration-300"
          style={{ maskImage: "radial-gradient(circle at center, black 40%, transparent 85%)", WebkitMaskImage: "radial-gradient(circle at center, black 40%, transparent 85%)" }}
        />

        {/* Video 3: Core Reasoning */}
        <video
          ref={video3Ref}
          src="/assets/network-2.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-0 mix-blend-screen transition-all duration-300"
          style={{ maskImage: "radial-gradient(circle at center, black 40%, transparent 85%)", WebkitMaskImage: "radial-gradient(circle at center, black 40%, transparent 85%)" }}
        />

        {/* Video 4: Global Operations */}
        <video
          ref={video4Ref}
          src="/assets/globe.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-0 mix-blend-screen transition-all duration-300"
          style={{ maskImage: "radial-gradient(circle at center, black 35%, transparent 80%)", WebkitMaskImage: "radial-gradient(circle at center, black 35%, transparent 80%)" }}
        />
      </div>

      {/* Grid Scanlines & HUD telemetry overlays */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="absolute inset-0 z-10 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%)] bg-[size:100%_4px]" />
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.85)_95%)]" />

      {/* Shared HUD Header */}
      <header className="absolute top-0 left-0 right-0 max-w-[1440px] mx-auto px-6 md:px-12 py-6 flex justify-between items-center z-50 font-mono text-[9px] md:text-[10px] tracking-[0.25em] text-muted border-b border-hairline/60">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 bg-white animate-pulse" />
          <span className="text-white font-bold">BLACKBOX // OPERATIONAL MODE</span>
        </div>
        <div className="hidden lg:flex items-center space-x-8">
          <span>CHANNEL SECURE GR-23</span>
          <span className="text-warning">CLASSIFIED BRIEFING</span>
        </div>
        <span>{time || "0000-00-00 00:00:00 UTC"}</span>
      </header>

      {/* SCENE 1 OVERLAY: Act I - Infrastructure */}
      <div ref={scene1Ref} className="absolute inset-0 flex flex-col justify-center items-start px-6 md:px-24 z-20 select-none max-w-[800px] text-left space-y-6">
        <div className="flex items-center space-x-3 text-[9px] md:text-[10px] font-mono tracking-[0.3em] text-muted">
          <Terminal size={12} className="text-muted" />
          <span>01 / INFRASTRUCTURE STAGE</span>
        </div>
        <h1 className="font-display text-4xl md:text-7xl tracking-wide uppercase text-white leading-none">
          SYSTEM CORE ACTIVE
        </h1>
        <p className="font-sans-body text-xs md:text-sm text-muted leading-relaxed max-w-[500px]">
          Deploying isolated enclave computing. Standard pipelines boot, loading cryptographic keys and establishing secure vector archives.
        </p>
        {/* Subtle scroll cue */}
        <div className="pt-4 font-mono text-[8px] tracking-[0.2em] text-muted-soft uppercase animate-pulse">
          [SCROLL TO DECRYPT DATAPORT]
        </div>
      </div>

      {/* SCENE 2 OVERLAY: Act II - Ingestion / Parsing */}
      <div ref={scene2Ref} className="absolute inset-0 flex flex-col justify-center items-start px-6 md:px-24 z-20 select-none max-w-[800px] text-left space-y-6 opacity-0 pointer-events-none">
        <div className="flex items-center space-x-3 text-[9px] md:text-[10px] font-mono tracking-[0.3em] text-warning">
          <Cpu size={12} className="text-warning animate-pulse" />
          <span>02 / METADATA INGESTION</span>
        </div>
        <h2 className="font-display text-3xl md:text-6xl tracking-wide uppercase text-white leading-none">
          DECRYPTION & PARSING
        </h2>
        <p className="font-sans-body text-xs md:text-sm text-muted leading-relaxed max-w-[500px]">
          Ingesting siloed server logs, communication packets, and geographic coordinate matrices. Raw metadata points are resolved and chronological parameters normalized.
        </p>
      </div>

      {/* Telemetry scrolling streams for Act II */}
      <div 
        ref={telemetryFeedRef}
        className="absolute right-[5%] top-[25%] bottom-[25%] w-[260px] md:w-[320px] bg-black/60 border border-hairline/80 backdrop-blur-md p-4 z-20 font-mono text-[8px] md:text-[9px] text-muted text-left space-y-3 opacity-0 pointer-events-none overflow-hidden select-none"
      >
        <div className="flex justify-between items-center text-[7px] text-muted border-b border-hairline pb-2">
          <span>PARSING_TELEMETRY</span>
          <span className="text-success">[ACTIVE]</span>
        </div>
        <div className="space-y-2 h-[85%] overflow-y-auto leading-relaxed">
          <p>&gt; Ingesting LOG_A.sys... OK</p>
          <p>&gt; Resolving geographic subnet... [48.135, 11.582]</p>
          <p>&gt; Decrypting OMEGA communicant... PASS</p>
          <p>&gt; Normalizing chronometer timestamps...</p>
          <p className="text-warning">&gt; Alert: Transaction delay found on cluster 4</p>
        </div>
      </div>

      {/* SCENE 3 OVERLAY: Act III - Relational Reasoning */}
      <div ref={scene3Ref} className="absolute inset-0 flex flex-col justify-center items-start px-6 md:px-24 z-20 select-none max-w-[800px] text-left space-y-6 opacity-0 pointer-events-none">
        <div className="flex items-center space-x-3 text-[9px] md:text-[10px] font-mono tracking-[0.3em] text-success">
          <Activity size={12} className="text-success animate-pulse" />
          <span>03 / REASONING MATRIX</span>
        </div>
        <h2 className="font-display text-3xl md:text-6xl tracking-wide uppercase text-white leading-none">
          COGNITIVE RESOLUTION
        </h2>
        <p className="font-sans-body text-xs md:text-sm text-muted leading-relaxed max-w-[500px]">
          Normalized entities merge into a unified, high-dimensional reasoning graph. System algorithms sweep the path structures to detect hidden networks and flag logic discrepancies.
        </p>
      </div>

      {/* Act III Cognitive metrics details */}
      <div 
        ref={reasoningStatsRef}
        className="absolute right-[5%] bottom-[15%] w-[280px] bg-black/70 border border-hairline/80 backdrop-blur-md p-5 z-20 font-mono text-[9px] text-muted text-left space-y-4 opacity-0 pointer-events-none select-none"
      >
        <div className="flex justify-between items-center text-[8px] text-warning border-b border-hairline pb-2.5">
          <span className="flex items-center space-x-1"><AlertTriangle size={10} /> <span>ANOMALY_MONITOR</span></span>
          <span className="animate-pulse">[ALERT]</span>
        </div>
        <div className="space-y-1 bg-black p-3 border border-hairline-strong text-white text-[8px]">
          <p className="text-warning font-bold">WARNING: TIMESTAMP CLASH</p>
          <p>Transfer 0x82f occurred 14s prior to geoloc registration lock.</p>
        </div>
        <div className="grid grid-cols-2 gap-y-1.5 text-[8px] text-muted-soft uppercase tracking-wider">
          <span>GRAPH_NODES:</span> <span className="text-white">4,892</span>
          <span>ANOMALY_INDEX:</span> <span className="text-warning">HIGH</span>
          <span>CONFIDENCE:</span> <span className="text-success">98.7%</span>
        </div>
      </div>

      {/* SCENE 4 OVERLAY: Act IV - Global compiles / Closing */}
      <div ref={scene4Ref} className="absolute inset-0 flex flex-col justify-center items-center text-center px-6 z-20 select-none space-y-10 opacity-0 pointer-events-none bg-black/45">
        
        {/* Decorative corner lines for main reveal */}
        <div className="relative p-12 max-w-[800px] flex flex-col items-center justify-center border border-hairline bg-black/50 backdrop-blur-md">
          <div className="absolute top-2 left-2 text-[7px] font-mono text-muted-soft">CORE_COMPILER: TERMINATED</div>
          <div className="absolute bottom-2 right-2 text-[7px] font-mono text-muted-soft">ACCESS_GATE: OPEN</div>

          <div className="mb-6 flex items-center space-x-2 bg-hairline/50 px-3 py-1 border border-hairline-strong text-[9px] md:text-[10px] tracking-[0.25em] uppercase text-muted">
            <Lock size={10} className="text-success animate-pulse" />
            <span>INTELLIGENCE CONSOLE UNLOCKED</span>
          </div>

          <h2 className="font-display text-5xl md:text-8xl tracking-widest text-white uppercase leading-none mb-4">
            BLACKBOX
          </h2>

          <div className="mb-8 font-mono text-[10px] md:text-[12px] tracking-[0.3em] text-muted-soft uppercase max-w-[600px] leading-relaxed">
            <DecryptText text="INTELLIGENCE OPERATING SYSTEM" delay={300} duration={1000} />
          </div>

          <p className="font-sans-body text-xs md:text-sm text-muted max-w-[520px] leading-relaxed mb-10">
            Synthesize disconnected evidence paths into an evolving knowledge network. Initialize your authorization key to proceed.
          </p>

          <div className="relative group cursor-pointer" onClick={handleAccess}>
            <button className="bg-white hover:bg-transparent text-black hover:text-white border border-white font-mono text-[10px] md:text-[11px] tracking-[0.25em] font-semibold py-4 px-10 transition-all duration-300 rounded-none uppercase flex items-center space-x-3">
              <span>
                {accessTriggered ? (
                  <DecryptText text="DECRYPTING ACCESS PORT..." duration={800} />
                ) : (
                  "ESTABLISH CONNECTION"
                )}
              </span>
              <ArrowRight size={12} className="group-hover:translate-x-1.5 transition-transform duration-300" />
            </button>
            <div className="absolute -top-1.5 -left-1.5 w-2 h-2 border-t border-l border-white/50" />
            <div className="absolute -top-1.5 -right-1.5 w-2 h-2 border-t border-r border-white/50" />
            <div className="absolute -bottom-1.5 -left-1.5 w-2 h-2 border-b border-l border-white/50" />
            <div className="absolute -bottom-1.5 -right-1.5 w-2 h-2 border-b border-r border-white/50" />
          </div>
        </div>
      </div>

      {/* Shared HUD Footer */}
      <footer className="absolute bottom-0 left-0 right-0 max-w-[1440px] mx-auto px-6 md:px-12 py-5 flex flex-col sm:flex-row justify-between items-center z-50 font-mono text-[8px] md:text-[9px] tracking-[0.2em] text-muted border-t border-hairline/60 gap-4 sm:gap-0">
        <div className="flex items-center space-x-6">
          <span>SYS_REVISION: V0.82-BETA</span>
          <span>|</span>
          <span className="flex items-center space-x-1.5"><Shield size={10} className="text-success" /> <span>SECURE ACCESS ONLY</span></span>
        </div>
        <span>BLACKBOX INC. // GOVERNMENT GRADE SECURITY CORE</span>
      </footer>
    </div>
  );
};
