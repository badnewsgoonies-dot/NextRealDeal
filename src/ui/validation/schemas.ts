import { z } from 'zod';

export const runCreateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  seed: z.string().min(1, 'Seed is required'),
});

export const runUpdateSchema = z.object({
  id: z.string(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  status: z.enum(['active', 'archived']),
});

export type RunCreateInput = z.infer<typeof runCreateSchema>;
export type RunUpdateInput = z.infer<typeof runUpdateSchema>;