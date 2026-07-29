"use client";

import React, { useState } from "react";
import { FolderOpen, Terminal, Check, Activity, Search, Shield } from "lucide-react";
import { DecryptText } from "./decrypt-text";

interface EvidenceFile {
  id: string;
  name: string;
  type: string;
  classification: string;
  date: string;
  data: {
    source: string;
    details: string;
    metrics: string[];
  };
}

export const InteractiveDesk: React.FC = () => {
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const evidenceFiles: EvidenceFile[] = [
    {
      id: "EVID_01",
      name: "LEDGER_TRAFFIC_ST-4.DAT",
      type: "FINANCIAL",
      classification: "SECRET // NOFORN",
      date: "2026-07-28 14:02 UTC",
      data: {
        source: "TRANSACTION LOG",
        details: "Detected OMEGA wallet deployed 0.021 BTC payload to suspect endpoint at t-14 seconds prior to geo-registration confirmation.",
        metrics: ["TX_ID: 0x82f91a", "DEBIT: 0.021 BTC", "CONFIDENCE: 98%"]
      }
    },
    {
      id: "EVID_02",
      name: "SUBNET_GEO_IP_GR.TXT",
      type: "TELEMETRY",
      classification: "SECRET",
      date: "2026-07-28 14:02 UTC",
      data: {
        source: "SUBNET MONITOR",
        details: "High-density carrier packets routed from suspect Munich gateway proxy [194.81.2.0] resolved to suspect target node.",
        metrics: ["IP_ADDR: 198.51.100.82", "GATEWAY: DE_MUC_4", "ERR_RATE: 0.00%"]
      }
    },
    {
      id: "EVID_03",
      name: "AUDIO_INTERCEPT_89.MP3",
      type: "COMMUNICATIONS",
      classification: "TOP SECRET",
      date: "2026-07-28 13:58 UTC",
      data: {
        source: "RF INTERCEPT",
        details: "Target confirmed link encryption key. Indicated data packages were uploaded via ledger tunnel prior to shutdown signal.",
        metrics: ["SPEAKER: ALIAS_OMEGA", "DECRYPT_KEY: ECC_256", "STRENGTH: 100%"]
      }
    }
  ];

  const handleSelectFile = (fileId: string) => {
    if (activeFileId === fileId) return;
    setIsScanning(true);
    setActiveFileId(fileId);
    
    // Simulate scan/decryption delay
    setTimeout(() => {
      setIsScanning(false);
    }, 850);
  };

  const activeFile = evidenceFiles.find((f) => f.id === activeFileId);

  return (
    <div className="w-full min-h-screen bg-black border-t border-hairline py-20 px-6 relative z-30 flex flex-col justify-center items-center overflow-hidden select-none">
      {/* Background table grid lines */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.006)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.006)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,#000000_85%)] pointer-events-none" />

      <div className="w-full max-w-[1280px] z-10 space-y-16">
        
        {/* Section Header */}
        <div className="flex flex-col border-b border-hairline pb-8">
          <span className="font-mono-precision text-[10px] tracking-[0.25em] text-muted mb-2">SECTION 07 // INTEL DECK</span>
          <h2 className="font-display text-3xl md:text-5xl tracking-[0.05em] uppercase text-white">THE OPERATIONAL BENCH</h2>
        </div>

        {/* Desk Layout */}
        <div className="flex flex-col lg:flex-row items-stretch justify-between gap-12">
          
          {/* Left: Scattered evidence files */}
          <div className="w-full lg:w-[48%] flex flex-col justify-start space-y-6">
            <div className="font-mono text-[9px] text-muted tracking-widest uppercase flex items-center space-x-1.5 mb-2">
              <FolderOpen size={12} />
              <span>CLASSIFIED EVIDENCE PORTFOLIO</span>
            </div>

            <div className="space-y-4">
              {evidenceFiles.map((file) => {
                const isSelected = activeFileId === file.id;

                return (
                  <div
                    key={file.id}
                    onClick={() => handleSelectFile(file.id)}
                    className={`border p-5 text-left transition-all duration-400 cursor-pointer flex justify-between items-center relative overflow-hidden group ${
                      isSelected 
                        ? "border-white bg-[#0a0a0a]" 
                        : "border-hairline bg-[#030303] hover:border-white/20 hover:bg-[#070707]"
                    }`}
                  >
                    {/* Folder Corner bracket */}
                    <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-muted-soft group-hover:border-white transition-colors" />
                    
                    <div className="space-y-3 max-w-[80%]">
                      <div className="flex items-center space-x-2 text-[8px] font-mono text-muted-soft">
                        <span>{file.type}</span>
                        <span>•</span>
                        <span className="text-warning font-bold">{file.classification}</span>
                      </div>
                      <h4 className="font-mono text-[11px] text-white font-bold tracking-wider truncate">
                        {file.name}
                      </h4>
                    </div>

                    <div className="font-mono text-[8px] text-muted-soft flex items-center space-x-2">
                      <span>{file.date}</span>
                      <div className={`w-3.5 h-3.5 border flex items-center justify-center rounded-none transition-colors ${
                        isSelected ? "border-white bg-white text-black" : "border-hairline"
                      }`}>
                        {isSelected && <Check size={10} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Analyzer terminal screen */}
          <div className="w-full lg:w-[48%] flex flex-col justify-stretch">
            <div className="flex-1 border border-hairline bg-[#040404]/60 backdrop-blur-md p-6 relative flex flex-col justify-between min-h-[360px] md:min-h-[420px] text-left">
              
              {/* Telemetry screen corners */}
              <div className="absolute top-2 left-2 text-[7px] font-mono text-muted-soft">SCREEN_MODE: PARSER</div>
              <div className="absolute bottom-2 right-2 text-[7px] font-mono text-muted-soft">GRID_ALIGN: ACTIVE</div>

              {/* Analyzer sweep scanning bar */}
              {isScanning && (
                <div className="absolute left-0 right-0 h-[2px] bg-white z-20 pointer-events-none animate-scan" />
              )}

              {activeFile ? (
                <>
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex justify-between items-center border-b border-hairline pb-4">
                      <div>
                        <div className="font-mono text-[8px] text-muted-soft">PARSING NODE ID: {activeFile.id}</div>
                        <h3 className="font-mono text-xs text-white font-bold tracking-wider mt-0.5">
                          {activeFile.name}
                        </h3>
                      </div>
                      <span className="font-mono text-[8px] text-success animate-pulse flex items-center space-x-1">
                        <Activity size={10} /> <span>{isScanning ? "DECRYPTING..." : "RESOLVED"}</span>
                      </span>
                    </div>

                    {/* Content */}
                    <div className="space-y-4">
                      <div className="font-mono text-[8px] text-muted uppercase">EXTRACTED CONTENT DESCRIPTION</div>
                      <div className="font-mono text-[10px] text-white leading-relaxed p-4 border border-hairline-strong bg-black">
                        {isScanning ? (
                          <DecryptText text="PARSING DECRYPTED SEGMENT DATA FEED..." duration={600} />
                        ) : (
                          activeFile.data.details
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Metadata fields */}
                  <div className="space-y-4 border-t border-hairline-strong pt-6">
                    <div className="font-mono text-[8px] text-muted uppercase">PARSED ATTRIBUTES LINKED</div>
                    <div className="grid grid-cols-3 gap-4">
                      {activeFile.data.metrics.map((metric, idx) => (
                        <div key={idx} className="bg-black border border-hairline-strong p-3 font-mono text-[8px] text-muted-soft leading-normal">
                          {isScanning ? "--------" : metric}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="my-auto text-center space-y-4 pointer-events-none">
                  <div className="flex justify-center text-muted-soft">
                    <Search size={24} className="animate-pulse" />
                  </div>
                  <div className="font-display text-[11px] tracking-[0.2em] text-muted-soft uppercase">
                    AWAITING CONSOLE INGRESS
                  </div>
                  <p className="font-mono text-[8px] text-muted-soft leading-normal max-w-[280px] mx-auto">
                    SELECT A CLASSIFIED EVIDENCE DOCUMENT FROM THE PORTFOLIO TO AUDIT CORRELATION DATA.
                  </p>
                </div>
              )}

              {/* Security parameters bottom */}
              <div className="pt-4 border-t border-hairline/60 flex justify-between items-center text-[7px] font-mono text-muted-soft">
                <span className="flex items-center space-x-1"><Shield size={8} className="text-success" /> <span>SECURE INTEGRITY CONTROL</span></span>
                <span>AUDIT_LOG: ON</span>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
