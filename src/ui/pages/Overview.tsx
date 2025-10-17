import React from 'react';
import { Card } from '../components/common/Card';
import { useRunsSummary } from '../hooks/useRuns';
import { useEncountersSummary } from '../hooks/useEncounters';
import { Loading, Error } from '../components/common/States';

export function Overview() {
  const { data: runsSummary, loading: runsLoading, error: runsError } = useRunsSummary();
  const { data: encountersSummary, loading: encountersLoading, error: encountersError } = useEncountersSummary();

  if (runsLoading || encountersLoading) return <Loading />;
  if (runsError || encountersError) return <Error message="Failed to load overview data" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Total Runs</h3>
          <p className="text-3xl font-bold text-primary">{runsSummary?.total || 0}</p>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Active Runs</h3>
          <p className="text-3xl font-bold text-success">{runsSummary?.active || 0}</p>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Total Encounters</h3>
          <p className="text-3xl font-bold text-primary">{encountersSummary?.total || 0}</p>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Win Rate</h3>
          <p className="text-3xl font-bold text-success">
            {encountersSummary?.total
              ? Math.round((encountersSummary.wins / encountersSummary.total) * 100)
              : 0}%
          </p>
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-semibold text-text-primary mb-4">Recent Activity</h3>
        <p className="text-text-secondary">Activity feed coming soon...</p>
      </Card>
    </div>
  );
}