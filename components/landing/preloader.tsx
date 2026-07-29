"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Shield, Cpu, Lock } from "lucide-react";
import { DecryptText } from "./decrypt-text";

interface PreloaderProps {
  onComplete: () => void;
}

export const Preloader: React.FC<PreloaderProps> = ({ onComplete }) => {
  const [bootState, setBootState] = useState<"idle" | "booting" | "complete">("idle");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [currentProgress, setCurrentProgress] = useState(0);
  const grainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Simulated system logs during boot
  const bootLogs = [
    "LOG: SECURE_CORE INITIALIZATION SEQUENCE INITIATED",
    "LOG: LOADING ENCLAVE CRYPTO PROTOCOLS [AES_GCM_256, RSA_ECC]",
    "LOG: CONFIGURING TRUSTED COMPUTING WORKSPACE",
    "LOG: INGESTING LOCALIZED METADATA SCHEMA V0.82",
    "LOG: DETECTING DATA ROUTE TO ENDPOINT CENTRAL...",
    "LOG: ACCESS PORT TUNNEL ESTABLISHED SECURELY",
    "LOG: CORE SYSTEM BOOTSTRAP TERMINATION [OK]"
  ];

  // Film grain background loop
  useEffect(() => {
    const canvas = grainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = 120);
    let height = (canvas.height = 120);

    const generateNoise = () => {
      const imgData = ctx.createImageData(width, height);
      const data = imgData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const val = Math.floor(Math.random() * 255);
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 15; // low opacity
      }
      ctx.putImageData(imgData, 0, 0);
    };

    const loop = () => {
      generateNoise();
      // slow down noise update slightly to look more like film grain
      setTimeout(() => {
        animId = requestAnimationFrame(loop);
      }, 50);
    };

    loop();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  // Web Audio API low-frequency classified hum
  const startSystemHum = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      // Base hum oscillator (low G1 frequency)
      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(55, ctx.currentTime); // 55Hz

      // Secondary texture oscillator to add mechanical grit (low C#1 frequency)
      const osc2 = ctx.createOscillator();
      osc2.type = "sawtooth";
      osc2.frequency.setValueAtTime(68.68, ctx.currentTime); // 68.68Hz

      // Filter to keep the audio low and warm
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(100, ctx.currentTime);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.015, ctx.currentTime); // very quiet, ambient

      // Connect nodes
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Start oscillators
      osc1.start();
      osc2.start();
    } catch (err) {
      console.warn("Web Audio API not supported or blocked: ", err);
    }
  };

  const handleBoot = () => {
    if (bootState !== "idle") return;
    setBootState("booting");
    startSystemHum();

    // Sequentially dump log lines to simulate bootup
    let currentLine = 0;
    const dumpLog = () => {
      if (currentLine < bootLogs.length) {
        setLogLines((prev) => [...prev, bootLogs[currentLine]]);
        setCurrentProgress(Math.floor(((currentLine + 1) / bootLogs.length) * 100));
        currentLine++;
        setTimeout(dumpLog, 250);
      } else {
        setTimeout(() => {
          setBootState("complete");
          setTimeout(onComplete, 800); // fade out duration
        }, 300);
      }
    };

    setTimeout(dumpLog, 200);
  };

  // Bind keypress to initiate boot
  useEffect(() => {
    const handleKeyPress = () => {
      if (bootState === "idle") {
        handleBoot();
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [bootState]);

  return (
    <AnimatePresence>
      {bootState !== "complete" && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="fixed inset-0 w-full h-full bg-black z-[9999] flex flex-col justify-between p-6 md:p-12 overflow-hidden select-none"
          onClick={handleBoot}
        >
          {/* Film Grain Overlay */}
          <canvas
            ref={grainCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none opacity-30 mix-blend-screen"
            style={{ imageRendering: "pixelated" }}
          />

          {/* Top HUD */}
          <div className="w-full flex justify-between items-center font-mono text-[9px] text-muted-soft tracking-[0.2em] z-10">
            <span className="flex items-center space-x-1.5">
              <Lock size={10} className="text-warning animate-pulse" />
              <span>CLASSIFIED TERMINAL</span>
            </span>
            <span>PORT_LINK: UNRESOLVED</span>
          </div>

          {/* Core Boot Prompts */}
          <div className="w-full max-w-[640px] mx-auto my-auto space-y-8 text-left z-10">
            {bootState === "idle" ? (
              <div className="space-y-4">
                <h1 className="font-display text-4xl md:text-6xl tracking-[0.15em] text-white uppercase select-none">
                  BLACKBOX
                </h1>
                <div className="flex items-center space-x-2 font-mono text-[10px] md:text-[11px] text-muted tracking-wider">
                  <span className="w-1.5 h-3 bg-white animate-pulse" />
                  <span className="uppercase">
                    <DecryptText text="PRESS ANY KEY OR CLICK SCREEN TO DECRYPT TERMINAL" duration={1000} />
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Boot progress logs */}
                <div className="font-mono text-[9px] md:text-[10px] text-muted space-y-2 h-44 overflow-y-auto">
                  {logLines.map((line, idx) => (
                    <motion.p
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15 }}
                      className={idx === logLines.length - 1 ? "text-white" : "text-muted"}
                    >
                      &gt; {line}
                    </motion.p>
                  ))}
                </div>

                {/* Progress bar */}
                <div className="space-y-2 font-mono text-[8px] tracking-[0.2em] text-muted-soft">
                  <div className="flex justify-between">
                    <span>SYS_CORE_RESOLVING</span>
                    <span>{currentProgress}%</span>
                  </div>
                  <div className="h-[1px] bg-hairline w-full relative">
                    <motion.div
                      className="absolute top-0 left-0 h-full bg-white"
                      style={{ width: `${currentProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom HUD */}
          <div className="w-full flex flex-col sm:flex-row justify-between items-center font-mono text-[8px] text-muted-soft tracking-[0.2em] z-10 gap-2 sm:gap-0">
            <div className="flex items-center space-x-2">
              <Shield size={10} className="text-warning" />
              <span>RESTRICTED INGRESS ZONE</span>
            </div>
            <span>SECURE PROTOCOL V_0.8</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
