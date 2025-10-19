import React from 'react';
import { Card } from '../components/common/Card';
import { useRunsSummary } from '../hooks/useRuns';
import { useEncountersSummary } from '../hooks/useEncounters';
import { Loading, Error } from '../components/common/States';

export function Overview(): React.ReactElement {
  const { data: runsSummary, loading: runsLoading, error: runsError } = useRunsSummary();
  const { data: encountersSummary, loading: encountersLoading, error: encountersError } = useEncountersSummary();

  if (runsLoading || encountersLoading) return <Loading />;
  if (runsError || encountersError) return <Error message="Failed to load overview data" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Runs" value={runsSummary?.total || 0} color="primary" />
        <StatCard title="Active Runs" value={runsSummary?.active || 0} color="success" />
        <StatCard title="Total Encounters" value={encountersSummary?.total || 0} color="primary" />
        <WinRateCard total={encountersSummary?.total || 0} wins={encountersSummary?.wins || 0} />
      </div>

      <Card>
        <h3 className="text-lg font-semibold text-text-primary mb-4">Recent Activity</h3>
        <p className="text-text-secondary">Activity feed coming soon...</p>
      </Card>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  color: 'primary' | 'success';
}

function StatCard({ title, value, color }: StatCardProps): React.ReactElement {
  return (
    <Card>
      <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
      <p className={`text-3xl font-bold text-${color}`}>{value}</p>
    </Card>
  );
}

interface WinRateCardProps {
  total: number;
  wins: number;
}

function WinRateCard({ total, wins }: WinRateCardProps): React.ReactElement {
  const winRate = total ? Math.round((wins / total) * 100) : 0;
  
  return (
    <Card>
      <h3 className="text-lg font-semibold text-text-primary mb-2">Win Rate</h3>
      <p className="text-3xl font-bold text-success">{winRate}%</p>
    </Card>
  );
}
