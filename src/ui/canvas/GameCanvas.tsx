import React from 'react';

interface GameCanvasProps {
  width?: number;   // logical width
  height?: number;  // logical height
  onFrame: (ctx: CanvasRenderingContext2D, dtMs: number, w: number, h: number) => void;
}

export function GameCanvas({ width = 1280, height = 720, onFrame }: GameCanvasProps): JSX.Element {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  const last = React.useRef<number>(performance.now());

  React.useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d', { alpha: true })!;

    function resize() {
      const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in logical units
      ctx.imageSmoothingEnabled = false;
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    function loop(t: number) {
      const dt = t - last.current; last.current = t;
      onFrame(ctx, dt, width, height);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [onFrame, width, height]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
      <canvas ref={ref} style={{ maxWidth: '100%', maxHeight: '100%' }} />
    </div>
  );
}
