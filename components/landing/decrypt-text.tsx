"use client";

import React, { useEffect, useState } from "react";

interface DecryptTextProps {
  text: string;
  delay?: number;
  duration?: number;
  className?: string;
  trigger?: boolean;
}

export const DecryptText: React.FC<DecryptTextProps> = ({
  text,
  delay = 0,
  duration = 800,
  className = "",
  trigger = true,
}) => {
  const [displayText, setDisplayText] = useState("");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789X#$@&%░▒▓█▄▀■";

  useEffect(() => {
    if (!trigger) return;

    let timeoutId: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout;

    const startAnimation = () => {
      const startTime = Date.now();
      
      intervalId = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        
        const revealIndex = Math.floor(progress * text.length);
        
        let result = "";
        for (let i = 0; i < text.length; i++) {
          if (i < revealIndex) {
            result += text[i];
          } else if (text[i] === " ") {
            result += " ";
          } else {
            result += chars[Math.floor(Math.random() * chars.length)];
          }
        }
        
        setDisplayText(result);

        if (progress === 1) {
          clearInterval(intervalId);
        }
      }, 30);
    };

    timeoutId = setTimeout(startAnimation, delay);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [text, delay, duration, trigger]);

  return <span className={className}>{displayText || text.replace(/./g, "░")}</span>;
};
