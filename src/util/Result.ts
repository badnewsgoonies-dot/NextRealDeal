/*
 * Result<T, E>: Type-safe error handling without exceptions.
 * Use for expected failures (validation, business logic).
 * Throw for unexpected failures (programmer errors, invariant violations).
 */

export type Result<T, E = Error> = 
  | { ok: true; value: T } 
  | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// Lowercase aliases for convenience
export const ok = Ok;
export const err = Err;

export const isOk = <T, E>(result: Result<T, E>): result is { ok: true; value: T } =>
  result.ok === true;

export const isErr = <T, E>(result: Result<T, E>): result is { ok: false; error: E } =>
  result.ok === false;

/**
 * Unwrap a Result, throwing if Err
 */
export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (result.ok) return result.value;
  throw result.error;
};

/**
 * Get value or default
 */
export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T => {
  return result.ok ? result.value : defaultValue;
};

/**
 * Map a Result's value
 */
export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> => {
  return result.ok ? Ok(fn(result.value)) : result;
};

/**
 * Map a Result's error
 */
export const mapErr = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> => {
  return result.ok ? result : Err(fn(result.error));
};

/**
 * Chain Results (flatMap)
 */
export const andThen = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => {
  return result.ok ? fn(result.value) : result;
};

/**
 * Combine multiple Results into one
 * Returns Ok with array of values if all Ok, otherwise first Err
 */
export const combine = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }
  return Ok(values);
};

