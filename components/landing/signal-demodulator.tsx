"use client";

import React, { useEffect, useRef, useState } from "react";
import { Activity, Radio, Cpu } from "lucide-react";

export const SignalDemodulator: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [params, setParams] = useState({ freq: 0.05, amp: 40, noise: 0.1 });
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;
    let frame = 0;

    // Smooth inertia interpolation values
    let targetFreq = 0.03;
    let targetAmp = 40;
    let currentFreq = 0.03;
    let currentAmp = 40;

    const resize = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      width = rect?.width || 500;
      height = 300;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      frame++;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      // Draw grid markings
      ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
      ctx.lineWidth = 0.5;
      const gridSpacing = 40;
      for (let x = 0; x < width; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Smooth interpolation of frequency and amplitude targets
      if (isHovered) {
        // Map mouse position to parameters
        targetFreq = 0.01 + (mouseRef.current.x / width) * 0.08;
        targetAmp = 10 + (1 - mouseRef.current.y / height) * 60;
      } else {
        // Default floating wave values
        targetFreq = 0.03 + Math.sin(frame * 0.005) * 0.01;
        targetAmp = 35 + Math.cos(frame * 0.01) * 10;
      }

      currentFreq += (targetFreq - currentFreq) * 0.08;
      currentAmp += (targetAmp - currentAmp) * 0.08;

      // Update state for UI telemetry display periodically
      if (frame % 10 === 0) {
        setParams({
          freq: parseFloat((currentFreq * 2000).toFixed(2)),
          amp: parseFloat(currentAmp.toFixed(1)),
          noise: parseFloat((0.05 + Math.random() * 0.1).toFixed(3))
        });
      }

      const centerY = height / 2;

      // --- Draw Carrier Wave (Muted, gray) ---
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const y = centerY + Math.sin(x * currentFreq + frame * 0.04) * currentAmp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // --- Draw Decrypted Data Wave (White, glowing) ---
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      
      if (isHovered) {
        ctx.shadowBlur = 6;
        ctx.shadowColor = "#ffffff";
      }

      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        // Compound frequency wave (synthesized noise / harmonics)
        const primary = Math.sin(x * currentFreq + frame * 0.06);
        const secondary = Math.sin(x * (currentFreq * 2.3) - frame * 0.02) * 0.3;
        const noise = (Math.random() - 0.5) * 2; // subtle noise jitter
        
        const y = centerY + (primary + secondary) * currentAmp + noise;
        
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Reset shadows
      ctx.shadowBlur = 0;

      // Draw vertical scanner pointer line
      const scannerX = (frame * 1.5) % width;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.beginPath();
      ctx.moveTo(scannerX, 0);
      ctx.lineTo(scannerX, height);
      ctx.stroke();

      // Scanner indicator circle
      const scanY = centerY + Math.sin(scannerX * currentFreq + frame * 0.06) * currentAmp;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(scannerX, scanY, 3, 0, Math.PI * 2);
      ctx.fill();

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [isHovered]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div ref={containerRef} className="w-full min-h-screen bg-black border-t border-hairline py-20 px-6 relative z-30 flex flex-col justify-center items-center overflow-hidden select-none">
      {/* Background radial coordinates */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,#000000_90%)] pointer-events-none" />

      <div className="w-full max-w-[1280px] z-10 space-y-16">
        
        {/* Section Header */}
        <div className="flex flex-col border-b border-hairline pb-8">
          <span className="font-mono-precision text-[10px] tracking-[0.25em] text-muted mb-2">SECTION 06 // SIGNAL CORRELATION</span>
          <h2 className="font-display text-3xl md:text-5xl tracking-[0.05em] uppercase text-white">TACTICAL SIGNAL AUDIT</h2>
        </div>

        {/* Dynamic Demodulator layout */}
        <div className="flex flex-col lg:flex-row items-center gap-12 justify-between">
          {/* Left info column */}
          <div className="w-full lg:w-[45%] text-left space-y-6">
            <div className="flex items-center space-x-2 text-[9px] font-mono text-muted tracking-widest uppercase">
              <Radio size={12} className="text-muted animate-pulse" />
              <span>CARRIER_SIGNAL: INTERCEPTED</span>
            </div>
            <h3 className="font-display text-2xl md:text-4xl tracking-wider text-white uppercase leading-tight">
              FREQUENCY ANALYSIS & ANALYSIS
            </h3>
            <p className="font-sans-body text-xs md:text-sm text-muted leading-relaxed">
              Capture obfuscated radio waves and carrier frequency metadata. Move your mouse coordinate vector over the analyzer screen to override current frequency multipliers and demodulate hidden parameters.
            </p>

            {/* Signal stats readout */}
            <div className="grid grid-cols-2 gap-4 border border-hairline p-5 bg-surface-soft/60">
              <div className="space-y-1">
                <div className="font-mono text-[7px] text-muted uppercase">FREQUENCY_RATIO</div>
                <div className="font-mono text-[11px] text-white font-bold">{params.freq} MHz</div>
              </div>
              <div className="space-y-1">
                <div className="font-mono text-[7px] text-muted uppercase">AMPLITUDE_VECTOR</div>
                <div className="font-mono text-[11px] text-white font-bold">{params.amp} V</div>
              </div>
              <div className="col-span-2 h-[1px] bg-hairline" />
              <div className="space-y-1 col-span-2">
                <div className="font-mono text-[7px] text-muted uppercase flex items-center space-x-1">
                  <Activity size={10} className="text-success" /> <span>DECRYPT_NOISE_INDEX</span>
                </div>
                <div className="font-mono text-[9px] text-success font-bold">MUT_RATE: {params.noise}</div>
              </div>
            </div>
          </div>

          {/* Right Canvas Column */}
          <div 
            className="w-full lg:w-[50%] h-[300px] border border-hairline bg-surface-soft/20 backdrop-blur-sm relative overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={handleMouseLeave}
          >
            {/* HUD Telemetry corners */}
            <div className="absolute top-2 left-2 text-[7px] font-mono text-muted-soft">DEMODULATOR_CONSOLE // CORE_AUDIO_V1</div>
            <div className="absolute bottom-2 right-2 text-[7px] font-mono text-muted-soft">GRID_LOCK: FREQ_TUNE</div>

            <canvas ref={canvasRef} className="block w-full h-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
