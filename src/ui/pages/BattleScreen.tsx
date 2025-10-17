import React, { useState } from 'react';
import { IsometricStage } from '../components/battle/IsometricStage';
import { StatusHud } from '../components/battle/StatusHud';
import { EnemyList } from '../components/battle/EnemyList';
import { PartyMini } from '../components/battle/PartyMini';
import { CommandMenu } from '../components/battle/CommandMenu';
import { useBattle } from '../hooks/useBattle';
import { useToast } from '../components/common/Toast';
import { Loading, Error } from '../components/common/States';
import type { Unit } from '../types';

export function BattleScreen() {
  const { data: battleState, loading, error, refetch } = useBattle();
  const { addToast } = useToast();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [targetingMode, setTargetingMode] = useState(false);

  const handleUnitClick = React.useCallback((unit: Unit) => {
    if (targetingMode && unit.faction === 'enemy' && unit.alive) {
      // Attack the enemy
      const damage = 30;
      unit.hp = Math.max(0, unit.hp - damage);
      if (unit.hp === 0) unit.alive = false;
      addToast(`Attacked ${unit.name} for ${damage}!`, 'success');
      setTargetingMode(false);
      setSelectedId(undefined);
    } else {
      setSelectedId(unit.id);
    }
  }, [targetingMode, addToast]);

  const handleCommand = React.useCallback((command: 'attack' | 'spells' | 'items' | 'defend') => {
    switch (command) {
      case 'attack':
        setTargetingMode(true);
        addToast('Select a target (use mouse or keyboard)', 'info');
        break;
      case 'spells':
        addToast('Spells not implemented yet', 'info');
        break;
      case 'items':
        addToast('Items not implemented yet', 'info');
        break;
      case 'defend':
        addToast('Defended!', 'success');
        break;
    }
  }, [addToast]);

  // Keyboard handling for targeting
  React.useEffect(() => {
    if (!battleState) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!targetingMode) return;

      const livingEnemies = battleState.enemies.filter(e => e.alive);
      if (livingEnemies.length === 0) return;

      const currentIndex = selectedId ? livingEnemies.findIndex(e => e.id === selectedId) : -1;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const newIndex = currentIndex > 0 ? currentIndex - 1 : livingEnemies.length - 1;
        setSelectedId(livingEnemies[newIndex].id);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex = currentIndex < livingEnemies.length - 1 ? currentIndex + 1 : 0;
        setSelectedId(livingEnemies[newIndex].id);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedId) {
          const target = livingEnemies.find(e => e.id === selectedId);
          if (target) handleUnitClick(target);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setTargetingMode(false);
        setSelectedId(undefined);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [targetingMode, selectedId, battleState, handleUnitClick]);

  // Early returns AFTER all hooks
  if (loading) return <Loading message="Loading battle..." />;
  if (error) return <Error message={error} onRetry={refetch} />;
  if (!battleState) return <Error message="No battle data" />;

  const activeUnit = battleState.party.find(u => u.id === battleState.activeId) ||
                     battleState.enemies.find(u => u.id === battleState.activeId);

  return (
    <div className="relative w-full min-h-[calc(100vh-4rem)] bg-gray-900">
      {/* Top-left: Enemy List */}
      <div className="absolute top-4 left-4 z-10">
        <EnemyList enemies={battleState.enemies} />
      </div>

      {/* Top-right: Party Mini */}
      <div className="absolute top-4 right-4 z-10">
        <PartyMini party={battleState.party} />
      </div>

      {/* Center: Isometric Stage */}
      <div className="absolute inset-0 flex items-center justify-center">
        <IsometricStage
          gridW={battleState.gridW}
          gridH={battleState.gridH}
          units={[...battleState.party, ...battleState.enemies]}
          selectedId={selectedId}
          onUnitClick={handleUnitClick}
        />
      </div>

      {/* Bottom-left: Status HUD */}
      {activeUnit && (
        <div className="absolute bottom-4 left-4 z-10">
          <StatusHud unit={activeUnit} />
        </div>
      )}

      {/* Bottom-right: Command Menu */}
      <div className="absolute bottom-4 right-4 z-10">
        <CommandMenu onCommand={handleCommand} disabled={targetingMode} />
      </div>

      {/* Targeting instructions */}
      {targetingMode && (
        <div className="pointer-events-none select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white px-4 py-2 rounded-md z-20">
          Select target with mouse or use ←/→ to cycle, Enter to confirm, Esc to cancel
        </div>
      )}
    </div>
  );
}