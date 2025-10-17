import { describe, it, expect } from 'vitest';
import { runCreateSchema, runUpdateSchema } from '../../src/ui/validation/schemas';

describe('Validation Schemas', () => {
  describe('runCreateSchema', () => {
    it('validates correct input', () => {
      const input = { name: 'Test Run', seed: 'abc123' };
      expect(() => runCreateSchema.parse(input)).not.toThrow();
    });

    it('rejects empty name', () => {
      const input = { name: '', seed: 'abc123' };
      expect(() => runCreateSchema.parse(input)).toThrow();
    });

    it('rejects short name', () => {
      const input = { name: 'A', seed: 'abc123' };
      expect(() => runCreateSchema.parse(input)).toThrow();
    });

    it('rejects empty seed', () => {
      const input = { name: 'Test Run', seed: '' };
      expect(() => runCreateSchema.parse(input)).toThrow();
    });
  });

  describe('runUpdateSchema', () => {
    it('validates correct input', () => {
      const input = { id: 'run-1', name: 'Updated Run', status: 'archived' as const };
      expect(() => runUpdateSchema.parse(input)).not.toThrow();
    });

    it('requires id', () => {
      const input = { name: 'Updated Run', status: 'archived' as const };
      expect(() => runUpdateSchema.parse(input)).toThrow();
    });
  });
});