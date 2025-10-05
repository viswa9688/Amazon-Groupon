import { useEffect, useRef, useState } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface Ant {
  pathIndex: number;
  progress: number;
  speed: number;
}

export default function AntNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const animationRef = useRef<number>();
  const nodesRef = useRef<Node[]>([]);
  const antsRef = useRef<Ant[]>([]);
  const pathsRef = useRef<[number, number][]>([]);

  useEffect(() => {
    const updateDimensions = () => {
      const container = canvasRef.current?.parentElement;
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: Math.min(600, container.clientWidth * 0.6),
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = dimensions;

    // Initialize nodes
    const nodeCount = 8;
    if (nodesRef.current.length === 0) {
      nodesRef.current = Array.from({ length: nodeCount }, (_, i) => {
        const angle = (i / nodeCount) * Math.PI * 2;
        const radius = Math.min(width, height) * 0.35;
        return {
          x: width / 2 + Math.cos(angle) * radius,
          y: height / 2 + Math.sin(angle) * radius,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: 8,
        };
      });
    } else {
      // Update node positions for new dimensions
      nodesRef.current.forEach((node, i) => {
        const angle = (i / nodeCount) * Math.PI * 2;
        const radius = Math.min(width, height) * 0.35;
        node.x = width / 2 + Math.cos(angle) * radius;
        node.y = height / 2 + Math.sin(angle) * radius;
      });
    }

    // Initialize paths (connections between nodes)
    if (pathsRef.current.length === 0) {
      pathsRef.current = [];
      for (let i = 0; i < nodeCount; i++) {
        // Connect to next node
        pathsRef.current.push([i, (i + 1) % nodeCount]);
        // Connect to node across (if even number)
        if (i < nodeCount / 2) {
          pathsRef.current.push([i, i + nodeCount / 2]);
        }
      }
    }

    // Initialize ants
    if (antsRef.current.length === 0) {
      antsRef.current = Array.from({ length: 15 }, () => ({
        pathIndex: Math.floor(Math.random() * pathsRef.current.length),
        progress: Math.random(),
        speed: 0.002 + Math.random() * 0.003,
      }));
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Update and draw nodes with gentle floating
      nodesRef.current.forEach((node) => {
        // Gentle floating movement
        node.x += node.vx;
        node.y += node.vy;

        // Bounce off edges with damping
        const margin = 50;
        if (node.x < margin || node.x > width - margin) {
          node.vx *= -0.8;
          node.x = Math.max(margin, Math.min(width - margin, node.x));
        }
        if (node.y < margin || node.y > height - margin) {
          node.vy *= -0.8;
          node.y = Math.max(margin, Math.min(height - margin, node.y));
        }

        // Add some randomness to movement
        node.vx += (Math.random() - 0.5) * 0.1;
        node.vy += (Math.random() - 0.5) * 0.1;

        // Damping
        node.vx *= 0.95;
        node.vy *= 0.95;

        // Draw node with glow
        const gradient = ctx.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          node.radius * 2
        );
        gradient.addColorStop(0, "rgba(211, 47, 47, 0.8)");
        gradient.addColorStop(0.5, "rgba(211, 47, 47, 0.4)");
        gradient.addColorStop(1, "rgba(211, 47, 47, 0)");

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#D32F2F";
        ctx.fill();
      });

      // Draw paths
      pathsRef.current.forEach(([startIdx, endIdx]) => {
        const start = nodesRef.current[startIdx];
        const end = nodesRef.current[endIdx];

        const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
        gradient.addColorStop(0, "rgba(211, 47, 47, 0.3)");
        gradient.addColorStop(0.5, "rgba(211, 47, 47, 0.15)");
        gradient.addColorStop(1, "rgba(211, 47, 47, 0.3)");

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // Update and draw ants
      antsRef.current.forEach((ant) => {
        ant.progress += ant.speed;

        // Move to next path when reaching end
        if (ant.progress >= 1) {
          ant.progress = 0;
          ant.pathIndex = Math.floor(Math.random() * pathsRef.current.length);
        }

        const [startIdx, endIdx] = pathsRef.current[ant.pathIndex];
        const start = nodesRef.current[startIdx];
        const end = nodesRef.current[endIdx];

        // Calculate ant position
        const x = start.x + (end.x - start.x) * ant.progress;
        const y = start.y + (end.y - start.y) * ant.progress;

        // Draw ant with glow
        const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, 8);
        glowGradient.addColorStop(0, "rgba(211, 47, 47, 0.6)");
        glowGradient.addColorStop(1, "rgba(211, 47, 47, 0)");

        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = glowGradient;
        ctx.fill();

        // Draw ant body
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#FF5252";
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dimensions]);

  return (
    <div className="w-full rounded-xl overflow-hidden bg-gradient-to-br from-red-50/50 to-orange-50/50 dark:from-gray-900/50 dark:to-gray-800/50 border-2 border-red-100 dark:border-red-900 shadow-lg">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-auto"
      />
      <div className="p-4 text-center">
        <p className="text-sm text-muted-foreground italic">
          Watch how our community connects—just like ants in a thriving colony
        </p>
      </div>
    </div>
  );
}
