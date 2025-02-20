"use client";

import { useEffect, useRef } from "react";

interface Bullet {
  x: number;
  y: number;
  speed: number;
  isEnemy?: boolean;
}

interface Enemy {
  x: number;
  y: number;
  direction: number;
  type: number;
  lastShootTime: number;
}

interface Barrier {
  x: number;
  y: number;
  health: number;
  segments: boolean[][];
}

const config = {
  player: {
    width: 30,
    height: 20,
    color: "#00ff00",
    speed: 5,
    moveSpeed: 8, // Speed for keyboard movement
    shootInterval: 1000,
    bottomMargin: 40, // Moved ship closer to bottom
    lives: 3,
  },
  bullet: {
    width: 3,
    height: 10,
    color: "#00ff00",
    enemyColor: "#ff0000",
    speed: 7,
    enemySpeed: 4,
  },
  enemy: {
    width: 30,
    height: 30,
    color: "#ff0000",
    count: 8,
    speed: 1,
    rows: 2,
    spacing: 60,
    startY: 50, // Starting Y position for new waves
    shootInterval: 2000, // Time between shots
    shootChance: 0.02, // Chance to shoot per enemy per frame
  },
  barrier: {
    count: 4,
    width: 60,
    height: 40,
    color: "#00ff00",
    bottomMargin: 140, // Increased spacing between barriers and ship
    segments: [
      [true, true, true, true, true, true, true, true],
      [true, true, true, true, true, true, true, true],
      [true, true, true, false, false, true, true, true],
      [true, true, false, false, false, false, true, true],
      [true, false, false, false, false, false, false, true],
    ],
  },
};

// Space Invader shapes using points
const SHAPES = {
  player: [
    [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0],
  ],
  enemy1: [
    [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0],
  ],
  enemy2: [
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0],
    [0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0],
  ],
};

