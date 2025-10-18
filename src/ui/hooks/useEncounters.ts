import { useState, useEffect, useCallback } from 'react';
import { listEncounters, encountersSummary } from '../services/encounters';
import type { Encounter, EncountersSummary, EncountersQuery } from '../types';

export function useEncounters(params: EncountersQuery = {}): React.ReactElement {
  const [data, setData] = useState<{ encounters: Encounter[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listEncounters(params);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useEncountersSummary(): React.ReactElement {
  const [data, setData] = useState<EncountersSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await encountersSummary();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}