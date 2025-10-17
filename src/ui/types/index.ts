// UI Types for Route Runner

export interface Run {
  id: string;
  name: string;
  seed: string;
  status: 'active' | 'archived';
  createdAt: string; // ISO
}

export interface Encounter {
  id: string;
  runId: string;
  step: number;
  choiceLabel: 'A' | 'B' | 'C';
  arenaSeed: number;
  result: 'win' | 'loss';
  createdAt: string; // ISO
}

export interface Unit {
  id: string;
  name: string;
  faction: 'party' | 'enemy';
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  x: number;
  y: number;
  color: string;
  portrait: string;
  alive: boolean;
}

export interface BattleState {
  gridW: number;
  gridH: number;
  party: Unit[];
  enemies: Unit[];
  activeId: string;
}

// Additional types for UI
export interface RunsSummary {
  total: number;
  active: number;
  archived: number;
}

export interface EncountersSummary {
  total: number;
  wins: number;
  losses: number;
}

// Query params
export interface RunsQuery {
  search?: string;
  status?: 'all' | 'active' | 'archived';
  sortBy?: 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface EncountersQuery {
  runId?: string;
  seedSubstring?: string;
  result?: 'all' | 'win' | 'loss';
  sortBy?: 'createdAt' | 'step';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}