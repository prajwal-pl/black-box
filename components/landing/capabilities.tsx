"use client";

import React, { useRef, useState } from "react";
import { Cpu, ShieldCheck, Binary, ChevronRight } from "lucide-react";
import { DecryptText } from "./decrypt-text";

// 3D Perspective Tilt Card Wrapper
interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
}

const TiltCard: React.FC<TiltCardProps> = ({ children, className = "" }) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    const mouseX = e.clientX - rect.left - width / 2;
    const mouseY = e.clientY - rect.top - height / 2;

    // Limit tilt rotation to max 8 degrees for clean, premium feel
    const rotX = -(mouseY / (height / 2)) * 8;
    const rotY = (mouseX / (width / 2)) * 8;

    setRotate({ x: rotX, y: rotY });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
        transition: "transform 0.15s cubic-bezier(0.25, 1, 0.5, 1), border-color 0.4s ease, background-color 0.4s ease",
      }}
      className={className}
    >
      {children}
    </div>
  );
};

export const Capabilities: React.FC = () => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const capabilitiesList = [
    {
      code: "PROTOCOL_01 // SECURE_AUDIT",
      title: "TEMPORAL REASONING",
      desc: "Autonomously trace event relationships over chronological horizons. Identify anomalies where actor transactions mismatch localized subnet timestamps.",
      icon: Cpu,
      telemetry: "RESOLVER: CHRONO_AUDIT_ST-8\nLATENCY: 0.12ms\nCOMPILER: INLINE_LLVM_WASM",
      visual: (
        <div className="h-32 border border-hairline-strong bg-black relative overflow-hidden flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:100%_12px]" />
          {/* Animated line sweeps */}
          <div className="w-full space-y-3 font-mono text-[7px] text-muted-soft select-none z-10">
            <div className="flex justify-between border-b border-hairline-strong pb-1">
              <span>CASE_LINK_A [0x82a]</span>
              <span className="text-success font-bold">MATCH</span>
            </div>
            <div className="flex justify-between border-b border-hairline-strong pb-1">
              <span>CASE_LINK_B [0x19f]</span>
              <span className="text-warning font-bold">DELAY_TICK_14S</span>
            </div>
            <div className="flex justify-between pb-1">
              <span>CASE_LINK_C [0xf91]</span>
              <span className="text-muted-soft font-bold">RESOLVING...</span>
            </div>
          </div>
        </div>
      )
    },
    {
      code: "PROTOCOL_02 // SYSTEM_SHELL",
      title: "DECENTRALIZED INGESTION",
      desc: "Ingest and structure heterogeneous data formats. The secure pipelines parse text transcripts, PDF briefs, ledger blocks, and database dumps into unified nodes.",
      icon: ShieldCheck,
      telemetry: "DECRYPT: CORE_ECC_AES_256\nSTATUS: ENCLAVE_SECURE\nAUDIT: COMPLETED",
      visual: (
        <div className="h-32 border border-hairline-strong bg-black relative overflow-hidden flex flex-col justify-between p-4 font-mono text-[8px] text-muted-soft select-none">
          <div className="flex justify-between items-center text-[7px] text-muted border-b border-hairline pb-2">
            <span>AUDIT_STREAM</span>
            <span>AES_CHANNEL: OK</span>
          </div>
          <div className="space-y-1 overflow-hidden h-16 leading-relaxed opacity-60">
            <p>&gt; decrypt_stream --id=CASE_FILE_A</p>
            <p className="text-white">&gt;&gt; INGESTING 821 DOCUMENTS...</p>
            <p>&gt;&gt; PARSING ENTITIES... [3,401 RECONCILED]</p>
          </div>
        </div>
      )
    },
    {
      code: "PROTOCOL_03 // DATA_MESH",
      title: "IDENTITY RESOLUTION",
      desc: "Cluster multi-dimensional aliases into singular intelligence entities. Detect hidden organizational networks across case structures using high-dimensional similarity math.",
      icon: Binary,
      telemetry: "ENGINE: COSINE_SIMILARITY\nVECTOR: 1536_DIM\nACCURACY: 99.8%",
      visual: (
        <div className="h-32 border border-hairline-strong bg-black relative overflow-hidden flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:12px_12px]" />
          
          <svg className="w-full h-full max-h-[100px]" viewBox="0 0 200 100">
            <line x1="20" y1="20" x2="100" y2="50" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
            <line x1="180" y1="20" x2="100" y2="50" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
            <line x1="50" y1="80" x2="100" y2="50" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
            <line x1="150" y1="80" x2="100" y2="50" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
            
            <circle cx="100" cy="50" r="8" fill="black" stroke="white" strokeWidth="1.5" className="animate-pulse" />
            <circle cx="20" cy="20" r="4" fill="black" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
            <circle cx="180" cy="20" r="4" fill="black" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
            <circle cx="50" cy="80" r="4" fill="black" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
            <circle cx="150" cy="80" r="4" fill="black" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
          </svg>
        </div>
      )
    }
  ];

  return (
    <div className="w-full min-h-screen bg-black border-t border-hairline py-20 px-6 relative z-30 flex flex-col justify-center items-center overflow-hidden">
      
      {/* Background crosshair graphics */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

      <div className="w-full max-w-[1280px] z-10 space-y-16">
        
        {/* Section Header */}
        <div className="flex flex-col border-b border-hairline pb-8 select-none">
          <span className="font-mono-precision text-[10px] tracking-[0.25em] text-muted mb-2">SECTION 04 // PROTOCOLS</span>
          <h2 className="font-display text-3xl md:text-5xl tracking-[0.05em] uppercase text-white">SYSTEM CAPABILITIES</h2>
        </div>

        {/* Brutalist Capabilities Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {capabilitiesList.map((cap, idx) => {
            const Icon = cap.icon;
            const isHovered = hoveredIndex === idx;

            return (
              <TiltCard
                key={idx}
                className={`border bg-[#050505] p-6 space-y-6 text-left relative flex flex-col justify-between ${
                  isHovered ? "border-white bg-[#0a0a0a]" : "border-hairline bg-[#040404]"
                }`}
              >
                <div 
                  className="space-y-6"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Top HUD bar of card */}
                  <div className="flex justify-between items-center text-[8px] font-mono-precision text-muted-soft select-none">
                    <span>{cap.code}</span>
                    <Icon size={12} className={isHovered ? "text-white" : "text-muted-soft"} />
                  </div>

                  {/* Title & Desc */}
                  <div className="space-y-3">
                    <h3 className="font-display text-lg tracking-widest text-white uppercase">
                      {isHovered ? (
                        <DecryptText text={cap.title} duration={650} />
                      ) : (
                        cap.title
                      )}
                    </h3>
                    <p className="font-sans-body text-xs text-muted leading-relaxed">
                      {cap.desc}
                    </p>
                  </div>

                  {/* Feature Visual Asset */}
                  {cap.visual}
                </div>

                {/* Bottom technical parameters */}
                <div className="pt-6 border-t border-hairline-strong space-y-4">
                  <div className="bg-black p-3 border border-hairline-strong font-mono text-[8px] text-muted-soft leading-normal whitespace-pre-line select-none">
                    {cap.telemetry}
                  </div>
                  
                  {/* Interactive details trigger */}
                  <div className="flex justify-between items-center text-[9px] font-mono-precision text-muted group cursor-pointer hover:text-white transition-colors duration-300">
                    <span>AUDIT PARAMETERS</span>
                    <ChevronRight size={10} className="group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </div>
              </TiltCard>
            );
          })}
        </div>
      </div>
    </div>
  );
};
