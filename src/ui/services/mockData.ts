import type { Run, Encounter, Unit, BattleState, RunsSummary, EncountersSummary } from '../types';

// Mock data
export const mockRuns: Run[] = [
  {
    id: 'run-1',
    name: 'Test Run Alpha',
    seed: 'seed123',
    status: 'active',
    createdAt: '2025-10-15T10:00:00Z',
  },
  {
    id: 'run-2',
    name: 'Beta Campaign',
    seed: 'beta456',
    status: 'archived',
    createdAt: '2025-10-14T08:30:00Z',
  },
  {
    id: 'run-3',
    name: 'Gamma Expedition',
    seed: 'gamma789',
    status: 'active',
    createdAt: '2025-10-16T14:20:00Z',
  },
];

export const mockEncounters: Encounter[] = [
  {
    id: 'enc-1',
    runId: 'run-1',
    step: 1,
    choiceLabel: 'A',
    arenaSeed: 12345,
    result: 'win',
    createdAt: '2025-10-15T10:15:00Z',
  },
  {
    id: 'enc-2',
    runId: 'run-1',
    step: 2,
    choiceLabel: 'B',
    arenaSeed: 67890,
    result: 'loss',
    createdAt: '2025-10-15T10:30:00Z',
  },
  {
    id: 'enc-3',
    runId: 'run-2',
    step: 1,
    choiceLabel: 'C',
    arenaSeed: 11111,
    result: 'win',
    createdAt: '2025-10-14T08:45:00Z',
  },
];

export const mockUnits: Unit[] = [
  {
    id: 'unit-1',
    name: 'Hero',
    faction: 'party',
    hp: 100,
    hpMax: 100,
    mp: 50,
    mpMax: 50,
    x: 2,
    y: 3,
    color: '#2563eb',
    portrait: 'hero.png',
    alive: true,
  },
  {
    id: 'unit-2',
    name: 'Mage',
    faction: 'party',
    hp: 80,
    hpMax: 80,
    mp: 100,
    mpMax: 100,
    x: 3,
    y: 3,
    color: '#16a34a',
    portrait: 'mage.png',
    alive: true,
  },
  {
    id: 'unit-3',
    name: 'Goblin',
    faction: 'enemy',
    hp: 60,
    hpMax: 60,
    mp: 0,
    mpMax: 0,
    x: 1,
    y: 1,
    color: '#ef4444',
    portrait: 'goblin.png',
    alive: true,
  },
  {
    id: 'unit-4',
    name: 'Orc',
    faction: 'enemy',
    hp: 120,
    hpMax: 120,
    mp: 20,
    mpMax: 20,
    x: 0,
    y: 0,
    color: '#f59e0b',
    portrait: 'orc.png',
    alive: true,
  },
];

export const mockBattleState: BattleState = {
  gridW: 5,
  gridH: 5,
  party: mockUnits.filter(u => u.faction === 'party'),
  enemies: mockUnits.filter(u => u.faction === 'enemy'),
  activeId: 'unit-1',
};

export const mockRunsSummary: RunsSummary = {
  total: mockRuns.length,
  active: mockRuns.filter(r => r.status === 'active').length,
  archived: mockRuns.filter(r => r.status === 'archived').length,
};

export const mockEncountersSummary: EncountersSummary = {
  total: mockEncounters.length,
  wins: mockEncounters.filter(e => e.result === 'win').length,
  losses: mockEncounters.filter(e => e.result === 'loss').length,
};