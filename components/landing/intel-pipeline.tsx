"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FileText, Cpu, Key, GitFork, Compass, ArrowRight } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export const IntelPipeline: React.FC = () => {
  const pinSectionRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Refs for texts
  const text1Ref = useRef<HTMLDivElement | null>(null);
  const text2Ref = useRef<HTMLDivElement | null>(null);
  const text3Ref = useRef<HTMLDivElement | null>(null);
  const text4Ref = useRef<HTMLDivElement | null>(null);
  const text5Ref = useRef<HTMLDivElement | null>(null);

  // Refs for visuals
  const visual1Ref = useRef<HTMLDivElement | null>(null);
  const visual2Ref = useRef<HTMLDivElement | null>(null);
  const visual3Ref = useRef<HTMLDivElement | null>(null);
  const visual4Ref = useRef<HTMLDivElement | null>(null);
  const visual5Ref = useRef<HTMLDivElement | null>(null);

  // Laser line for Processing phase
  const laserRef = useRef<HTMLDivElement | null>(null);
  // SVG paths for Graph phase
  const path1Ref = useRef<SVGPathElement | null>(null);
  const path2Ref = useRef<SVGPathElement | null>(null);
  const path3Ref = useRef<SVGPathElement | null>(null);
  // SVG pulse animation handled via CSS className

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const pinSection = pinSectionRef.current;
    if (!pinSection) return;

    // Core GSAP Timeline for the scroll-pinned sequence
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: pinSection,
        start: "top top",
        end: "+=400%", // 4 screens worth of scroll distance
        pin: true,
        scrub: 1, // smooth inertia transition
        invalidateOnRefresh: true,
      },
    });

    // Helper: Fade/Slide animation defaults
    const transitionDuration = 1;

    // --- PHASE 1 -> PHASE 2 ---
    tl.to(text1Ref.current, { opacity: 0, y: -40, duration: transitionDuration }, "phase1-out")
      .to(visual1Ref.current, { opacity: 0, scale: 0.9, duration: transitionDuration }, "phase1-out")
      .fromTo(
        text2Ref.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: transitionDuration },
        "phase2-in"
      )
      .fromTo(
        visual2Ref.current,
        { opacity: 0, scale: 1.1 },
        { opacity: 1, scale: 1, duration: transitionDuration },
        "phase2-in"
      );

    // Add laser animation sweep in Phase 2
    tl.fromTo(
      laserRef.current,
      { y: "-10%" },
      { y: "110%", duration: transitionDuration * 1.5, repeat: 1, yoyo: true, ease: "power1.inOut" },
      "phase2-in"
    );

    // --- PHASE 2 -> PHASE 3 ---
    tl.to(text2Ref.current, { opacity: 0, y: -40, duration: transitionDuration }, "phase2-out")
      .to(visual2Ref.current, { opacity: 0, y: -40, duration: transitionDuration }, "phase2-out")
      .fromTo(
        text3Ref.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: transitionDuration },
        "phase3-in"
      )
      .fromTo(
        visual3Ref.current,
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: transitionDuration },
        "phase3-in"
      );

    // --- PHASE 3 -> PHASE 4 ---
    tl.to(text3Ref.current, { opacity: 0, y: -40, duration: transitionDuration }, "phase3-out")
      .to(visual3Ref.current, { opacity: 0, scale: 0.9, duration: transitionDuration }, "phase3-out")
      .fromTo(
        text4Ref.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: transitionDuration },
        "phase4-in"
      )
      .fromTo(
        visual4Ref.current,
        { opacity: 0, scale: 1.05 },
        { opacity: 1, scale: 1, duration: transitionDuration },
        "phase4-in"
      );

    // Animate SVG path drawing in Phase 4
    if (path1Ref.current && path2Ref.current && path3Ref.current) {
      tl.fromTo(
        [path1Ref.current, path2Ref.current, path3Ref.current],
        { strokeDashoffset: 300 },
        { strokeDashoffset: 0, duration: transitionDuration * 1.2, ease: "power1.inOut" },
        "phase4-in"
      );
    }

    // --- PHASE 4 -> PHASE 5 ---
    tl.to(text4Ref.current, { opacity: 0, y: -40, duration: transitionDuration }, "phase4-out")
      .to(visual4Ref.current, { opacity: 0, scale: 0.95, duration: transitionDuration }, "phase4-out")
      .fromTo(
        text5Ref.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: transitionDuration },
        "phase5-in"
      )
      .fromTo(
        visual5Ref.current,
        { opacity: 0, scale: 1.05 },
        { opacity: 1, scale: 1, duration: transitionDuration },
        "phase5-in"
      );

    // Animate the reasoning pulses traversing along the paths in Phase 5 via CSS .animate-dash-flow

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => {
        if (trigger.trigger === pinSection) {
          trigger.kill();
        }
      });
    };
  }, []);

  return (
    <div ref={pinSectionRef} className="w-full h-screen bg-black overflow-hidden relative border-t border-hairline z-30">
      {/* Absolute grid background */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Pinned main wrapper layout */}
      <div ref={containerRef} className="w-full h-full flex flex-col lg:flex-row max-w-[1440px] mx-auto px-6 md:px-12 items-center justify-between gap-12 py-16 relative">
        
        {/* Left Column: Narrative texts (Stacked absolutely) */}
        <div className="w-full lg:w-[45%] h-[350px] relative flex flex-col justify-center select-none order-2 lg:order-1">
          
          {/* Phase 1 Text */}
          <div ref={text1Ref} className="absolute inset-0 flex flex-col justify-center space-y-6">
            <div className="flex items-center space-x-3 text-[9px] md:text-[10px] font-mono-precision tracking-[0.25em] text-muted">
              <FileText size={12} className="text-muted" />
              <span>01 / DISCONNECTED EVIDENCE</span>
            </div>
            <h2 className="font-display text-2xl md:text-4xl lg:text-5xl tracking-wide uppercase text-white leading-tight">
              RAW INVESTIGATION INGESTION
            </h2>
            <p className="font-sans-body text-xs md:text-sm text-muted leading-relaxed max-w-[480px]">
              Evidence exists as isolated points. Telemetry databases, financial records, communication logs, and physical transcripts lie scattered in siloed compartments.
            </p>
          </div>

          {/* Phase 2 Text */}
          <div ref={text2Ref} className="absolute inset-0 flex flex-col justify-center space-y-6 opacity-0">
            <div className="flex items-center space-x-3 text-[9px] md:text-[10px] font-mono-precision tracking-[0.25em] text-muted">
              <Cpu size={12} className="text-warning" />
              <span>02 / SECURE PARSING</span>
            </div>
            <h2 className="font-display text-2xl md:text-4xl lg:text-5xl tracking-wide uppercase text-white leading-tight">
              DECRYPTION & EXTRACTION
            </h2>
            <p className="font-sans-body text-xs md:text-sm text-muted leading-relaxed max-w-[480px]">
              The system securely parses raw inputs. NLP models identify key actors, WebGL decodes encrypted signals, and metadata timestamps are aligned to a unified chronological axis.
            </p>
          </div>

          {/* Phase 3 Text */}
          <div ref={text3Ref} className="absolute inset-0 flex flex-col justify-center space-y-6 opacity-0">
            <div className="flex items-center space-x-3 text-[9px] md:text-[10px] font-mono-precision tracking-[0.25em] text-muted">
              <Key size={12} className="text-muted" />
              <span>03 / CONTEXTUAL KNOWLEDGE</span>
            </div>
            <h2 className="font-display text-2xl md:text-4xl lg:text-5xl tracking-wide uppercase text-white leading-tight">
              ENTITY RESOLUTION
            </h2>
            <p className="font-sans-body text-xs md:text-sm text-muted leading-relaxed max-w-[480px]">
              Extracted attributes are normalized. Financial wallet addresses, geographical subnets, and aliases are cross-linked, resolving diverse data vectors into established profiles.
            </p>
          </div>

          {/* Phase 4 Text */}
          <div ref={text4Ref} className="absolute inset-0 flex flex-col justify-center space-y-6 opacity-0">
            <div className="flex items-center space-x-3 text-[9px] md:text-[10px] font-mono-precision tracking-[0.25em] text-muted">
              <GitFork size={12} className="text-white" />
              <span>04 / UNIFIED GRAPH</span>
            </div>
            <h2 className="font-display text-2xl md:text-4xl lg:text-5xl tracking-wide uppercase text-white leading-tight">
              INTELLIGENCE MATRIX FORMING
            </h2>
            <p className="font-sans-body text-xs md:text-sm text-muted leading-relaxed max-w-[480px]">
              Disparate nodes are synthesized into a high-dimensional relational graph. System logic maps spatial connections, identifying hidden structures and key network paths.
            </p>
          </div>

          {/* Phase 5 Text */}
          <div ref={text5Ref} className="absolute inset-0 flex flex-col justify-center space-y-6 opacity-0">
            <div className="flex items-center space-x-3 text-[9px] md:text-[10px] font-mono-precision tracking-[0.25em] text-muted">
              <Compass size={12} className="text-success" />
              <span>05 / COGNITIVE LAYER</span>
            </div>
            <h2 className="font-display text-2xl md:text-4xl lg:text-5xl tracking-wide uppercase text-white leading-tight">
              REASONING & HYPOTHESIS
            </h2>
            <p className="font-sans-body text-xs md:text-sm text-muted leading-relaxed max-w-[480px]">
              The core query engine operates. Logic paths trace associations, flag logical contradictions across timestamps, and generate active investigative hypotheses automatically.
            </p>
          </div>
        </div>

        {/* Right Column: Interactive visuals (Stacked absolutely) */}
        <div className="w-full lg:w-[50%] h-[350px] md:h-[450px] relative flex justify-center items-center order-1 lg:order-2 border border-hairline bg-surface-soft/40 backdrop-blur-sm overflow-hidden select-none">
          
          {/* Decorative Corner Grid lines inside visual container */}
          <div className="absolute top-2 left-2 text-[8px] font-mono text-muted-soft">SYS_VIZ_CORE</div>
          <div className="absolute bottom-2 right-2 text-[8px] font-mono text-muted-soft">GRID_MODE: 3D_PROJ</div>

          {/* --- VISUAL 1: Raw evidence cards --- */}
          <div ref={visual1Ref} className="absolute inset-0 flex items-center justify-center p-6 gap-4">
            <div className="grid grid-cols-2 gap-4 w-full max-w-[380px]">
              {[
                { name: "LOG_TRAFFIC.CSV", meta: "342 KB / DATA", type: "DB" },
                { name: "COMM_ALPHA.EML", meta: "12 KB / SECURE", type: "MAIL" },
                { name: "GEO_ROUTE_4.TXT", meta: "1.2 MB / GPS", type: "LOC" },
                { name: "IMG_SEC_098.JPG", meta: "4.8 MB / CAPTURE", type: "IMG" }
              ].map((doc, idx) => (
                <div key={idx} className="border border-hairline bg-black p-4 space-y-3 relative rounded-none hover:border-white/20 transition-colors">
                  <div className="flex justify-between items-center text-[8px] font-mono text-muted-soft">
                    <span>{doc.type}</span>
                    <span>[RAW]</span>
                  </div>
                  <div className="font-mono text-[9px] text-white font-bold truncate tracking-wide">{doc.name}</div>
                  <div className="h-[1px] bg-hairline w-full" />
                  <div className="font-mono text-[8px] text-muted truncate">{doc.meta}</div>
                </div>
              ))}
            </div>
          </div>

          {/* --- VISUAL 2: Scanning process cards --- */}
          <div ref={visual2Ref} className="absolute inset-0 flex items-center justify-center p-6 opacity-0">
            {/* Holographic Laser Sweeper */}
            <div ref={laserRef} className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-warning/80 to-transparent z-10 pointer-events-none" />
            
            <div className="w-full max-w-[360px] bg-black border border-hairline p-6 space-y-4 relative">
              <div className="flex justify-between items-center text-[8px] font-mono text-warning">
                <span className="flex items-center space-x-1"><Cpu size={8} /> <span>CORE_PROCESSOR_ST-9</span></span>
                <span className="animate-pulse">DECRYPTING... 78%</span>
              </div>
              <div className="font-mono text-[10px] text-white tracking-widest break-all h-24 overflow-hidden leading-relaxed opacity-60">
                01001001 01001110 01010100 01000101 01001100 01001100 01001001 01000111 01000101 01001110 01000011 01000101 00100000 01001111 01010000 01000101 01010010 01000001 01010100 01001001 01001110 01000111 00100000 01010011 01011001 01010011 01010100 01000101 01001101
              </div>
              <div className="h-1 bg-hairline w-full overflow-hidden">
                <div className="h-full bg-warning w-[78%] animate-pulse" />
              </div>
            </div>
          </div>

          {/* --- VISUAL 3: Normalized entity profile --- */}
          <div ref={visual3Ref} className="absolute inset-0 flex items-center justify-center p-6 opacity-0">
            <div className="w-full max-w-[360px] bg-black border border-hairline p-5 space-y-4">
              <div className="flex justify-between items-center text-[8px] font-mono text-muted">
                <span>ENTITY_ID: #RESOLVED_091</span>
                <span className="text-white bg-hairline px-1.5 py-0.5 font-bold">[PROFILE]</span>
              </div>
              
              <div className="flex items-center space-x-4 border-b border-hairline pb-4">
                <div className="w-10 h-10 border border-hairline flex items-center justify-center font-mono text-[10px] text-white">
                  [Ω]
                </div>
                <div>
                  <div className="font-mono text-xs text-white font-bold tracking-wider">ALIAS: OMEGA_SECTOR</div>
                  <div className="font-mono text-[8px] text-muted-soft">RESOLVED FROM 4 DATA SOURCES</div>
                </div>
              </div>

              <div className="space-y-2 font-mono text-[9px]">
                <div className="flex justify-between py-1 border-b border-hairline-strong">
                  <span className="text-muted-soft">COMM_KEYS:</span>
                  <span className="text-white">ECC_DH_256 (3 USED)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-hairline-strong">
                  <span className="text-muted-soft">IP_SUBNETS:</span>
                  <span className="text-white">194.81.2.0 / 24</span>
                </div>
                <div className="flex justify-between py-1 border-b border-hairline-strong">
                  <span className="text-muted-soft">ACTIVE_TRANS:</span>
                  <span className="text-white">0.021 BTC (LEDGER_OUT)</span>
                </div>
              </div>
            </div>
          </div>

          {/* --- VISUAL 4: SVG Node Network forming --- */}
          <div ref={visual4Ref} className="absolute inset-0 flex items-center justify-center p-6 opacity-0">
            <div className="w-full h-full max-w-[360px] max-h-[300px] relative">
              <svg className="w-full h-full" viewBox="0 0 360 300">
                {/* Connection lines */}
                <path
                  ref={path1Ref}
                  d="M 60,150 L 180,90 L 300,150"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.4)"
                  strokeWidth="1"
                  strokeDasharray="300"
                  strokeDashoffset="300"
                />
                <path
                  ref={path2Ref}
                  d="M 120,220 L 180,90"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.4)"
                  strokeWidth="1"
                  strokeDasharray="300"
                  strokeDashoffset="300"
                />
                <path
                  ref={path3Ref}
                  d="M 120,220 L 240,220 L 300,150"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.4)"
                  strokeWidth="1"
                  strokeDasharray="300"
                  strokeDashoffset="300"
                />

                {/* Nodes */}
                {[
                  { cx: 60, cy: 150, r: 8, label: "DOC" },
                  { cx: 180, cy: 90, r: 12, label: "ALIAS" },
                  { cx: 300, cy: 150, r: 8, label: "IP" },
                  { cx: 120, cy: 220, r: 6, label: "LOG" },
                  { cx: 240, cy: 220, r: 10, label: "HASH" }
                ].map((node, idx) => (
                  <g key={idx}>
                    <circle
                      cx={node.cx}
                      cy={node.cy}
                      r={node.r}
                      fill="black"
                      stroke="white"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx={node.cx}
                      cy={node.cy}
                      r={node.r + 4}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.2)"
                      strokeWidth="0.5"
                    />
                    <text
                      x={node.cx}
                      y={node.cy + node.r + 14}
                      fill="rgba(255,255,255,0.5)"
                      fontSize="7"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {node.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* --- VISUAL 5: SVG reasoning pathway trace --- */}
          <div ref={visual5Ref} className="absolute inset-0 flex items-center justify-center p-6 opacity-0">
            <div className="w-full h-full max-w-[360px] max-h-[300px] relative">
              <svg className="w-full h-full" viewBox="0 0 360 300">
                {/* Active pathways (glowing green/white) */}
                <path
                  d="M 60,150 L 180,90 L 300,150"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.15)"
                  strokeWidth="1"
                />
                <path
                  d="M 120,220 L 180,90"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.15)"
                  strokeWidth="1"
                />
                <path
                  d="M 120,220 L 240,220 L 300,150"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.15)"
                  strokeWidth="1"
                />

                {/* Animated traveling pulses using SVG dash flow */}
                <path
                  d="M 120,220 L 180,90 L 300,150"
                  fill="none"
                  stroke="#5fa657"
                  strokeWidth="2"
                  className="animate-dash-flow"
                />

                {/* Nodes with active glowing status */}
                {[
                  { cx: 60, cy: 150, r: 8, glow: false },
                  { cx: 180, cy: 90, r: 12, glow: true, name: "CORRELATION_DETECTED" },
                  { cx: 300, cy: 150, r: 8, glow: true },
                  { cx: 120, cy: 220, r: 6, glow: true },
                  { cx: 240, cy: 220, r: 10, glow: false }
                ].map((node, idx) => (
                  <g key={idx}>
                    <circle
                      cx={node.cx}
                      cy={node.cy}
                      r={node.r}
                      fill="black"
                      stroke={node.glow ? "#5fa657" : "white"}
                      strokeWidth="1.5"
                    />
                    <circle
                      cx={node.cx}
                      cy={node.cy}
                      r={node.r + (node.glow ? 6 : 4)}
                      fill="none"
                      stroke={node.glow ? "rgba(95, 166, 87, 0.25)" : "rgba(255, 255, 255, 0.15)"}
                      strokeWidth="0.5"
                      className={node.glow ? "animate-pulse" : ""}
                    />
                    {node.name && (
                      <text
                        x={node.cx}
                        y={node.cy - 20}
                        fill="#5fa657"
                        fontSize="8"
                        fontWeight="bold"
                        fontFamily="monospace"
                        textAnchor="middle"
                        className="animate-pulse"
                      >
                        {node.name}
                      </text>
                    )}
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
