"use client";

import React, { useState } from "react";
import { Preloader } from "@/components/landing/preloader";
import { SmoothScrollProvider } from "@/components/landing/smooth-scroll";
import { CinematicBriefing } from "@/components/landing/cinematic-briefing";
import { FlashlightDecoder } from "@/components/landing/flashlight-decoder";
import { SignalDemodulator } from "@/components/landing/signal-demodulator";
import { InteractiveDesk } from "@/components/landing/interactive-desk";
import { Capabilities } from "@/components/landing/capabilities";
import { ClosingCta } from "@/components/landing/closing-cta";

export default function Home() {
  const [isPreloaded, setIsPreloaded] = useState(false);

  return (
    <>
      <Preloader onComplete={() => setIsPreloaded(true)} />
      {isPreloaded && (
        <SmoothScrollProvider>
          <main className="w-full min-h-screen bg-black select-none">
            {/* Act I - IV: Cinematic Video Briefing */}
            <CinematicBriefing />
            
            {/* Act V: Interactive Flashlight Cipher Matrix */}
            <FlashlightDecoder />
            
            {/* Act VI: Tactical Oscilloscope Demodulator */}
            <SignalDemodulator />
            
            {/* Act VII: Operational Investigation Portfolio Desk */}
            <InteractiveDesk />
            
            {/* Act VIII: 3D Perspective Capabilities Tilt Grid */}
            <Capabilities />
            
            {/* Act IX: System Disconnect & Terminal Access CTA */}
            <ClosingCta />
          </main>
        </SmoothScrollProvider>
      )}
    </>
  );
}
