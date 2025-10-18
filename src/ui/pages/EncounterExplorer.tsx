import React, { useState } from 'react';
import { Card } from '../components/common/Card';
import { Table } from '../components/common/Table';
import { Pagination } from '../components/common/Pagination';
import { Input, Select } from '../components/common/Form';
import { Loading, Empty, Error } from '../components/common/States';
import { useEncounters } from '../hooks/useEncounters';
import type { Encounter, EncountersQuery } from '../types';

const columns = [
  { key: 'runId' as keyof Encounter, label: 'Run ID', sortable: false },
  { key: 'step' as keyof Encounter, label: 'Step', sortable: true },
  { key: 'choiceLabel' as keyof Encounter, label: 'Choice', sortable: false },
  { key: 'arenaSeed' as keyof Encounter, label: 'Arena Seed', sortable: false },
  { key: 'result' as keyof Encounter, label: 'Result', sortable: false },
  { key: 'createdAt' as keyof Encounter, label: 'Created', sortable: true },
];

export function EncounterExplorer(): React.ReactElement {
  const [query, setQuery] = useState<EncountersQuery>({ page: 1, pageSize: 12 });
  const [sortBy, setSortBy] = useState<'createdAt' | 'step'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data, loading, error, refetch } = useEncounters({ ...query, sortBy, sortOrder });

  const handleSort = (key: keyof Encounter): void => {
    if (key === 'createdAt' || key === 'step') {
      if (sortBy === key) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortBy(key);
        setSortOrder('asc');
      }
    }
  };

  if (loading) return <Loading />;
  if (error) return <Error message={error} onRetry={refetch} />;

  return <EncounterContent query={query} setQuery={setQuery} data={data} sortBy={sortBy} sortOrder={sortOrder} handleSort={handleSort} />;
}

interface EncounterContentProps {
  query: EncountersQuery;
  setQuery: (query: EncountersQuery) => void;
  data: { encounters: Encounter[]; total: number } | undefined;
  sortBy: 'createdAt' | 'step';
  sortOrder: 'asc' | 'desc';
  handleSort: (key: keyof Encounter) => void;
}

function EncounterContent({ query, setQuery, data, sortBy, sortOrder, handleSort }: EncounterContentProps): React.ReactElement {
  const encounters = data?.encounters || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / (query.pageSize || 12));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Encounter Explorer</h1>

      <Card>
        <div className="flex space-x-4 mb-4">
          <Input
            placeholder="Run ID..."
            value={query.runId || ''}
            onChange={(e) => setQuery({ ...query, runId: e.target.value, page: 1 })}
          />
          <Input
            placeholder="Arena seed substring..."
            value={query.seedSubstring || ''}
            onChange={(e) => setQuery({ ...query, seedSubstring: e.target.value, page: 1 })}
          />
          <Select
            value={query.result || 'all'}
            onChange={(e) => setQuery({ ...query, result: e.target.value as 'win' | 'loss', page: 1 })}
            options={[
              { value: 'all', label: 'All Results' },
              { value: 'win', label: 'Wins' },
              { value: 'loss', label: 'Losses' },
            ]}
          />
        </div>

        {encounters.length === 0 ? (
          <Empty message="No encounters found" />
        ) : (
          <>
            <Table
              data={encounters}
              columns={columns}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
            />
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-text-secondary">
                Showing {encounters.length} of {total} encounters
              </div>
              <Pagination
                currentPage={query.page || 1}
                totalPages={totalPages}
                onPageChange={(page) => setQuery({ ...query, page })}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
