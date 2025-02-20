"use client";

import { useEffect, useRef } from "react";

interface Dot {
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number };
  radius: number;
  pulseProg: number;
  pulseVal: number;
  hasPulse: boolean;
  radiusMul: number;
}

interface BlurDot {
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number };
  radiusMul: number;
}

const config = {
  noiseSpeed: 0.003,
  noiseScale: 150,
  noiseVel: 1,
  glow: 10,
  perspective: 1000,
  speed: 0.5,
  dots: {
    count: 60,
    radius: 2,
    pulseWidth: 1,
    lineWidth: 1,
    pulseCounter: 300,
    pulseDist: 30,
    distance: 150,
    color: "rgba(255, 255, 255, 0.8)",
    maxVel: 0.5,
    hasPulse: 0.8,
    minZ: 0,
    maxZ: 2000,
  },
  blurDots: {
    count: 8,
    radius: 80,
    color: "rgba(0, 22, 51, 0.8)",
  },
};

function project(x: number, y: number, z: number) {
  const scale = config.perspective / (config.perspective + z);
  return {
    x: x * scale,
    y: y * scale,
    scale,
  };
}

export function ConstellationBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let dots: Dot[] = [];
    let blurDots: BlurDot[] = [];
    let noiseTime = 0;
    let currentScale = 1;

    const resizeCanvas = () => {
      const { innerWidth, innerHeight } = window;
      const dpr = window.devicePixelRatio || 1;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;

      currentScale = dpr;
      ctx.scale(dpr, dpr);

      initializeDots();
    };

    const initializeDots = () => {
      if (!canvas) return;
      const width = canvas.width / currentScale;
      const height = canvas.height / currentScale;

      dots = Array.from({ length: config.dots.count }, () => ({
        pos: {
          x: (Math.random() - 0.5) * width,
          y: (Math.random() - 0.5) * height,
          z: Math.random() * config.dots.maxZ,
        },
        vel: {
          x: (Math.random() - 0.5) * 0.2,
          y: (Math.random() - 0.5) * 0.2,
        },
        radius: Math.random() * 1.5 + 0.5,
        pulseProg: Math.random() * config.dots.pulseCounter,
        pulseVal: 0,
        hasPulse: Math.random() < config.dots.hasPulse,
        radiusMul: Math.random() * (1.5 - 0.5) + 0.5,
      }));

      blurDots = Array.from({ length: config.blurDots.count }, () => ({
        pos: {
          x: (Math.random() - 0.5) * width,
          y: (Math.random() - 0.5) * height,
          z: Math.random() * config.dots.maxZ,
        },
        vel: {
          x: (Math.random() - 0.5) * 0.1,
          y: (Math.random() - 0.5) * 0.1,
        },
        radiusMul: Math.random() * (1.5 - 0.5) + 0.5,
      }));
    };

    function drawDot(dot: Dot) {
      if (!ctx || !canvas) return;

      const width = canvas.width / currentScale;
      const height = canvas.height / currentScale;
      const projected = project(dot.pos.x, dot.pos.y, dot.pos.z);

      const centerX = width / 2 + projected.x;
      const centerY = height / 2 + projected.y;

      if (dot.hasPulse) {
        if (dot.pulseProg >= config.dots.pulseCounter) {
          dot.pulseVal += 0.3;
        }
        if (dot.pulseVal >= config.dots.pulseDist) {
          dot.pulseVal = 0;
          dot.pulseProg = 0;
        }
        dot.pulseProg += 1;

        const opacity =
          (1 - dot.pulseVal / config.dots.pulseDist) * projected.scale;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = config.dots.pulseWidth;
        ctx.arc(centerX, centerY, dot.pulseVal, 0, Math.PI * 2);
        ctx.stroke();
      }

      const rad = dot.radiusMul * config.dots.radius * (1 + projected.scale);
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * projected.scale})`;
      ctx.arc(centerX, centerY, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    function connectDots(dot1: Dot, dot2: Dot) {
      if (!ctx || !canvas) return;

      const width = canvas.width / currentScale;
      const height = canvas.height / currentScale;

      const proj1 = project(dot1.pos.x, dot1.pos.y, dot1.pos.z);
      const proj2 = project(dot2.pos.x, dot2.pos.y, dot2.pos.z);

      const x1 = width / 2 + proj1.x;
      const y1 = height / 2 + proj1.y;
      const x2 = width / 2 + proj2.x;
      const y2 = height / 2 + proj2.y;

      const dx = x1 - x2;
      const dy = y1 - y2;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= config.dots.distance) {
        const opacity =
          (1 - distance / config.dots.distance) *
          Math.min(proj1.scale, proj2.scale) *
          0.8;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = config.dots.lineWidth;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    function updatePosition(dot: Dot | BlurDot) {
      if (!canvas) return;

      const width = canvas.width / currentScale;
      const height = canvas.height / currentScale;

      dot.pos.z -= config.speed;

      if (dot.pos.z < config.dots.minZ) {
        dot.pos.z = config.dots.maxZ;
        dot.pos.x = (Math.random() - 0.5) * width;
        dot.pos.y = (Math.random() - 0.5) * height;
      }

      const t = noiseTime * 0.5;
      const scale = config.noiseVel * 0.1;

      const fx1 = Math.sin(t) * scale;
      const fx2 = Math.sin(t * 1.5) * scale * 0.5;
      const fy1 = Math.cos(t * 0.8) * scale;
      const fy2 = Math.cos(t * 1.2) * scale * 0.5;

      dot.vel.x += (fx1 + fx2) * 0.02;
      dot.vel.y += (fy1 + fy2) * 0.02;

      dot.vel.x *= 0.99;
      dot.vel.y *= 0.99;

      dot.pos.x += dot.vel.x;
      dot.pos.y += dot.vel.y;

      // Wrap around edges
      const buffer = 50;
      if (dot.pos.x < -width / 2 - buffer) dot.pos.x = width / 2 + buffer;
      if (dot.pos.x > width / 2 + buffer) dot.pos.x = -width / 2 - buffer;
      if (dot.pos.y < -height / 2 - buffer) dot.pos.y = height / 2 + buffer;
      if (dot.pos.y > height / 2 + buffer) dot.pos.y = -height / 2 - buffer;
    }

    function animate() {
      if (!ctx || !canvas) return;

      const width = canvas.width / currentScale;
      const height = canvas.height / currentScale;

      ctx.clearRect(0, 0, width, height);

      dots.forEach((dot, i) => {
        updatePosition(dot);
        dots.forEach((dot2, j) => {
          if (i !== j) {
            connectDots(dot, dot2);
          }
        });
        drawDot(dot);
      });

      noiseTime += config.noiseSpeed;
      animationFrameId = requestAnimationFrame(animate);
    }

    resizeCanvas();
    animate();

    const debouncedResize = debounce(resizeCanvas, 250);
    window.addEventListener("resize", debouncedResize);

    return () => {
      window.removeEventListener("resize", debouncedResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 h-full w-full bg-transparent"
    />
  );
}

function debounce(func: Function, wait: number) {
  let timeoutId: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeoutId);
      func(...args);
    };
    clearTimeout(timeoutId);
    timeoutId = setTimeout(later, wait);
  };
}
