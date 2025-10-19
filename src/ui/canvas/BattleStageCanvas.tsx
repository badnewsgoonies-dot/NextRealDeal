import React from 'react';
import { GameCanvas } from './GameCanvas';
import type { BattleState, UnitView } from '../engine/EngineAdapter';
import { DamageNumbers } from '../effects/DamageNumbers';

export interface BattleStageCanvasProps {
  state: BattleState;
  damageNumbers: DamageNumbers;
  highlightIds?: { activeId?: string; focusId?: string };
}

// Fixed formations: 1–4 party left, up to 6 enemies right
function layoutPositions(units: UnitView[], side: 'left' | 'right', w: number, h: number) {
  const baseY = h * 0.65;
  const spacingY = 64;
  const colX = side === 'left' ? w * 0.28 : w * 0.72;
  return units.map((u, i) => ({ id: u.id, x: colX + (Math.sin(i) * 8), y: baseY - i * spacingY }));
}

export function BattleStageCanvas({ state, damageNumbers, highlightIds }: BattleStageCanvasProps): JSX.Element {
  const points = React.useMemo(() => {
    const p = layoutPositions(state.party, 'left', 1280, 720);
    const e = layoutPositions(state.enemies, 'right', 1280, 720);
    const dict = new Map<string, { x: number; y: number }>();
    [...p, ...e].forEach(v => dict.set(v.id, { x: v.x, y: v.y }));
    return { dict, p, e };
  }, [state.party, state.enemies]);

  const draw = React.useCallback((ctx: CanvasRenderingContext2D, dt: number, w: number, h: number) => {
    // Background
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0c1224');
    g.addColorStop(1, '#161b2e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // Ground
    ctx.fillStyle = '#1c233a';
    ctx.fillRect(0, h * 0.62, w, h * 0.38);

    // Draw units
    const drawUnit = (u: UnitView) => {
      const pos = points.dict.get(u.id)!;
      const isActive = highlightIds?.activeId === u.id;
      const isFocus = highlightIds?.focusId === u.id;
      const fill = u.team === 'player' ? '#4aa3ff' : '#ef4444';
      const size = 64;

      // shadow
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y + size * 0.52, size * 0.6, size * 0.25, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#000'; ctx.fill();
      ctx.restore();

      // body or sprite
      if (u.spriteUrl) {
        // (Optional) sprite support left for user to plug in
        ctx.fillStyle = fill; ctx.fillRect(pos.x - size / 2, pos.y - size, size, size);
      } else {
        ctx.fillStyle = fill; ctx.fillRect(pos.x - size / 2, pos.y - size, size, size);
      }

      // outlines
      if (isActive || isFocus) {
        ctx.lineWidth = isActive ? 4 : 3;
        ctx.strokeStyle = isActive ? '#fff176' : '#facc15';
        ctx.strokeRect(pos.x - size / 2 - 2, pos.y - size - 2, size + 4, size + 4);
      }

      // HP bar only for active + focused (minimal overlays)
      if (isActive || isFocus) {
        const hpPct = Math.max(0, Math.min(1, u.hp / u.hpMax));
        const barW = size, barH = 8;
        ctx.fillStyle = '#222';
        ctx.fillRect(pos.x - barW / 2, pos.y - size - 12, barW, barH);
        ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#eab308' : '#ef4444';
        ctx.fillRect(pos.x - barW / 2, pos.y - size - 12, barW * hpPct, barH);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(pos.x - barW / 2, pos.y - size - 12, barW, barH);
      }
    };

    state.enemies.forEach(drawUnit);
    state.party.forEach(drawUnit);

    // Damage numbers
    damageNumbers.update(dt);
    damageNumbers.draw(ctx, (unitId) => points.dict.get(unitId) || { x: 0, y: 0 });
  }, [damageNumbers, points.dict, state.party, state.enemies, highlightIds]);

  return <GameCanvas onFrame={draw} />;
}

