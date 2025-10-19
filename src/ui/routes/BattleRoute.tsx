import React from 'react';
import type { IEngineAdapter, BattleState, ActionDef, UnitView, TranscriptEvent } from '../engine/EngineAdapter';
import { BattleStageCanvas } from '../canvas/BattleStageCanvas';
import { ActionMenu } from '../components/ActionMenu';
import { TargetList } from '../components/TargetList';
import { PartyPanel } from '../components/PartyPanel';
import { CombatLog } from '../components/CombatLog';
import { useMenuInput } from '../hooks/useMenuInput';
import { DamageNumbers } from '../effects/DamageNumbers';

export type Phase = 'loading' | 'selectAction' | 'selectTarget' | 'resolving' | 'results';

export interface BattleRouteProps {
  adapter: IEngineAdapter;
  params?: Record<string, string>; // optional URL/query params
}

export function BattleRoute({ adapter, params }: BattleRouteProps): JSX.Element {
  const [phase, setPhase] = React.useState<Phase>('loading');
  const [state, setState] = React.useState<BattleState | null>(null);
  const [actions, setActions] = React.useState<ActionDef[]>([]);
  const [selectedAction, setSelectedAction] = React.useState<ActionDef | null>(null);
  const [selectedTargetId, setSelectedTargetId] = React.useState<string | undefined>();
  const [log, setLog] = React.useState<string[]>([]);
  const [victory, setVictory] = React.useState(false);

  // effects system (damage numbers)
  const numbersRef = React.useRef(new DamageNumbers());

  // Load initial battle snapshot
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const s = await adapter.getInitialBattleState(params);
      if (!mounted) return;
      setState(s);
      if (s.activeUnitId) setActions(await adapter.getActionsFor(s.activeUnitId));
      setPhase('selectAction');
    })();
    return () => { mounted = false; };
  }, [adapter, params]);

  // Helpers
  const livingEnemies = React.useMemo(() => state?.enemies.filter(e => e.alive) ?? [], [state]);
  const livingParty = React.useMemo(() => state?.party.filter(p => p.alive) ?? [], [state]);

  // Menu keyboard helpers
  useMenuInput({
    enabled: phase === 'selectAction' || phase === 'selectTarget',
    onCancel: () => {
      if (phase === 'selectTarget') { setSelectedTargetId(undefined); setPhase('selectAction'); }
    },
  });

  function appendLogFromEvents(events: TranscriptEvent[]) {
    const lines: string[] = [];
    for (const ev of events) {
      if (ev.kind === 'damage') lines.push(`−${ev.amount}`);
      else if (ev.kind === 'defeat') lines.push(`Defeat: ${ev.targetId}`);
      else if (ev.kind === 'log') lines.push(ev.message);
      else if (ev.kind === 'flee') lines.push(ev.success ? 'Flee succeeded' : 'Flee failed');
    }
    setLog(prev => [...prev, ...lines].slice(-80));
  }

  function spawnNumbersFromEvents(events: TranscriptEvent[], units: UnitView[]) {
    for (const ev of events) {
      if (ev.kind === 'damage') {
        const u = units.find(x => x.id === ev.targetId);
        if (u) numbersRef.current.spawnForUnit(u, ev.amount, { crit: !!ev.crit });
      }
    }
  }

  // Action selection
  const handleChooseAction = async (action: ActionDef) => {
    if (!state?.activeUnitId) return;
    if (action.target === 'enemyOne' || action.target === 'allyOne') {
      setSelectedAction(action);
      setPhase('selectTarget');
      // preselect first valid target
      const pool = action.target.startsWith('enemy') ? livingEnemies : livingParty;
      setSelectedTargetId(pool[0]?.id);
      return;
    }
    // no target needed
    await handleExecute(action, []);
  };

  // Target selection
  const handleChooseTarget = async (targetId: string) => {
    if (!selectedAction) return;
    await handleExecute(selectedAction, [targetId]);
  };

  // Execute
  const handleExecute = async (action: ActionDef, targetIds: string[]) => {
    if (!state?.activeUnitId) return;
    setPhase('resolving');
    const res = await adapter.executeAction(action.id, state.activeUnitId, targetIds);
    spawnNumbersFromEvents(res.events, [...res.state.party, ...res.state.enemies]);
    appendLogFromEvents(res.events);
    setState(res.state);
    setSelectedAction(null);
    setSelectedTargetId(undefined);

    const allDead = res.state.enemies.every(e => !e.alive);
    if (allDead) {
      setVictory(true);
      setPhase('results');
      await adapter.completeBattle(res.state);
    } else {
      if (res.state.activeUnitId) setActions(await adapter.getActionsFor(res.state.activeUnitId));
      setPhase('selectAction');
    }
  };

  if (!state) return <div className="w-full h-full grid place-items-center text-white">Loading…</div>;

  // UI layout
  return (
    <div className="relative w-full h-full bg-[#0b1220] text-[var(--text-primary,white)] overflow-hidden">
      {/* Stage */}
      <div className="absolute inset-0">
        <BattleStageCanvas
          state={state}
          damageNumbers={numbersRef.current}
          highlightIds={{ activeId: state.activeUnitId, focusId: selectedTargetId }}
        />
      </div>

      {/* Left: party */}
      <div className="absolute left-4 top-4 z-10 max-w-[20rem]">
        <PartyPanel title="Party" units={state.party} />
      </div>

      {/* Right: log */}
      <div className="absolute right-4 top-4 z-10 w-[22rem] max-h-[40vh]">
        <CombatLog lines={log} />
      </div>

      {/* Bottom: action or target menu */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        {phase === 'selectAction' && (
          <ActionMenu actions={actions} onChoose={handleChooseAction} />
        )}
        {phase === 'selectTarget' && (
          <TargetList
            units={selectedAction?.target?.startsWith('enemy') ? livingEnemies : livingParty}
            selectedId={selectedTargetId}
            onSelect={setSelectedTargetId}
            onConfirm={() => selectedTargetId && handleChooseTarget(selectedTargetId)}
            onCancel={() => { setSelectedTargetId(undefined); setPhase('selectAction'); }}
          />
        )}
      </div>

      {/* Top center: tiny turn pill */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur">
        TURN {state.turn}
      </div>

      {/* Victory overlay */}
      {victory && (
        <div className="absolute inset-0 grid place-items-center bg-black/50 z-20">
          <div className="px-8 py-6 rounded-xl border border-white/20 bg-black/60 text-2xl">Victory!</div>
        </div>
      )}
    </div>
  );
}

