/*
 * useRafLoop: Fixed-step RAF loop hook
 */

import { useEffect, useRef } from 'react';

const FIXED_DT = 1 / 60; // 16.67ms
const MAX_CATCHUP = 0.25; // 250ms

interface RafLoopOptions {
  onUpdate: (dt: number) => void;
  paused?: boolean;
}

export function useRafLoop({ onUpdate, paused = false }: RafLoopOptions): void {
  const rafRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);

  useEffect(() => {
    if (paused) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = undefined;
      }
      return;
    }

    let active = true;

    function loop(time: number): void {
      if (!active) return;

      const dt = lastTimeRef.current === 0 
        ? 0 
        : Math.min((time - lastTimeRef.current) / 1000, MAX_CATCHUP);
      
      lastTimeRef.current = time;
      accumulatorRef.current += dt;

      // Fixed-step updates
      while (accumulatorRef.current >= FIXED_DT) {
        onUpdate(FIXED_DT);
        accumulatorRef.current -= FIXED_DT;
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      active = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [onUpdate, paused]);
}

