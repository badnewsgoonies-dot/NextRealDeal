// Minimal contracts the UI needs. Map your engine to these — nothing else required.

export type Team = 'player' | 'enemy';

export interface UnitView {
  id: string;
  name: string;
  team: Team;
  hp: number;
  hpMax: number;
  mp?: number;
  mpMax?: number;
  status?: string[];
  alive: boolean;
  portraitUrl?: string;  // optional for PartyPanel
  spriteUrl?: string;    // optional for stage
}

export type TargetKind = 'enemyOne' | 'enemyAll' | 'allyOne' | 'allyAll' | 'self';
export type ActionId = 'attack' | 'skill' | 'item' | 'defend' | 'flee' | (string & {});

export interface ActionDef {
  id: ActionId;
  name: string;
  target: TargetKind;
  mpCost?: number;
}

export type TranscriptEvent =
  | { kind: 'damage'; sourceId: string; targetId: string; amount: number; crit?: boolean }
  | { kind: 'heal'; sourceId: string; targetId: string; amount: number }
  | { kind: 'miss'; sourceId: string; targetId: string }
  | { kind: 'status'; targetId: string; apply: string }
  | { kind: 'defeat'; targetId: string }
  | { kind: 'flee'; success: boolean }
  | { kind: 'log'; message: string };

export interface BattleState {
  runId: string;
  step: number;
  turn: number;
  activeUnitId?: string;
  party: UnitView[];
  enemies: UnitView[];
}

export interface IEngineAdapter {
  /** Provide initial snapshot (party/enemies/turn/etc). `params` can be URL/query data if you use it. */
  getInitialBattleState(params?: Record<string, string>): Promise<BattleState>;

  /** Actions available for a unit (at minimum return Attack/Defend/Flee). */
  getActionsFor(unitId: string): Promise<ActionDef[]>;

  /** Execute an action; return transcript + next state snapshot. */
  executeAction(
    actionId: ActionId,
    sourceId: string,
    targetIds: string[],
  ): Promise<{ events: TranscriptEvent[]; state: BattleState }>;

  /** Optional: finalize/award loot. No-op by default. */
  completeBattle(state: BattleState): Promise<void>;
}

/**
 * A tiny default adapter (useful for local testing). Replace with your engine.
 */
export class DummyAdapter implements IEngineAdapter {
  private state: BattleState = {
    runId: 'run-local',
    step: 1,
    turn: 1,
    party: [
      { id: 'p1', name: 'Warrior', team: 'player', hp: 120, hpMax: 120, alive: true },
      { id: 'p2', name: 'Mage', team: 'player', hp: 80, hpMax: 80, mp: 40, mpMax: 40, alive: true },
      { id: 'p3', name: 'Rogue', team: 'player', hp: 90, hpMax: 90, alive: true },
    ],
    enemies: [
      { id: 'e1', name: 'Goblin', team: 'enemy', hp: 70, hpMax: 70, alive: true },
      { id: 'e2', name: 'Slime', team: 'enemy', hp: 50, hpMax: 50, alive: true },
      { id: 'e3', name: 'Bat', team: 'enemy', hp: 40, hpMax: 40, alive: true },
    ],
  };

  async getInitialBattleState(): Promise<BattleState> {
    this.state.activeUnitId = this.state.party[0]?.id;
    return structuredClone(this.state);
  }

  async getActionsFor(): Promise<ActionDef[]> {
    return [
      { id: 'attack', name: 'Attack', target: 'enemyOne' },
      { id: 'skill', name: 'Skill', target: 'enemyOne', mpCost: 5 },
      { id: 'defend', name: 'Defend', target: 'self' },
      { id: 'flee', name: 'Flee', target: 'self' },
    ];
  }

  async executeAction(actionId: ActionId, sourceId: string, targetIds: string[]) {
    const events: TranscriptEvent[] = [];
    const s = this.state;
    const find = (id: string) => [...s.party, ...s.enemies].find(u => u.id === id)!;

    if (actionId === 'attack' || actionId === 'skill') {
      const src = find(sourceId);
      const tgt = find(targetIds[0]);
      if (!src || !tgt || !tgt.alive) return { events, state: structuredClone(s) };
      const base = actionId === 'skill' ? 26 : 18;
      const amount = Math.max(1, Math.floor(base + Math.random() * 8));
      tgt.hp = Math.max(0, tgt.hp - amount);
      if (tgt.hp === 0) { tgt.alive = false; events.push({ kind: 'defeat', targetId: tgt.id }); }
      events.unshift({ kind: 'damage', sourceId, targetId: tgt.id, amount, crit: Math.random() < 0.15 });
      events.push({ kind: 'log', message: `${src.name} hits ${tgt.name} for ${amount}` });
    } else if (actionId === 'defend') {
      events.push({ kind: 'log', message: `${find(sourceId).name} defends` });
    } else if (actionId === 'flee') {
      const success = Math.random() < 0.3;
      events.push({ kind: 'flee', success });
    }

    // simple next active (round-robin over living party)
    const living = s.party.filter(u => u.alive);
    const idx = living.findIndex(u => u.id === s.activeUnitId);
    s.activeUnitId = living[(idx + 1) % Math.max(1, living.length)]?.id;
    s.turn += 1;
    return { events, state: structuredClone(s) };
  }

  async completeBattle(): Promise<void> { /* no-op */ }
}

