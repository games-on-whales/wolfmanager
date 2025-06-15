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
  iconType: 'computer' | 'server' | 'gamepad' | 'network' | 'arcade';
  pulsePhase: number;
  connections: Set<number>; // Use Set to prevent duplicate connections
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
  perspective: 800, // Reduced for more dramatic depth effect
  speed: 1.2, // Increased for tunnel motion
  cameraSpeed: 0.8, // Camera drift speed
  dots: {
    count: 35, // Optimized for performance
    radius: 2,
    pulseWidth: 1.5,
    lineWidth: 1.2,
    pulseCounter: 300,
    pulseDist: 35,
    distance: 180, // Increased for better connections
    color: "rgba(255, 255, 255, 0.9)",
    maxVel: 0.5,
    hasPulse: 0.7,
    minZ: -2500, // Start far in the distance (small)
    maxZ: 200, // End close to viewer (large)
  },
  blurDots: {
    count: 8,
    radius: 80,
    color: "rgba(0, 22, 51, 0.8)",
  },
};

function project(x: number, y: number, z: number) {
  // Reverse the projection for tunnel effect - nodes start small in center and grow outward
  const scale = config.perspective / (config.perspective - z);
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
    let cameraOffset = { x: 0, y: 0 };
    let tunnelProgress = 0;

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

      const iconTypes: Array<'computer' | 'server' | 'gamepad' | 'network' | 'arcade'> =
        ['computer', 'server', 'gamepad', 'network', 'arcade'];
      
      dots = Array.from({ length: config.dots.count }, () => ({
        pos: {
          x: (Math.random() - 0.5) * width,
          y: (Math.random() - 0.5) * height,
          z: config.dots.minZ + Math.random() * (config.dots.maxZ - config.dots.minZ),
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
        iconType: iconTypes[Math.floor(Math.random() * iconTypes.length)],
        pulsePhase: Math.random() * Math.PI * 2,
        connections: new Set<number>(),
      }));

      // Build balanced connection graph to prevent convergence
      // Track connection count per node to ensure even distribution
      const connectionCounts = new Array(dots.length).fill(0);
      const maxConnectionsPerNode = 3;
      
      dots.forEach((dot, i) => {
        dot.connections.clear();
      });
      
      // Create distributed connections
      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        
        if (connectionCounts[i] >= maxConnectionsPerNode) continue;
        
        // Find nearby dots that aren't overconnected
        const nearbyDots = dots
          .map((otherDot, j) => {
            if (i === j || connectionCounts[j] >= maxConnectionsPerNode) return null;
            if (dot.connections.has(j)) return null; // Already connected
            
            const dx = dot.pos.x - otherDot.pos.x;
            const dy = dot.pos.y - otherDot.pos.y;
            const dz = dot.pos.z - otherDot.pos.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            return { index: j, distance, dot: otherDot };
          })
          .filter((item): item is { index: number; distance: number; dot: Dot } =>
            item !== null && item.distance <= config.dots.distance
          )
          .sort((a, b) => a.distance - b.distance);
        
        // Connect to 1-2 nearest available nodes
        const connectionsToMake = Math.min(
          2,
          maxConnectionsPerNode - connectionCounts[i],
          nearbyDots.length
        );
        
        for (let k = 0; k < connectionsToMake; k++) {
          const target = nearbyDots[k];
          if (target && connectionCounts[target.index] < maxConnectionsPerNode) {
            // Create bidirectional connection
            dot.connections.add(target.index);
            dots[target.index].connections.add(i);
            connectionCounts[i]++;
            connectionCounts[target.index]++;
          }
        }
      }

      blurDots = Array.from({ length: config.blurDots.count }, () => ({
        pos: {
          x: (Math.random() - 0.5) * width,
          y: (Math.random() - 0.5) * height,
          z: config.dots.minZ + Math.random() * (config.dots.maxZ - config.dots.minZ),
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

      // Apply camera offset for tunnel motion
      const centerX = width / 2 + projected.x + cameraOffset.x;
      const centerY = height / 2 + projected.y + cameraOffset.y;

      // Update pulse phase for floating animation
      dot.pulsePhase += 0.02;

      // Subtle pulse effect for nodes with pulse enabled
      if (dot.hasPulse) {
        if (dot.pulseProg >= config.dots.pulseCounter) {
          dot.pulseVal += 0.3;
        }
        if (dot.pulseVal >= config.dots.pulseDist) {
          dot.pulseVal = 0;
          dot.pulseProg = 0;
        }
        dot.pulseProg += 1;

        const baseOpacity = (1 - dot.pulseVal / config.dots.pulseDist) * Math.min(projected.scale, 1.0);
        const opacity = baseOpacity * 0.6;
        
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0, 255, 255, ${opacity * 0.5})`;
        ctx.lineWidth = config.dots.pulseWidth;
        ctx.arc(centerX, centerY, dot.pulseVal * projected.scale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Calculate icon size with reversed parallax scaling for tunnel effect
      const baseSize = dot.iconType === 'server' ? 20 : 16;
      const sizeVariance = dot.radiusMul * 0.4;
      const floatOffset = Math.sin(dot.pulsePhase) * 1.5;
      // Reverse scaling: nodes start small (far) and grow large (near)
      const parallaxScale = Math.max(0.1, Math.min(2.0, projected.scale));
      const iconSize = (baseSize + sizeVariance) * parallaxScale;
      
      // Clean, subtle opacity with gentle breathing effect
      const pulseIntensity = 0.4 + Math.sin(dot.pulsePhase * 0.6) * 0.2;
      const baseOpacity = (0.6 + pulseIntensity * 0.3) * Math.max(0.2, Math.min(projected.scale, 1.0));
      const opacity = Math.min(baseOpacity, 0.9);

      // Clean glow effect
      if (opacity > 0.2) {
        ctx.save();
        ctx.shadowColor = `rgba(0, 255, 255, ${opacity * 0.4})`;
        ctx.shadowBlur = 8;
        drawTechIcon(ctx, dot.iconType, centerX, centerY + floatOffset, iconSize, opacity);
        ctx.restore();
      } else {
        drawTechIcon(ctx, dot.iconType, centerX, centerY + floatOffset, iconSize, opacity);
      }
    }

    function drawTechIcon(
      ctx: CanvasRenderingContext2D,
      iconType: string,
      x: number,
      y: number,
      size: number,
      opacity: number
    ) {
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.fillStyle = `rgba(0, 255, 255, ${opacity * 0.4})`;
      ctx.lineWidth = 1.8;

      const halfSize = size / 2;

      switch (iconType) {
        case 'computer':
          // Monitor/Laptop - inspired by Lucide Monitor icon
          // Main screen
          ctx.strokeRect(-halfSize * 0.9, -halfSize * 0.7, size * 0.9, size * 0.6);
          // Screen content (glowing effect)
          ctx.fillRect(-halfSize * 0.8, -halfSize * 0.6, size * 0.7, size * 0.4);
          // Stand base
          ctx.beginPath();
          ctx.moveTo(-halfSize * 0.4, halfSize * 0.1);
          ctx.lineTo(halfSize * 0.4, halfSize * 0.1);
          ctx.stroke();
          // Stand vertical
          ctx.beginPath();
          ctx.moveTo(0, -halfSize * 0.1);
          ctx.lineTo(0, halfSize * 0.1);
          ctx.stroke();
          // Power indicator
          ctx.beginPath();
          ctx.arc(halfSize * 0.6, -halfSize * 0.5, 1.5, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'server':
          // Server rack - inspired by Lucide Server icon
          // Main server body
          ctx.strokeRect(-halfSize, -halfSize * 0.8, size, size * 0.6);
          // Server slots
          for (let i = 0; i < 3; i++) {
            const yOffset = -halfSize * 0.6 + (i * size * 0.2);
            ctx.strokeRect(-halfSize * 0.9, yOffset, size * 0.8, size * 0.15);
            // LED status lights
            ctx.fillRect(-halfSize * 0.7, yOffset + size * 0.05, 2, 2);
            ctx.fillRect(-halfSize * 0.5, yOffset + size * 0.05, 2, 2);
            ctx.fillRect(-halfSize * 0.3, yOffset + size * 0.05, 2, 2);
          }
          // Ventilation grilles
          for (let i = 0; i < 4; i++) {
            const xOffset = -halfSize * 0.2 + (i * size * 0.1);
            ctx.beginPath();
            ctx.moveTo(xOffset, halfSize * 0.2);
            ctx.lineTo(xOffset, halfSize * 0.6);
            ctx.stroke();
          }
          break;

        case 'gamepad':
          // Game controller - inspired by Lucide Gamepad2 icon
          // Main controller body (rounded rectangle)
          ctx.beginPath();
          ctx.roundRect(-halfSize * 0.9, -halfSize * 0.5, size * 0.9, size * 0.7, 6);
          ctx.stroke();
          // D-pad (left side)
          ctx.strokeRect(-halfSize * 0.6, -halfSize * 0.1, size * 0.2, size * 0.05);
          ctx.strokeRect(-halfSize * 0.55, -halfSize * 0.2, size * 0.1, size * 0.25);
          // Action buttons (right side)
          ctx.beginPath();
          ctx.arc(halfSize * 0.4, -halfSize * 0.1, 3, 0, Math.PI * 2);
          ctx.arc(halfSize * 0.6, 0, 3, 0, Math.PI * 2);
          ctx.arc(halfSize * 0.4, halfSize * 0.1, 3, 0, Math.PI * 2);
          ctx.arc(halfSize * 0.2, 0, 3, 0, Math.PI * 2);
          ctx.stroke();
          // Shoulder buttons
          ctx.strokeRect(-halfSize * 0.9, -halfSize * 0.6, size * 0.2, size * 0.1);
          ctx.strokeRect(halfSize * 0.7, -halfSize * 0.6, size * 0.2, size * 0.1);
          break;

        case 'network':
          // Network/Wifi - inspired by Lucide Wifi icon
          // Central node
          ctx.beginPath();
          ctx.arc(0, 0, 3, 0, Math.PI * 2);
          ctx.fill();
          // Wifi signal arcs
          for (let i = 1; i <= 3; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, halfSize * 0.3 * i, -Math.PI * 0.6, -Math.PI * 0.4);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, halfSize * 0.3 * i, Math.PI * 0.4, Math.PI * 0.6);
            ctx.stroke();
          }
          // Connection nodes
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const nodeX = Math.cos(angle) * halfSize * 0.8;
            const nodeY = Math.sin(angle) * halfSize * 0.8;
            ctx.beginPath();
            ctx.arc(nodeX, nodeY, 2, 0, Math.PI * 2);
            ctx.fill();
            // Connection lines
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * 6, Math.sin(angle) * 6);
            ctx.lineTo(nodeX, nodeY);
            ctx.stroke();
          }
          break;

        case 'arcade':
          // Joystick - inspired by gaming joystick
          // Base platform
          ctx.strokeRect(-halfSize * 0.8, halfSize * 0.1, size * 0.8, size * 0.3);
          // Joystick shaft
          ctx.beginPath();
          ctx.moveTo(0, halfSize * 0.1);
          ctx.lineTo(halfSize * 0.3, -halfSize * 0.6);
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.lineWidth = 1.8;
          // Joystick ball/handle
          ctx.beginPath();
          ctx.arc(halfSize * 0.3, -halfSize * 0.6, 4, 0, Math.PI * 2);
          ctx.fill();
          // Base buttons
          ctx.beginPath();
          ctx.arc(-halfSize * 0.4, halfSize * 0.25, 2, 0, Math.PI * 2);
          ctx.arc(halfSize * 0.1, halfSize * 0.25, 2, 0, Math.PI * 2);
          ctx.fill();
          // Directional indicator
          ctx.beginPath();
          ctx.moveTo(halfSize * 0.2, -halfSize * 0.7);
          ctx.lineTo(halfSize * 0.4, -halfSize * 0.5);
          ctx.lineTo(halfSize * 0.4, -halfSize * 0.7);
          ctx.stroke();
          break;
      }

      ctx.restore();
    }


    function updatePosition(dot: Dot | BlurDot) {
      if (!canvas) return;

      const width = canvas.width / currentScale;
      const height = canvas.height / currentScale;

      // Enhanced tunnel motion - nodes flow from center outward (tunnel effect)
      const depthSpeedMultiplier = 1 + Math.abs(dot.pos.z / config.dots.minZ) * 0.5;
      dot.pos.z += config.speed * depthSpeedMultiplier;

      // Respawn nodes that have moved too close to the viewer
      if (dot.pos.z > config.dots.maxZ) {
        dot.pos.z = config.dots.minZ;
        
        // Create more random, distributed spawning instead of center clustering
        const spawnRadius = Math.random() * width * 0.4; // Random radius from center
        const spawnAngle = Math.random() * Math.PI * 2; // Random angle
        dot.pos.x = Math.cos(spawnAngle) * spawnRadius;
        dot.pos.y = Math.sin(spawnAngle) * spawnRadius;
        
        // Add some random variation to break patterns
        dot.pos.x += (Math.random() - 0.5) * width * 0.2;
        dot.pos.y += (Math.random() - 0.5) * height * 0.2;
        
      }

      // Enhanced noise-based movement with organic tunnel flow
      const t = noiseTime * 0.5;
      const scale = config.noiseVel * 0.15;
      const tunnelFlow = (dot.pos.z - config.dots.minZ) / (config.dots.maxZ - config.dots.minZ);

      // Create more organic, swirling motion instead of linear outward flow
      const fx1 = Math.sin(t + dot.pos.z * 0.001 + dot.pos.y * 0.0005) * scale;
      const fx2 = Math.sin(t * 1.3 + dot.pos.y * 0.003) * scale * 0.7;
      const fy1 = Math.cos(t * 0.9 + dot.pos.x * 0.003 + dot.pos.z * 0.0005) * scale;
      const fy2 = Math.cos(t * 1.1 + dot.pos.z * 0.002) * scale * 0.7;

      // Add subtle radial expansion with random variation instead of direct center push
      const radialAngle = Math.atan2(dot.pos.y, dot.pos.x);
      const radialVariation = Math.sin(t * 0.3 + radialAngle * 3) * 0.5 + 0.5; // 0 to 1
      const gentleExpansion = tunnelFlow * 0.015 * radialVariation;
      
      // Add swirling motion around the tunnel
      const swirl = tunnelFlow * 0.01;
      const swirlX = Math.cos(radialAngle + t * 0.2) * swirl;
      const swirlY = Math.sin(radialAngle + t * 0.2) * swirl;
      
      const expansionX = Math.cos(radialAngle) * gentleExpansion;
      const expansionY = Math.sin(radialAngle) * gentleExpansion;

      dot.vel.x += (fx1 + fx2 + expansionX + swirlX) * 0.025;
      dot.vel.y += (fy1 + fy2 + expansionY + swirlY) * 0.025;

      dot.vel.x *= 0.98; // Slightly more damping for smoother motion
      dot.vel.y *= 0.98;

      dot.pos.x += dot.vel.x;
      dot.pos.y += dot.vel.y;

      // Enhanced edge wrapping with tunnel effect
      const buffer = 100; // Larger buffer for tunnel effect
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

      // Update tunnel progress and camera motion
      tunnelProgress += 0.01;
      cameraOffset.x = Math.sin(tunnelProgress * config.cameraSpeed) * 5;
      cameraOffset.y = Math.cos(tunnelProgress * config.cameraSpeed * 0.7) * 3;

      // Update and draw dots with constellation connections
      dots.forEach((dot, i) => {
        updatePosition(dot);
        
        // Draw constellation connections using the connection graph
        // Only draw each connection once by checking if current index is smaller
        dot.connections.forEach(connectionIndex => {
          if (i < connectionIndex) { // Only draw once per connection pair
            const connectedDot = dots[connectionIndex];
            if (connectedDot) {
              const proj1 = project(dot.pos.x, dot.pos.y, dot.pos.z);
              const proj2 = project(connectedDot.pos.x, connectedDot.pos.y, connectedDot.pos.z);
              
              const width = canvas.width / currentScale;
              const height = canvas.height / currentScale;
              
              const x1 = width / 2 + proj1.x + cameraOffset.x;
              const y1 = height / 2 + proj1.y + cameraOffset.y;
              const x2 = width / 2 + proj2.x + cameraOffset.x;
              const y2 = height / 2 + proj2.y + cameraOffset.y;
              
              const screenDistance = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
              
              // Draw connection if both nodes are visible and not too close
              if (screenDistance > 20 && screenDistance < 350) {
                const baseOpacity = Math.max(0.1, Math.min(proj1.scale, proj2.scale)) * 0.3;
                const opacity = Math.min(baseOpacity, 0.6);
                
                if (opacity > 0.05) {
                  ctx.save();
                  
                  // Create subtle gradient for clean tech appearance
                  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                  gradient.addColorStop(0, `rgba(0, 255, 255, ${opacity * 0.8})`);
                  gradient.addColorStop(0.5, `rgba(255, 255, 255, ${opacity * 0.6})`);
                  gradient.addColorStop(1, `rgba(0, 255, 255, ${opacity * 0.8})`);
                  
                  ctx.strokeStyle = gradient;
                  ctx.lineWidth = 0.8;
                  
                  // Subtle glow effect
                  ctx.shadowColor = `rgba(0, 255, 255, ${opacity * 0.3})`;
                  ctx.shadowBlur = 2;
                  
                  ctx.beginPath();
                  ctx.moveTo(x1, y1);
                  ctx.lineTo(x2, y2);
                  ctx.stroke();
                  ctx.restore();
                }
              }
            }
          }
        });
        
        drawDot(dot);
      });

      // Update blur dots for background depth
      blurDots.forEach(blurDot => {
        updatePosition(blurDot);
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
