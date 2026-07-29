"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FileText, Map, Terminal, Cpu, Database, Eye } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export const WorkspacePreview: React.FC = () => {
  const deskRef = useRef<HTMLDivElement | null>(null);
  const doc1Ref = useRef<HTMLDivElement | null>(null);
  const doc2Ref = useRef<HTMLDivElement | null>(null);
  const doc3Ref = useRef<HTMLDivElement | null>(null);
  const doc4Ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const desk = deskRef.current;
    if (!desk) return;

    // Drop-onto-desk physics animation scrubbed via scroll
    gsap.fromTo(
      [doc1Ref.current, doc2Ref.current, doc3Ref.current, doc4Ref.current],
      { 
        y: -180, 
        rotation: () => (Math.random() - 0.5) * 35, 
        opacity: 0, 
        scale: 1.1,
        boxShadow: "0 0px 0px rgba(0,0,0,0)"
      },
      {
        y: 0,
        rotation: (i) => [-4, 3, -1.5, 2][i],
        opacity: 1,
        scale: 1,
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.8)",
        stagger: 0.1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: desk,
          start: "top 75%",
          end: "bottom 90%",
          scrub: 1.2,
        }
      }
    );
  }, []);

  return (
    <div ref={deskRef} className="w-full min-h-screen bg-black border-t border-hairline py-20 px-6 relative z-30 flex flex-col justify-center items-center overflow-hidden">
      
      {/* Table grid pattern background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#000000_90%)] pointer-events-none" />

      <div className="w-full max-w-[1280px] z-10 space-y-16">
        {/* Section Header */}
        <div className="flex flex-col border-b border-hairline pb-8 select-none">
          <span className="font-mono-precision text-[10px] tracking-[0.25em] text-muted mb-2">SECTION 03 // INTELLIGENCE CONSOLE</span>
          <h2 className="font-display text-3xl md:text-5xl tracking-[0.05em] uppercase text-white">THE INVESTIGATION WORKSPACE</h2>
        </div>

        {/* Desk Container Area */}
        <div className="relative w-full h-[550px] md:h-[650px] border border-hairline bg-surface-soft/20 backdrop-blur-sm flex items-center justify-center overflow-hidden">
          
          {/* Telemetry markings on desk */}
          <div className="absolute top-4 left-4 font-mono text-[8px] text-muted-soft tracking-wider">CONSOLE_SESSION_ACTIVE // WORKSPACE_PREVIEW</div>
          <div className="absolute bottom-4 right-4 font-mono text-[8px] text-muted-soft tracking-wider">WORKSPACE_DECK_SYS // ROT: AUTO_LOCK</div>

          {/* DOCUMENT 1: Interrogation Transcript */}
          <div 
            ref={doc1Ref}
            className="absolute w-[260px] md:w-[320px] bg-[#0c0c0c] border border-hairline p-5 space-y-4 text-left select-none left-[5%] top-[10%] hover:z-50 hover:border-white/35 transition-all duration-300 group cursor-grab active:cursor-grabbing"
          >
            <div className="flex justify-between items-center border-b border-hairline pb-3">
              <span className="font-mono text-[8px] text-warning flex items-center space-x-1">
                <FileText size={10} /> <span>COMM_LOG #A-89</span>
              </span>
              <span className="font-mono text-[8px] text-muted-soft">CONFIDENTIAL</span>
            </div>
            <div className="space-y-2">
              <p className="font-mono text-[9px] text-muted-soft leading-relaxed">
                <span className="text-white font-bold">[INTERCEPTED_AUDIO_TRANSCRIPT]</span><br />
                SPEAKER_A: "Coordinates established. Deploy data package to the Munich subnet."<br />
                SPEAKER_B: "Decryption key sent via secondary ledger tunnel."
              </p>
            </div>
            <div className="h-[1px] bg-hairline-strong w-full" />
            <div className="flex justify-between items-center text-[7px] font-mono text-muted-soft">
              <span>EST: 2026-07-28 14:02:11</span>
              <span className="text-success">[PARSED]</span>
            </div>
          </div>

          {/* DOCUMENT 2: Geographical Subnet Map */}
          <div 
            ref={doc2Ref}
            className="absolute w-[240px] md:w-[300px] bg-[#080808] border border-hairline p-5 space-y-4 text-left select-none right-[8%] top-[8%] hover:z-50 hover:border-white/35 transition-all duration-300 cursor-grab active:cursor-grabbing"
          >
            <div className="flex justify-between items-center border-b border-hairline pb-3">
              <span className="font-mono text-[8px] text-white flex items-center space-x-1">
                <Map size={10} /> <span>SUBNET_NODE_VECTOR</span>
              </span>
              <span className="font-mono text-[8px] text-muted-soft">GRID_LOCK</span>
            </div>
            {/* Visual graph snippet representing a subnet map */}
            <div className="h-28 border border-hairline-strong relative overflow-hidden bg-black flex items-center justify-center">
              <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:10px_10px]" />
              <div className="absolute w-3 h-3 rounded-full border border-warning/50 left-[20%] top-[40%] animate-ping" />
              <div className="absolute w-2 h-2 rounded-full bg-warning left-[20%] top-[40%]" />
              <div className="absolute w-2 h-2 rounded-full bg-white right-[30%] bottom-[25%]" />
              <svg className="absolute inset-0 w-full h-full">
                <line x1="20%" y1="40%" x2="70%" y2="75%" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" strokeDasharray="3 3" />
              </svg>
            </div>
            <div className="font-mono text-[8px] text-muted-soft leading-tight">
              TARGET_IP: 198.51.100.82 // GEO: [48.1351, 11.5820]
            </div>
          </div>

          {/* DOCUMENT 3: Active AI Insight / Reasoning card */}
          <div 
            ref={doc3Ref}
            className="absolute w-[250px] md:w-[290px] bg-[#0a0a0a] border border-hairline p-5 space-y-4 text-left select-none left-[8%] bottom-[12%] hover:z-50 hover:border-white/35 transition-all duration-300 cursor-grab active:cursor-grabbing"
          >
            <div className="flex justify-between items-center border-b border-hairline pb-3">
              <span className="font-mono text-[8px] text-white flex items-center space-x-1">
                <Cpu size={10} /> <span>COGNITIVE_INSIGHT</span>
              </span>
              <span className="font-mono text-[8px] text-success animate-pulse">[RESOLVED]</span>
            </div>
            <div className="space-y-3">
              <div className="bg-hairline/40 p-2.5 border border-hairline-strong font-mono text-[9px] text-white">
                <span className="text-warning">CRITICAL DISCREPANCY:</span><br />
                Actor wallet initiated transfer 14 seconds prior to geolocation lock timestamp. Indicates automated transaction trigger.
              </div>
            </div>
            <div className="font-mono text-[8px] text-muted-soft">
              CONFIDENCE_LEVEL: 98.7% // ANOMALY_INDEX: HIGH
            </div>
          </div>

          {/* DOCUMENT 4: Command Telemetry Feed */}
          <div 
            ref={doc4Ref}
            className="absolute w-[270px] md:w-[310px] bg-[#0c0c0c] border border-hairline p-5 space-y-4 text-left select-none right-[5%] bottom-[10%] hover:z-50 hover:border-white/35 transition-all duration-300 cursor-grab active:cursor-grabbing"
          >
            <div className="flex justify-between items-center border-b border-hairline pb-3">
              <span className="font-mono text-[8px] text-muted flex items-center space-x-1">
                <Terminal size={10} /> <span>SYSTEM_SHELL</span>
              </span>
              <span className="font-mono text-[8px] text-muted-soft">V_0.8</span>
            </div>
            <div className="font-mono text-[8px] text-muted-soft space-y-1 bg-black p-3 border border-hairline-strong h-20 overflow-hidden leading-relaxed">
              <p>&gt; run anomaly_scan --target=OMEGA</p>
              <p className="text-warning">&gt;&gt; WARNING: 2 CONTRADICTORY STAMPS FOUND</p>
              <p className="text-success">&gt;&gt; RELINKING SUB-GRAPH PATHS... DONE</p>
            </div>
            <div className="flex justify-between items-center text-[7px] font-mono text-muted-soft">
              <span>SYS_ENCLAVE: ONLINE</span>
              <span className="flex items-center space-x-1 text-white">
                <Database size={8} /> <span>DB_SYNC: OK</span>
              </span>
            </div>
          </div>

          {/* Visual desk center overlay warning */}
          <div className="absolute text-center space-y-2 pointer-events-none select-none px-6 max-w-[320px]">
            <div className="font-display text-[11px] tracking-[0.2em] text-muted-soft uppercase">INTERACTIVE ENVIRONMENT</div>
            <p className="font-mono text-[8px] text-muted-soft leading-normal">
              HOVER OVER EVIDENCE BLOCKS TO AUDIT RESOLVED METADATA FILES.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
