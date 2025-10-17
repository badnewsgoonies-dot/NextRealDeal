import { mockBattleState } from './mockData';
import type { BattleState } from '../types';

// Simulate latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simulate occasional failures
const maybeFail = () => Math.random() < 0.1; // 10% failure rate

export async function makeMockBattle(seed?: string): Promise<BattleState> {
  await delay(300);
  if (maybeFail()) throw new Error('Failed to generate battle');

  // For simplicity, return the mock battle state
  // In real app, use seed to generate procedurally
  return { ...mockBattleState };
}