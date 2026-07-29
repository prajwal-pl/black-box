"use client";

import React, { useEffect, useRef, useState } from "react";

interface Node3D {
  x: number;
  y: number;
  z: number;
  ox: number; // original coordinates for drift
  oy: number;
  oz: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  label?: string;
  code?: string;
  isKeyNode: boolean;
  screenX: number;
  screenY: number;
  screenZ: number;
  hovered: boolean;
  scrambleTimer: number;
  currentLabel: string;
}

export const IntelGraphCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeNode, setActiveNode] = useState<Node3D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    // Camera parameters
    let rotX = 0.2;
    let rotY = 0.5;
    let targetRotX = 0.2;
    let targetRotY = 0.5;
    let zoom = 1.1;

    // Mouse tracking
    let mouseX = 0;
    let mouseY = 0;
    let isMouseInCanvas = false;

    // Setup sizes
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

    // Initialize 3D points
    const nodes: Node3D[] = [];
    const numParticles = 90;
    
    const keyLabels = [
      "METADATA_SOURCE_ALPHA",
      "TARGET_COORD_NORTH",
      "IP_SUBNET_ROUTE_82",
      "TRANSACTION_LEDGER_HASH",
      "COMM_LOG_TRANSCRIPT_E4",
      "TELEMETRY_DATAFEED_SYS",
      "ENCRYPTED_SIGNAL_STREAM",
      "GEOLOC_VECTOR_EST"
    ];

    const generateKeyCodes = () => {
      const chars = "0123456789ABCDEF";
      return Array.from({ length: 8 }, () => 
        "0x" + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * 16)]).join("")
      );
    };
    
    const keyCodes = generateKeyCodes();

    // Create central key nodes
    for (let i = 0; i < keyLabels.length; i++) {
      const theta = (i / keyLabels.length) * Math.PI * 2;
      const r = 120 + Math.random() * 40;
      const x = Math.cos(theta) * r;
      const y = (Math.random() - 0.5) * 80;
      const z = Math.sin(theta) * r;
      
      nodes.push({
        x, y, z,
        ox: x, oy: y, oz: z,
        vx: (Math.random() - 0.5) * 0.05,
        vy: (Math.random() - 0.5) * 0.05,
        vz: (Math.random() - 0.5) * 0.05,
        size: 3.5,
        label: keyLabels[i],
        code: keyCodes[i],
        isKeyNode: true,
        screenX: 0,
        screenY: 0,
        screenZ: 0,
        hovered: false,
        scrambleTimer: 0,
        currentLabel: keyLabels[i]
      });
    }

    // Create random background connection nodes
    for (let i = 0; i < numParticles; i++) {
      const r = 50 + Math.random() * 250;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      nodes.push({
        x, y, z,
        ox: x, oy: y, oz: z,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.1,
        vz: (Math.random() - 0.5) * 0.1,
        size: 1.2,
        isKeyNode: false,
        screenX: 0,
        screenY: 0,
        screenZ: 0,
        hovered: false,
        scrambleTimer: 0,
        currentLabel: ""
      });
    }

    // Scramble effect helper
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789X#$░▒▓█▀■";
    const scramble = (str: string) => {
      return str
        .split("")
        .map((c) => (c === "_" ? "_" : Math.random() > 0.3 ? chars[Math.floor(Math.random() * chars.length)] : c))
        .join("");
    };

    // Tracks mouse movement
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      isMouseInCanvas = true;

      // Update camera targets based on mouse position
      targetRotY = 0.5 + ((mouseX - width / 2) / width) * 0.4;
      targetRotX = 0.2 + ((mouseY - height / 2) / height) * 0.4;
    };

    const onMouseLeave = () => {
      isMouseInCanvas = false;
      targetRotY = 0.5;
      targetRotX = 0.2;
    };

    const onMouseClick = () => {
      if (hoveredNode) {
        // Trigger a scramble on click
        hoveredNode.scrambleTimer = 15;
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("click", onMouseClick);

    let frameCount = 0;
    let hoveredNode: Node3D | null = null;

    // Animation Loop
    const loop = () => {
      // Respect prefers-reduced-motion
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      frameCount++;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      // Draw subtle brutalist target-style backdrop grid lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.015)";
      ctx.lineWidth = 1;
      
      const gridSpacing = 80;
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

      // Smooth camera interpolation
      rotX += (targetRotX - rotX) * 0.05;
      rotY += (targetRotY - rotY) * 0.05;

      // Slow constant camera rotation
      rotY += 0.0006;

      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);

      const centerX = width / 2;
      const centerY = height / 2;
      const fov = 400 * zoom;

      // Update positions & Project to 2D
      nodes.forEach((node) => {
        // Slow float drift
        const timeFactor = frameCount * 0.005;
        node.x = node.ox + Math.sin(timeFactor + node.oy) * 12;
        node.y = node.oy + Math.cos(timeFactor * 0.7 + node.ox) * 12;
        node.z = node.oz + Math.sin(timeFactor * 1.2 + node.ox) * 12;

        // Apply mouse force field if mouse is close
        if (isMouseInCanvas && node.isKeyNode) {
          // Check screen distance
          const dx = mouseX - node.screenX;
          const dy = mouseY - node.screenY;
          const dist = Math.hypot(dx, dy);
          if (dist < 100) {
            const force = (100 - dist) * 0.05;
            node.x += (dx / dist) * force;
            node.y += (dy / dist) * force;
          }
        }

        // Apply rotation matrices
        // Y-axis rotation
        let x1 = node.x * cosY - node.z * sinY;
        let z1 = node.x * sinY + node.z * cosY;
        
        // X-axis rotation
        let y2 = node.y * cosX - z1 * sinX;
        let z2 = node.y * sinX + z1 * cosX;

        // Project
        const scale = fov / (fov + z2);
        node.screenX = centerX + x1 * scale;
        node.screenY = centerY + y2 * scale;
        node.screenZ = z2; // For depth sorting

        // Scramble label animations for key nodes
        if (node.isKeyNode) {
          if (node.scrambleTimer > 0) {
            node.currentLabel = scramble(node.label || "");
            node.scrambleTimer--;
          } else if (node.hovered) {
            if (Math.random() < 0.1) {
              node.currentLabel = scramble(node.label || "");
            }
          } else {
            node.currentLabel = node.label || "";
          }
        }
      });

      // Depth sort nodes so elements closer draw on top
      nodes.sort((a, b) => b.screenZ - a.screenZ);

      // Check mouse hover on key nodes
      let currentHovered: Node3D | null = null;
      if (isMouseInCanvas) {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (node.isKeyNode) {
            const dx = mouseX - node.screenX;
            const dy = mouseY - node.screenY;
            if (Math.hypot(dx, dy) < 18) {
              currentHovered = node;
              break;
            }
          }
        }
      }

      // Update hover state
      nodes.forEach((n) => {
        if (n.isKeyNode) {
          const wasHovered = n.hovered;
          n.hovered = n === currentHovered;
          if (n.hovered && !wasHovered) {
            n.scrambleTimer = 10;
          }
        }
      });

      if (currentHovered !== hoveredNode) {
        hoveredNode = currentHovered;
        setActiveNode(currentHovered);
      }

      // Draw Connections (Lines)
      const maxDistance = 140;
      for (let i = 0; i < nodes.length; i++) {
        const p1 = nodes[i];
        
        // Connect key nodes to other close nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const p2 = nodes[j];
          
          // Fast spatial distance check
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dz = p1.z - p2.z;
          const dist = dx * dx + dy * dy + dz * dz;
          
          if (dist < maxDistance * maxDistance) {
            const d = Math.sqrt(dist);
            // Calculate opacity based on distance
            let opacity = (1 - d / maxDistance) * 0.16;
            
            // Boost line opacity if either node is hovered or a key node
            if (p1.hovered || p2.hovered) {
              opacity = (1 - d / maxDistance) * 0.6;
            } else if (p1.isKeyNode && p2.isKeyNode) {
              opacity = (1 - d / maxDistance) * 0.28;
            }

            ctx.beginPath();
            ctx.moveTo(p1.screenX, p1.screenY);
            ctx.lineTo(p2.screenX, p2.screenY);
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.lineWidth = p1.hovered || p2.hovered ? 0.8 : 0.4;
            ctx.stroke();
          }
        }
      }

      // Draw Nodes
      nodes.forEach((node) => {
        // Skip nodes behind camera
        if (node.screenZ < -fov) return;

        const size = node.size * (fov / (fov + node.screenZ));

        if (node.isKeyNode) {
          // Draw key node: square symbol with dotted border
          ctx.save();
          ctx.translate(node.screenX, node.screenY);

          // Highlight glow
          if (node.hovered) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = "#ffffff";
            ctx.fillStyle = "#ffffff";
            ctx.strokeStyle = "#ffffff";
          } else {
            ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
          }

          // Draw square center
          const sqSize = node.hovered ? 6 : 4;
          ctx.fillRect(-sqSize / 2, -sqSize / 2, sqSize, sqSize);

          // Draw surrounding bracket circle
          ctx.beginPath();
          ctx.arc(0, 0, node.hovered ? 14 : 9, 0, Math.PI * 2);
          ctx.lineWidth = 0.5;
          if (node.hovered) {
            ctx.setLineDash([2, 2]);
          }
          ctx.stroke();

          // If hovered, draw technical UI tags
          if (node.hovered) {
            ctx.restore();
            ctx.save();
            ctx.translate(node.screenX, node.screenY);

            ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
            ctx.fillStyle = "#ffffff";
            
            // Draw crosshairs
            ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(-20, 0); ctx.lineTo(-14, 0);
            ctx.moveTo(14, 0); ctx.lineTo(20, 0);
            ctx.moveTo(0, -20); ctx.lineTo(0, -14);
            ctx.moveTo(0, 14); ctx.lineTo(0, 20);
            ctx.stroke();

            // Label text reveal
            ctx.fillText(node.currentLabel, 26, -4);
            ctx.fillStyle = "#999999";
            ctx.fillText(node.code || "", 26, 8);

            // Draw line to pointer text
            ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
            ctx.beginPath();
            ctx.moveTo(15, -4);
            ctx.lineTo(22, -4);
            ctx.stroke();
          }
          ctx.restore();

        } else {
          // Regular background particles
          ctx.beginPath();
          ctx.arc(node.screenX, node.screenY, size, 0, Math.PI * 2);
          
          // Draw with depth-based opacity
          const zDepth = (node.screenZ + 200) / 400; // normalized depth
          const opacity = Math.max(0.08, Math.min(0.4, 0.4 * (1 - zDepth)));
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.fill();
        }
      });

      // Technical HUD lines (Brutalist telemetry markers)
      // Left coordinate label
      ctx.font = "8px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fillText(`CAM_Y: ${rotY.toFixed(4)}`, 32, height - 32);
      ctx.fillText(`CAM_X: ${rotX.toFixed(4)}`, 32, height - 22);
      ctx.fillText(`FPS: 60.00 / LAT: 1.2ms`, 32, height - 12);

      // Right active system codes
      ctx.textAlign = "right";
      ctx.fillText(`SYS_STATUS: ACTIVE_DECRYPT`, width - 32, height - 32);
      ctx.fillText(`GRAPH_NODES: ${nodes.length}`, width - 32, height - 22);
      ctx.fillText("CORE_ENGINE: WEB_GL_CANVAS", width - 32, height - 12);
      ctx.textAlign = "left";

      // Center crosshair (subtle)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(width / 2 - 20, height / 2);
      ctx.lineTo(width / 2 + 20, height / 2);
      ctx.moveTo(width / 2, height / 2 - 20);
      ctx.lineTo(width / 2, height / 2 + 20);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(loop);
    };

    // Delay start loop slightly to allow rendering page elements
    const startDelay = setTimeout(() => {
      animationFrameId = requestAnimationFrame(loop);
    }, 100);

    return () => {
      clearTimeout(startDelay);
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full overflow-hidden select-none bg-black">
      <canvas ref={canvasRef} className="block w-full h-full pointer-events-auto" />
      
      {/* Floating HUD status indicator in case a node is active */}
      {activeNode && (
        <div className="absolute top-[10%] left-[5%] md:left-[8%] p-4 border border-hairline bg-black/80 backdrop-blur-md max-w-[280px] font-mono-precision tracking-wider select-none animate-fade-in pointer-events-none transition-all duration-300">
          <div className="text-[9px] text-muted uppercase tracking-[0.2em] mb-1">INTERCEPT DATA</div>
          <div className="text-white text-xs font-semibold mb-2 tracking-[0.05em] uppercase">{activeNode.label}</div>
          <div className="h-[1px] bg-hairline mb-2 w-full" />
          <div className="grid grid-cols-2 gap-y-1 text-[8px] text-muted uppercase tracking-[0.1em]">
            <span>NODE_VAL:</span>
            <span className="text-white font-mono">{activeNode.code}</span>
            <span>COORD_X:</span>
            <span className="text-white font-mono">{activeNode.x.toFixed(2)}</span>
            <span>COORD_Y:</span>
            <span className="text-white font-mono">{activeNode.y.toFixed(2)}</span>
            <span>DECRYPT_RATE:</span>
            <span className="text-success font-mono font-bold">99.8%</span>
          </div>
        </div>
      )}
    </div>
  );
};
