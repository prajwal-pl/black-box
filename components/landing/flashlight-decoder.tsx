"use client";

import React, { useEffect, useRef, useState } from "react";
import { Terminal, Eye } from "lucide-react";

export const FlashlightDecoder: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mouse, setMouse] = useState({ x: -1000, y: -1000 });
  const [isHovered, setIsHovered] = useState(false);

  // Intel messages concealed within the matrix
  const hiddenLines = [
    "SECURITY PROTOCOL ACTIVE // LEVEL 4 CLEARANCE INITIALIZED",
    "TARGET VEHICLE GPS LOCATED AT COORD: [48.1351, 11.5820] NORTH",
    "TRANSFERRED OMEGA DATA ROUTE TO SECURE SUBNET 198.51.100.82",
    "IP TELEMETRY DETECTED INCOMING PACKETS FROM MUNICH GATEWAY",
    "ECC_DH_256 CRYPTO KEY AUTHENTICATED BY OPERATOR KEY #0821",
    "WARNING: CONTRADICTORY TIMESTAMPS DETECTED IN SECURE ENCLAVE",
    "LEDGER DEBIT CONFIRMED: 0.021 BTC DEPLOYED TO TARGET WALLET",
    "COGNITIVE LOGIC ENGAGED: TRACING HYPOTHESIS ON OMEGA NETWORK"
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;
    let frame = 0;

    const resize = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      width = rect?.width || window.innerWidth;
      height = rect?.height || window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    resize();
    window.addEventListener("resize", resize);

    const chars = "XYZ#$%░▒▓█▀■0123456789";
    const fontSize = 11;
    const spacing = 16;
    const cols = Math.floor(window.innerWidth / spacing) + 2;
    const rows = Math.floor(window.innerHeight / spacing) + 2;

    // Generate static matrix grid state to avoid shuffling position on frame
    const gridState: { x: number; y: number; originalChar: string; targetChar: string }[] = [];

    // Prepopulate grid character maps
    for (let r = 0; r < rows; r++) {
      const lineIndex = r % hiddenLines.length;
      const currentLine = hiddenLines[lineIndex];
      
      for (let c = 0; c < cols; c++) {
        // Map line character or padding
        let targetChar = " ";
        if (c < currentLine.length) {
          targetChar = currentLine[c];
        }
        
        gridState.push({
          x: c * spacing + 4,
          y: r * spacing + 12,
          originalChar: chars[Math.floor(Math.random() * chars.length)],
          targetChar
        });
      }
    }

    const draw = () => {
      frame++;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      // Flashlight parameters
      const radius = 130;

      gridState.forEach((cell) => {
        const dx = mouse.x - cell.x;
        const dy = mouse.y - cell.y;
        const dist = Math.hypot(dx, dy);

        ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

        if (dist < radius) {
          // Decrypted text inside the flashlight area
          const intensity = 1 - dist / radius;
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.15, intensity)})`;
          ctx.fillText(cell.targetChar, cell.x, cell.y);
        } else {
          // Scrambled gibberish outside the flashlight area
          // Randomly mutate characters to simulate live noise
          if (Math.random() < 0.005) {
            cell.originalChar = chars[Math.floor(Math.random() * chars.length)];
          }
          ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
          // Render space as space, otherwise draw code noise
          ctx.fillText(cell.targetChar === " " ? " " : cell.originalChar, cell.x, cell.y);
        }
      });

      // Draw flashlight border overlay with glass reflections
      if (isHovered) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Draw crosshair indicator in the center
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.beginPath();
        ctx.moveTo(mouse.x - 8, mouse.y);
        ctx.lineTo(mouse.x + 8, mouse.y);
        ctx.moveTo(mouse.x, mouse.y - 8);
        ctx.lineTo(mouse.x, mouse.y + 8);
        ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [mouse, isHovered]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMouse({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setMouse({ x: -1000, y: -1000 });
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-screen bg-black relative flex flex-col justify-between overflow-hidden select-none border-t border-hairline py-16 px-6 md:px-12 z-30"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* HUD Border Telemetry overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_30%,#000000_85%)]" />

      {/* Header */}
      <div className="w-full flex justify-between items-center font-mono text-[9px] text-muted-soft tracking-[0.2em] z-20 border-b border-hairline pb-4 pt-2">
        <span className="flex items-center space-x-1.5">
          <Terminal size={10} className="text-warning animate-pulse" />
          <span>MODULE_05 // CRYPTO_CIPHER_MATRIX</span>
        </span>
        <span className="text-white bg-hairline px-2 py-0.5">[DECRYPT_ON_HOVER]</span>
      </div>

      {/* Interactive Canvas Canvas Grid */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-0" />

      {/* Floating Instruction overlay in case mouse is not inside */}
      {!isHovered && (
        <div className="absolute top-[45%] left-0 right-0 text-center pointer-events-none z-10 animate-pulse">
          <div className="flex justify-center mb-2 text-muted-soft">
            <Eye size={20} />
          </div>
          <div className="font-display text-sm tracking-[0.2em] text-muted-soft uppercase">
            SWEEP CURSOR OVER MATRIX
          </div>
          <div className="font-mono text-[8px] text-muted-soft uppercase tracking-widest mt-1">
            TO DECODE HIDDEN INTELLIGENCE FEEDS
          </div>
        </div>
      )}

      {/* Bottom Footer parameters */}
      <div className="w-full flex flex-col sm:flex-row justify-between items-center font-mono text-[8px] text-muted-soft tracking-[0.2em] z-20 border-t border-hairline pt-4 gap-2 sm:gap-0">
        <span>CIPHER_KEY: ROT_DECIPHER_24</span>
        <span>FLASHLIGHT_MASK: ACTIVE_BLENDED</span>
      </div>
    </div>
  );
};
