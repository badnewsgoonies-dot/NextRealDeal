import { mockEncounters, mockEncountersSummary } from './mockData';
import type { Encounter, EncountersSummary, EncountersQuery } from '../types';

// Simulate latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simulate occasional failures
const maybeFail = () => Math.random() < 0.1; // 10% failure rate

export async function listEncounters(params: EncountersQuery = {}): Promise<{ encounters: Encounter[]; total: number }> {
  await delay(200);
  if (maybeFail()) throw new Error('Failed to fetch encounters');

  let filtered = [...mockEncounters];

  if (params.runId) {
    filtered = filtered.filter(e => e.runId === params.runId);
  }

  if (params.seedSubstring) {
    filtered = filtered.filter(e => e.arenaSeed.toString().includes(params.seedSubstring!));
  }

  if (params.result && params.result !== 'all') {
    filtered = filtered.filter(e => e.result === params.result);
  }

  // Sort
  const sortBy = params.sortBy || 'createdAt';
  const sortOrder = params.sortOrder || 'desc';
  filtered.sort((a, b) => {
    let aVal: string | number = a[sortBy as keyof Encounter] as string | number;
    let bVal: string | number = b[sortBy as keyof Encounter] as string | number;
    if (sortBy === 'createdAt') {
      aVal = new Date(aVal as string).getTime();
      bVal = new Date(bVal as string).getTime();
    }
    return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  const page = params.page || 1;
  const pageSize = params.pageSize || 12;
  const start = (page - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

  return { encounters: paginated, total: filtered.length };
}

export async function encountersSummary(): Promise<EncountersSummary> {
  await delay(100);
  if (maybeFail()) throw new Error('Failed to fetch summary');

  return mockEncountersSummary;
}