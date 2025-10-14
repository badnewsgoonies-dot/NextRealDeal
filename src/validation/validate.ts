/*
 * Validation utilities using Valibot.
 * Wraps Valibot parse/safeParse in Result types.
 */

import * as v from 'valibot';
import { Ok, Err, type Result } from '../util/Result.js';

/**
 * Validate data against a schema, returning Result
 */
export const validate = <TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: TSchema,
  data: unknown
): Result<v.InferOutput<TSchema>, Error> => {
  const result = v.safeParse(schema, data);
  
  if (result.success) {
    return Ok(result.output);
  }
  
  const message = result.issues
    .map((issue) => `${issue.path?.map(p => p.key).join('.') || 'root'}: ${issue.message}`)
    .join('; ');
  
  return Err(new Error(`Validation failed: ${message}`));
};

/**
 * Validate with custom error type
 */
export const validateWith = <
  TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
  TError
>(
  schema: TSchema,
  data: unknown,
  errorFn: (issues: v.BaseIssue<unknown>[]) => TError
): Result<v.InferOutput<TSchema>, TError> => {
  const result = v.safeParse(schema, data);
  
  if (result.success) {
    return Ok(result.output);
  }
  
  return Err(errorFn(result.issues));
};

/**
 * Assert data matches schema (throws on failure)
 */
export const assert = <TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: TSchema,
  data: unknown
): v.InferOutput<TSchema> => {
  return v.parse(schema, data);
};

