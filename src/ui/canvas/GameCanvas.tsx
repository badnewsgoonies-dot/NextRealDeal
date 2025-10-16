/*
 * GameCanvas: DPR-aware canvas component with letterboxing
 */

import React, { useEffect, useRef } from 'react';

interface GameCanvasProps {
  virtualWidth: number;
  virtualHeight: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
  className?: string;
}

export function GameCanvas({
  virtualWidth,
  virtualHeight,
  draw,
  className = '',
}: GameCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resize(): void {
      if (!canvas || !container || !ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Calculate letterbox dimensions
      const aspectRatio = virtualWidth / virtualHeight;
      const containerAspect = containerWidth / containerHeight;

      let width: number, height: number;

      if (containerAspect > aspectRatio) {
        // Container wider - letterbox horizontally
        height = containerHeight;
        width = height * aspectRatio;
      } else {
        // Container taller - letterbox vertically
        width = containerWidth;
        height = width / aspectRatio;
      }

      // Set CSS size
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Set buffer size (with DPR)
      canvas.width = virtualWidth * dpr;
      canvas.height = virtualHeight * dpr;

      // Scale context
      ctx.scale(dpr, dpr);
      
      // Pixel-perfect rendering
      ctx.imageSmoothingEnabled = false;
    }

    // Initial size
    resize();

    // Resize observer
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    // Render loop
    function render(): void {
      if (!ctx) return;
      draw(ctx);
    }

    const rafId = requestAnimationFrame(function loop() {
      render();
      requestAnimationFrame(loop);
    });

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [virtualWidth, virtualHeight, draw]);

  return (
    <div ref={containerRef} className={`w-full h-full flex items-center justify-center ${className}`}>
      <canvas ref={canvasRef} />
    </div>
  );
}

