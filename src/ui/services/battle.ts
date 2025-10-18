import { mockBattleState } from './mockData';
import type { BattleState } from '../types';

// Simulate latency
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Simulate occasional failures (Math.random allowed in mock services)
// eslint-disable-next-line no-restricted-properties
const maybeFail = (): boolean => Math.random() < 0.1; // 10% failure rate

export async function makeMockBattle(_seed?: string): Promise<BattleState> {
  await delay(300);
  if (maybeFail()) throw new Error('Failed to generate battle');

  // For simplicity, return the mock battle state
  // In real app, use seed to generate procedurally
  return { ...mockBattleState };
}
