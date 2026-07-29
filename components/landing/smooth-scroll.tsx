"use client";

import React, { useEffect } from "react";
import Lenis from "lenis";

export const SmoothScrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // Check if prefers-reduced-motion is active
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // exponential deceleration
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.5,
    });

    let animationFrameId: number;

    function raf(time: number) {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }

    animationFrameId = requestAnimationFrame(raf);

    // Sync scroll with GSAP ScrollTrigger if GSAP is loaded later
    const handleScroll = () => {
      // Force ScrollTrigger update to prevent synchronization lag
      if (typeof window !== "undefined" && (window as any).ScrollTrigger) {
        (window as any).ScrollTrigger.update();
      }
    };

    lenis.on("scroll", handleScroll);

    return () => {
      cancelAnimationFrame(animationFrameId);
      lenis.off("scroll", handleScroll);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
};
