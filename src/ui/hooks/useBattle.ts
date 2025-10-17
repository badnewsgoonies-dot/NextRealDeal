import { useState, useEffect, useCallback } from 'react';
import { makeMockBattle } from '../services/battle';
import type { BattleState } from '../types';

export function useBattle(seed?: string) {
  const [data, setData] = useState<BattleState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await makeMockBattle(seed);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [seed]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}