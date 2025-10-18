import { mockRuns, mockRunsSummary, mockEncounters } from './mockData';
import type { Run, RunsSummary, RunsQuery } from '../types';
import type { RunCreateInput, RunUpdateInput } from '../validation/schemas';

// Simulate latency
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Simulate occasional failures (Math.random allowed in mock services)
// eslint-disable-next-line no-restricted-properties
const maybeFail = (): boolean => Math.random() < 0.1; // 10% failure rate

export async function listRuns(params: RunsQuery = {}): Promise<{ runs: Run[]; total: number }> {
  await delay(200);
  if (maybeFail()) throw new Error('Failed to fetch runs');

  let filtered = [...mockRuns];

  if (params.search) {
    filtered = filtered.filter(r => r.name.toLowerCase().includes(params.search!.toLowerCase()));
  }

  if (params.status && params.status !== 'all') {
    filtered = filtered.filter(r => r.status === params.status);
  }

  // Sort
  const sortBy = params.sortBy || 'createdAt';
  const sortOrder = params.sortOrder || 'desc';
  filtered.sort((a, b) => {
    let aVal: string | number = a[sortBy as keyof Run] as string;
    let bVal: string | number = b[sortBy as keyof Run] as string;
    if (sortBy === 'createdAt') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }
    return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  const page = params.page || 1;
  const pageSize = params.pageSize || 8;
  const start = (page - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

  return { runs: paginated, total: filtered.length };
}

export async function createRun(input: RunCreateInput): Promise<Run> {
  await delay(300);
  if (maybeFail()) throw new Error('Failed to create run');

  const newRun: Run = {
    id: `run-${Date.now()}`,
    ...input,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  mockRuns.push(newRun);
  return newRun;
}

export async function updateRun(input: RunUpdateInput): Promise<Run> {
  await delay(200);
  if (maybeFail()) throw new Error('Failed to update run');

  const run = mockRuns.find(r => r.id === input.id);
  if (!run) throw new Error('Run not found');

  Object.assign(run, input);
  return run;
}

export async function deleteRun(id: string): Promise<void> {
  await delay(200);
  if (maybeFail()) throw new Error('Failed to delete run');

  const index = mockRuns.findIndex(r => r.id === id);
  if (index === -1) throw new Error('Run not found');

  mockRuns.splice(index, 1);
  // Cascade delete encounters
  const encountersToDelete = mockEncounters.filter(e => e.runId === id);
  encountersToDelete.forEach(e => {
    const idx = mockEncounters.indexOf(e);
    mockEncounters.splice(idx, 1);
  });
}

export async function runsSummary(): Promise<RunsSummary> {
  await delay(100);
  if (maybeFail()) throw new Error('Failed to fetch summary');

  return mockRunsSummary;
}
