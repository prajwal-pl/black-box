"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Hero } from "./hero";
import { DecryptText } from "./decrypt-text";
import { IntelPipeline } from "./intel-pipeline";
import { WorkspacePreview } from "./workspace-preview";
import { Capabilities } from "./capabilities";
import { ShieldAlert, Terminal, Eye, Binary } from "lucide-react";
import { ClosingCta } from "./closing-cta";

// Register ScrollTrigger plugin
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export const ScrollStory: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const heroWrapperRef = useRef<HTMLDivElement | null>(null);
  const transitionRef = useRef<HTMLDivElement | null>(null);
  const pipelineRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const capabilitiesRef = useRef<HTMLDivElement | null>(null);
  const closingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // --- GSAP TIMELINE 1: Hero to Transition Section ---
    const ctx = gsap.context(() => {
      // Scale and fade hero out on scroll
      gsap.to(heroWrapperRef.current, {
        scrollTrigger: {
          trigger: heroWrapperRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
        opacity: 0.1,
        y: -100,
        scale: 0.95,
        ease: "power2.inOut",
      });

      // Pinned transition panel reveal
      gsap.fromTo(
        transitionRef.current,
        { opacity: 0, scale: 1.1 },
        {
          scrollTrigger: {
            trigger: transitionRef.current,
            start: "top bottom",
            end: "center center",
            scrub: true,
          },
          opacity: 1,
          scale: 1,
          ease: "power2.out",
        }
      );

      // --- GSAP TIMELINE 2: Pipeline Section Pin & Enter ---
      // We will pin this section in Phase 3 for horizontal or morphing slide-show effects
      gsap.fromTo(
        pipelineRef.current,
        { opacity: 0 },
        {
          scrollTrigger: {
            trigger: pipelineRef.current,
            start: "top 80%",
            end: "top 30%",
            scrub: true,
          },
          opacity: 1,
          ease: "power1.inOut",
        }
      );

      // --- GSAP TIMELINE 3: Workspace parallax reveal ---
      gsap.fromTo(
        workspaceRef.current,
        { y: 150, opacity: 0 },
        {
          scrollTrigger: {
            trigger: workspaceRef.current,
            start: "top 90%",
            end: "top 40%",
            scrub: true,
          },
          y: 0,
          opacity: 1,
          ease: "power3.out",
        }
      );

      // --- GSAP TIMELINE 4: Capabilities perspective shift ---
      gsap.fromTo(
        capabilitiesRef.current,
        { rotationX: 10, opacity: 0, transformPerspective: 1000 },
        {
          scrollTrigger: {
            trigger: capabilitiesRef.current,
            start: "top 90%",
            end: "top 50%",
            scrub: true,
          },
          rotationX: 0,
          opacity: 1,
          ease: "power2.out",
        }
      );

      // --- GSAP TIMELINE 5: Closing fading into absolute black ---
      gsap.fromTo(
        closingRef.current,
        { opacity: 0, scale: 0.98 },
        {
          scrollTrigger: {
            trigger: closingRef.current,
            start: "top 90%",
            end: "top 60%",
            scrub: true,
          },
          opacity: 1,
          scale: 1,
          ease: "power2.inOut",
        }
      );
    }, container);

    return () => {
      ctx.revert();
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full bg-black text-white relative">
      {/* 1. HERO SECTION */}
      <div ref={heroWrapperRef} className="w-full relative min-h-screen">
        <Hero />
      </div>

      {/* 2. SECURITY CHECK / DECRYPTION LAYER (TRANSITIONAL MORPH SECTION) */}
      <div 
        ref={transitionRef}
        className="w-full min-h-screen flex flex-col justify-center items-center px-6 relative bg-black border-t border-hairline z-30"
      >
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        <div className="w-full max-w-[800px] text-center space-y-8 select-none">
          <div className="flex justify-center mb-4">
            <div className="p-4 border border-warning/20 bg-warning/5 rounded-none text-warning animate-pulse">
              <ShieldAlert size={28} />
            </div>
          </div>

          <h2 className="font-display text-2xl md:text-3xl tracking-[0.2em] uppercase text-white">
            <DecryptText text="ESTABLISHING CORE SYSTEM LINK" duration={1000} />
          </h2>

          <div className="h-[1px] w-32 bg-hairline mx-auto" />

          <p className="font-mono-precision text-[10px] md:text-[11px] tracking-[0.25em] text-muted max-w-[600px] mx-auto leading-relaxed uppercase">
            PARSING THOUSANDS OF EVIDENCE POINTS. CONNECTING GEO-COORDINATES, METADATA LOGS, AND FINANCIAL HASHES IN REAL-TIME.
          </p>

          {/* Scrolling brutalist code streams */}
          <div className="border border-hairline bg-surface-soft p-6 font-mono text-[9px] md:text-[10px] text-left text-muted-soft overflow-hidden h-[120px] max-w-[500px] mx-auto relative select-none">
            <div className="absolute top-0 right-4 text-[8px] text-success tracking-widest animate-pulse">[DECRYPT_OK]</div>
            <div className="space-y-1.5 animate-pulse">
              <p>&gt; CONNECTING TO NSA_DATAFEED_EAST... SUCCESS</p>
              <p>&gt; PARSING METADATA_LOG_109282... INGESTED (24.1 KB)</p>
              <p>&gt; DETECTING NODE CORRELATIONS... 82 FOUND</p>
              <p>&gt; GRAPH MATRIX INSTANTIATION IN PROGRESS...</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. INTELLIGENCE PIPELINE (PHASE 3) */}
      <div ref={pipelineRef} className="w-full relative z-30">
        <IntelPipeline />
      </div>

      {/* 4. INVESTIGATION WORKSPACE (PHASE 4) */}
      <div ref={workspaceRef} className="w-full relative z-30">
        <WorkspacePreview />
      </div>

      {/* 5. CAPABILITIES (PHASE 4) */}
      <div ref={capabilitiesRef} className="w-full relative z-30">
        <Capabilities />
      </div>

      {/* 6. CLOSING (PHASE 5) */}
      <div ref={closingRef} className="w-full relative z-30">
        <ClosingCta />
      </div>
    </div>
  );
};
