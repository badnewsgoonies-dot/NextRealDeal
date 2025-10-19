import type { UnitView } from '../engine/EngineAdapter';

interface ActiveNum {
  id: number;
  unitId: string;
  value: number;
  t: number; // ms elapsed
  life: number; // ms total
  crit?: boolean;
}

export class DamageNumbers {
  private seq = 0;
  private items: ActiveNum[] = [];

  spawnForUnit(unit: UnitView, value: number, opts?: { crit?: boolean }) {
    this.items.push({ id: this.seq++, unitId: unit.id, value, t: 0, life: 1000, crit: opts?.crit });
  }

  update(dtMs: number) {
    for (const it of this.items) it.t += dtMs;
    this.items = this.items.filter(it => it.t < it.life);
  }

  draw(ctx: CanvasRenderingContext2D, getPos: (unitId: string) => { x: number; y: number } | undefined) {
    for (const it of this.items) {
      const p = getPos(it.unitId); if (!p) continue;
      const t = it.t / it.life; // 0..1
      const y = p.y - 64 - t * 40;
      const a = 1 - t;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = it.crit ? 'bold 28px system-ui, sans-serif' : 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'black'; ctx.lineWidth = 3; ctx.strokeText(String(it.value), p.x, y);
      ctx.fillStyle = it.crit ? '#f87171' : '#ffffff';
      ctx.fillText(String(it.value), p.x, y);
      ctx.restore();
    }
  }
}