export function SpaceInvaders() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerXRef = useRef(0);
  const lastShootTimeRef = useRef(0);
  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const barriersRef = useRef<Barrier[]>([]);
  const animationFrameIdRef = useRef<number>();
  const keysRef = useRef<Set<string>>(new Set());
  const playerLivesRef = useRef(config.player.lives);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resizeCanvas() {
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      playerXRef.current = rect.width / 2;
      initializeGame();
    }

    function initializeGame() {
      initializeEnemies();
      initializeBarriers();
      playerLivesRef.current = config.player.lives;
    }

    function initializeBarriers() {
      if (!canvas) return;
      const barriers: Barrier[] = [];
      const totalWidth = config.barrier.count * config.barrier.width;
      const spacing = (canvas.width - totalWidth) / (config.barrier.count + 1);

      for (let i = 0; i < config.barrier.count; i++) {
        barriers.push({
          x: spacing + i * (config.barrier.width + spacing),
          y: canvas.height - config.barrier.bottomMargin,
          health: 100,
          segments: config.barrier.segments.map((row) => [...row]),
        });
      }
      barriersRef.current = barriers;
    }

    function initializeEnemies() {
      if (!canvas) return;
      const enemies: Enemy[] = [];
      const startX =
        (canvas.width - config.enemy.count * config.enemy.spacing) / 2;

      for (let row = 0; row < config.enemy.rows; row++) {
        for (let i = 0; i < config.enemy.count; i++) {
          enemies.push({
            x: startX + i * config.enemy.spacing,
            y: config.enemy.startY + row * config.enemy.spacing,
            direction: 1,
            type: (row % 2) + 1,
            lastShootTime: Date.now(),
          });
        }
      }
      enemiesRef.current = enemies;
    }

    function drawShape(
      shape: number[][],
      x: number,
      y: number,
      scale: number,
      color: string
    ) {
      const pixelSize = scale / shape[0].length;
      ctx.fillStyle = color;

      shape.forEach((row, i) => {
        row.forEach((pixel, j) => {
          if (pixel) {
            ctx.fillRect(
              x + j * pixelSize,
              y + i * pixelSize,
              pixelSize,
              pixelSize
            );
          }
        });
      });
    }

    function drawPlayer() {
      if (!canvas) return;
      const x = playerXRef.current - config.player.width / 2;
      const y =
        canvas.height - config.player.height - config.player.bottomMargin;
      drawShape(SHAPES.player, x, y, config.player.width, config.player.color);
    }

    function drawBarriers() {
      if (!ctx) return;
      ctx.fillStyle = config.barrier.color;

      barriersRef.current.forEach((barrier) => {
        const segmentWidth = config.barrier.width / barrier.segments[0].length;
        const segmentHeight = config.barrier.height / barrier.segments.length;

        barrier.segments.forEach((row, i) => {
          row.forEach((segment, j) => {
            if (segment) {
              ctx.fillRect(
                barrier.x + j * segmentWidth,
                barrier.y + i * segmentHeight,
                segmentWidth,
                segmentHeight
              );
            }
          });
        });
      });
    }

    function drawEnemies() {
      enemiesRef.current.forEach((enemy) => {
        const shape = enemy.type === 1 ? SHAPES.enemy1 : SHAPES.enemy2;
        drawShape(
          shape,
          enemy.x,
          enemy.y,
          config.enemy.width,
          config.enemy.color
        );
      });
    }

    function handleEnemyShooting() {
      enemiesRef.current.forEach((enemy) => {
        const now = Date.now();
        if (
          now - enemy.lastShootTime >= config.enemy.shootInterval &&
          Math.random() < config.enemy.shootChance
        ) {
          bulletsRef.current.push({
            x: enemy.x + config.enemy.width / 2,
            y: enemy.y + config.enemy.height,
            speed: config.bullet.enemySpeed,
            isEnemy: true,
          });
          enemy.lastShootTime = now;
        }
      });
    }

    function drawBullets() {
      if (!ctx) return;
      bulletsRef.current.forEach((bullet) => {
        ctx.fillStyle = bullet.isEnemy
          ? config.bullet.enemyColor
          : config.bullet.color;
        ctx.fillRect(
          bullet.x - config.bullet.width / 2,
          bullet.y,
          config.bullet.width,
          config.bullet.height
        );
      });
    }

    function updateBullets() {
      bulletsRef.current = bulletsRef.current.filter((bullet) => {
        bullet.y += bullet.isEnemy ? bullet.speed : -bullet.speed;
        return (
          bullet.y > -config.bullet.height && bullet.y < (canvas?.height || 0)
        );
      });
    }

    function updateEnemies() {
      let shouldChangeDirection = false;

      enemiesRef.current.forEach((enemy) => {
        enemy.x += config.enemy.speed * enemy.direction;

        if (enemy.x <= 0 || enemy.x + config.enemy.width >= canvas.width) {
          shouldChangeDirection = true;
        }
      });

      if (shouldChangeDirection) {
        enemiesRef.current.forEach((enemy) => {
          enemy.direction *= -1;
          enemy.y += 20;
        });
      }
    }

    function shoot() {
      if (!canvas) return;
      const now = Date.now();
      if (now - lastShootTimeRef.current >= config.player.shootInterval) {
        bulletsRef.current.push({
          x: playerXRef.current,
          y:
            canvas.height -
            config.player.height -
            config.player.bottomMargin -
            5,
          speed: config.bullet.speed,
        });
        lastShootTimeRef.current = now;
      }
    }

    function checkCollisions() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Check bullet collisions with barriers
      bulletsRef.current = bulletsRef.current.filter((bullet) => {
        let bulletSurvived = true;

        // Check barrier collisions
        barriersRef.current.forEach((barrier) => {
          const segmentWidth =
            config.barrier.width / barrier.segments[0].length;
          const segmentHeight = config.barrier.height / barrier.segments.length;

          const segX = Math.floor((bullet.x - barrier.x) / segmentWidth);
          const segY = Math.floor((bullet.y - barrier.y) / segmentHeight);

          if (
            segX >= 0 &&
            segX < barrier.segments[0].length &&
            segY >= 0 &&
            segY < barrier.segments.length &&
            barrier.segments[segY][segX]
          ) {
            barrier.segments[segY][segX] = false;
            bulletSurvived = false;
          }
        });

        // Check enemy collisions
        enemiesRef.current = enemiesRef.current.filter((enemy) => {
          if (
            !bullet.isEnemy &&
            bullet.x >= enemy.x &&
            bullet.x <= enemy.x + config.enemy.width &&
            bullet.y >= enemy.y &&
            bullet.y <= enemy.y + config.enemy.height
          ) {
            bulletSurvived = false;
            return false;
          }
          return true;
        });

        // Check player collision
        if (
          bullet.isEnemy &&
          bullet.x >= playerXRef.current - config.player.width / 2 &&
          bullet.x <= playerXRef.current + config.player.width / 2 &&
          bullet.y >=
            canvas.height - config.player.height - config.player.bottomMargin &&
          bullet.y <= canvas.height - config.player.bottomMargin
        ) {
          playerLivesRef.current--;
          bulletSurvived = false;

          if (playerLivesRef.current <= 0) {
            // Game Over - Reset game
            initializeGame();
          }
        }

        return bulletSurvived;
      });
    }

    function checkWaveComplete() {
      if (enemiesRef.current.length === 0) {
        // Start a new wave
        initializeEnemies();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      keysRef.current.add(e.key);
    }

    function handleKeyUp(e: KeyboardEvent) {
      keysRef.current.delete(e.key);
    }

    function updatePlayerPosition() {
      if (!canvas) return;

      // Handle keyboard movement
      if (keysRef.current.has("ArrowLeft")) {
        playerXRef.current = Math.max(
          config.player.width,
          playerXRef.current - config.player.moveSpeed
        );
      }
      if (keysRef.current.has("ArrowRight")) {
        playerXRef.current = Math.min(
          canvas.width - config.player.width,
          playerXRef.current + config.player.moveSpeed
        );
      }
    }

    function drawLives() {
      if (!ctx) return;
      ctx.fillStyle = config.player.color;
      ctx.font = "16px monospace";
      ctx.fillText(`Lives: ${playerLivesRef.current}`, 10, 20);
    }

    function animate() {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      updatePlayerPosition();
      drawPlayer();
      drawBarriers();
      drawBullets();
      drawEnemies();
      drawLives();

      updateBullets();
      updateEnemies();
      handleEnemyShooting();
      checkCollisions();
      checkWaveComplete();
      shoot();

      animationFrameIdRef.current = requestAnimationFrame(animate);
    }

    function handleMouseMove(e: MouseEvent) {
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;

      // Add padding to prevent getting too close to edges
      const padding = config.player.width;
      playerXRef.current = Math.max(padding, Math.min(rect.width - padding, x));
    }

    // Initialize
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    container.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      container.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
