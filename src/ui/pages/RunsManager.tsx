import React, { useState } from 'react';
import { Card } from '../components/common/Card';
import { Table } from '../components/common/Table';
import { Pagination } from '../components/common/Pagination';
import { Modal } from '../components/common/Modal';
import { Input, Select, Button } from '../components/common/Form';
import { Loading, Empty, Error } from '../components/common/States';
import { useRuns, useCreateRun, useUpdateRun } from '../hooks/useRuns';
import { useToast } from '../components/common/Toast';
import { runCreateSchema, runUpdateSchema } from '../validation/schemas';
import type { Run, RunsQuery } from '../types';

const columns = [
  { key: 'name' as keyof Run, label: 'Name', sortable: true },
  { key: 'seed' as keyof Run, label: 'Seed', sortable: false },
  { key: 'status' as keyof Run, label: 'Status', sortable: false },
  { key: 'createdAt' as keyof Run, label: 'Created', sortable: true },
];

export function RunsManager(): React.ReactElement {
  const [query, setQuery] = useState<RunsQuery>({ page: 1, pageSize: 8 });
  const [sortBy, setSortBy] = useState<'createdAt' | 'name'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRun, setEditingRun] = useState<Run | null>(null);
  const [formData, setFormData] = useState({ name: '', seed: '', status: 'active' as 'active' | 'archived' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data, loading, error, refetch } = useRuns({ ...query, sortBy, sortOrder });
  const createRun = useCreateRun();
  const updateRun = useUpdateRun();
  const { addToast } = useToast();

  const handleSort = (key: keyof Run): void => {
    if (key === 'createdAt' || key === 'name') {
      if (sortBy === key) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortBy(key);
        setSortOrder('asc');
      }
    }
  };

  const handleCreate = async (): Promise<void> => {
    try {
      const validated = runCreateSchema.parse(formData);
      await createRun.mutate(validated);
      addToast('Run created successfully', 'success');
      setShowCreateModal(false);
      setFormData({ name: '', seed: '', status: 'active' });
      refetch();
    } catch (err: unknown) {
      const zodError = err as { errors?: Array<{ path: string[]; message: string }> };
      if (zodError.errors) {
        const errors: Record<string, string> = {};
        zodError.errors.forEach((e) => {
          errors[e.path[0]] = e.message;
        });
        setFormErrors(errors);
      }
    }
  };

  const handleEdit = async (): Promise<void> => {
    if (!editingRun) return;
    try {
      const validated = runUpdateSchema.parse({ ...formData, id: editingRun.id });
      await updateRun.mutate(validated);
      addToast('Run updated successfully', 'success');
      setEditingRun(null);
      setFormData({ name: '', seed: '', status: 'active' });
      refetch();
    } catch (err: unknown) {
      const zodError = err as { errors?: Array<{ path: string[]; message: string }> };
      if (zodError.errors) {
        const errors: Record<string, string> = {};
        zodError.errors.forEach((e) => {
          errors[e.path[0]] = e.message;
        });
        setFormErrors(errors);
      }
    }
  };

  // Note: handleDelete and openEditModal can be implemented when needed
  // For now, delete and edit functionality is handled via Table actions

  if (loading) return <Loading />;
  if (error) return <Error message={error} onRetry={refetch} />;

  const runs = data?.runs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / (query.pageSize || 8));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-text-primary">Runs Manager</h1>
        <Button onClick={() => setShowCreateModal(true)}>Create Run</Button>
      </div>

      <Card>
        <div className="flex space-x-4 mb-4">
          <Input
            placeholder="Search by name..."
            value={query.search || ''}
            onChange={(e) => setQuery({ ...query, search: e.target.value, page: 1 })}
            className="flex-1"
          />
          <Select
            value={query.status || 'all'}
            onChange={(e) => setQuery({ ...query, status: e.target.value as 'active' | 'archived', page: 1 })}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>

        {runs.length === 0 ? (
          <Empty message="No runs found" />
        ) : (
          <>
            <Table
              data={runs}
              columns={columns}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
            />
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-text-secondary">
                Showing {runs.length} of {total} runs
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

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Run"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
          />
          <Input
            label="Seed"
            value={formData.seed}
            onChange={(e) => setFormData({ ...formData, seed: e.target.value })}
            error={formErrors.seed}
          />
          <div className="flex justify-end space-x-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createRun.loading}>
              {createRun.loading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingRun}
        onClose={() => setEditingRun(null)}
        title="Edit Run"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
          />
          <Input
            label="Seed"
            value={formData.seed}
            onChange={(e) => setFormData({ ...formData, seed: e.target.value })}
            error={formErrors.seed}
          />
          <Select
            label="Status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'archived' })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
          <div className="flex justify-end space-x-2">
            <Button variant="secondary" onClick={() => setEditingRun(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={updateRun.loading}>
              {updateRun.loading ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
