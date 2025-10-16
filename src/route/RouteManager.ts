/*
 * RouteManager: Slay the Spire-style meta-map (route:v1).
 * 
 * Game Loop: battle → choice (A/B/C) → battle...
 * 
 * Features:
 * - 3 deterministic choices per step (cached)
 * - Versioned RNG (route:v1 → run:v1 → step:v1)
 * - Run lifecycle guards (prevent overwrites)
 * - Serialization (Save/Load ready)
 * - Typed error codes
 */

import { SystemTemplate } from '../core/SystemTemplate.js';
import type { IRng } from '../util/Rng.js';
import type { ILogger } from '../util/Logger.js';
import type { IAsyncQueue } from '../util/AsyncQueue.js';
import { ok, err, type Result } from '../util/Result.js';
import { makeAsyncQueue } from '../util/AsyncQueue.js';
import { validate } from '../validation/validate.js';
import { RunIdSchema, SeedSchema, RunStateSchema } from './RouteValidator.js';
import {
  type IRouteSystem,
  type RunState,
  type Choice,
  type Chosen,
  type RunPointer,
  type RouteError,
  ROUTE_ERR,
} from '../types/contracts.js';

export interface IRouteManager extends IRouteSystem {
  readonly name: string;
  initialize(): Promise<Result<void, Error>>;
  update(deltaTime: number): Promise<Result<void, Error>>;
  destroy(): Promise<void>;
  getDebugStats(): {
    queuePending: number;
    runId: string | null;
    step: number;
    historyLen: number;
    cacheValid: boolean;
  } | undefined;
}

/**
 * RouteManager implementation
 */
export class RouteManager extends SystemTemplate implements IRouteManager {
  private readonly queue: IAsyncQueue;
  private readonly routeRngRoot: IRng;

  private state: RunState | null = null;
  private runRng: IRng | null = null;
  private choicesCache: readonly Choice[] | null = null;

  constructor(
    protected readonly log: ILogger,
    rng: IRng
  ) {
    super({ name: 'Route' });
    this.queue = makeAsyncQueue();
    this.routeRngRoot = rng.fork('route:v1');
  }

  // ========================================
  // Test-Only Debug Hook
  // ========================================

  public getDebugStats(): {
    queuePending: number;
    runId: string | null;
    step: number;
    historyLen: number;
    cacheValid: boolean;
  } | undefined {
    if (process.env.NODE_ENV !== 'test') return undefined;

    return {
      queuePending: this.queue.pending,
      runId: this.state?.runId ?? null,
      step: this.state?.step ?? 0,
      historyLen: this.state?.history.length ?? 0,
      cacheValid: this.choicesCache !== null,
    };
  }

  // ========================================
  // IRouteSystem Interface
  // ========================================

  public async startRun(
    runId: string,
    seed: number | string,
    signal?: AbortSignal,
    opts?: { force?: boolean }
  ): Promise<Result<RunState, RouteError>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err(ROUTE_ERR.Aborted);

        if (this.state && !opts?.force) {
          return err(ROUTE_ERR.RunActive);
        }

        const runIdVal = validate(RunIdSchema, runId);
        if (!runIdVal.ok) return err(ROUTE_ERR.InvalidRunId);

        const seedVal = validate(SeedSchema, seed);
        if (!seedVal.ok) return err(ROUTE_ERR.InvalidSeed);

        const normalizedSeed = String(seed);

        const initialState: RunState = {
          runId,
          seed: normalizedSeed,
          step: 0,
          history: [],
        };

        this.state = initialState;
        this.runRng = this.routeRngRoot.fork(`run#${runId}:${normalizedSeed}:v1`);
        this.choicesCache = null;

        this.log.info('route:run_started', { runId, seed: normalizedSeed, version: 'v1' });
        return ok(initialState);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err(ROUTE_ERR.Aborted);
      this.log.error('route:start_run_failed', { error: error?.message });
      return err(ROUTE_ERR.Internal);
    }
  }

  public async endRun(signal?: AbortSignal): Promise<Result<void, RouteError>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err(ROUTE_ERR.Aborted);
        if (!this.state) return err(ROUTE_ERR.NoRun);

        const summary = {
          runId: this.state.runId,
          finalStep: this.state.step,
          totalChoices: this.state.history.length,
        };

        this.state = null;
        this.runRng = null;
        this.choicesCache = null;

        this.log.info('route:run_ended', summary);
        return ok(undefined);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err(ROUTE_ERR.Aborted);
      this.log.error('route:end_run_failed', { error: error?.message });
      return err(ROUTE_ERR.Internal);
    }
  }

  public async getChoices(signal?: AbortSignal): Promise<Result<readonly Choice[], RouteError>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err(ROUTE_ERR.Aborted);

        if (!this.state || !this.runRng) return err(ROUTE_ERR.NoRun);
        if (this.state.step >= 10000) return err(ROUTE_ERR.Finished);

        if (!this.choicesCache) {
          this.choicesCache = this._buildChoicesInternal(this.state);
        }

        this.log.info('route:choices_retrieved', {
          step: this.state.step,
          cached: true,
        });

        return ok(this.choicesCache);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err(ROUTE_ERR.Aborted);
      this.log.error('route:get_choices_failed', { error: error?.message });
      return err(ROUTE_ERR.Internal);
    }
  }

  public async choose(choiceId: string, signal?: AbortSignal): Promise<Result<Chosen, RouteError>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err(ROUTE_ERR.Aborted);

        if (!this.state || !this.runRng) return err(ROUTE_ERR.NoRun);
        if (this.state.step >= 10000) return err(ROUTE_ERR.Finished);

        const choices = this.choicesCache ?? this._buildChoicesInternal(this.state);
        const choice = choices.find(c => c.id === choiceId);

        if (!choice) {
          // Check if it was from a previous step (stale)
          const wasInHistory = this.state.history.some(h => h.id === choiceId);
          if (wasInHistory) return err(ROUTE_ERR.StaleStep);
          return err(ROUTE_ERR.InvalidChoice);
        }
        
        if (choice.step !== this.state.step) return err(ROUTE_ERR.StaleStep);

        const prevStep = this.state.step;

        this._appendHistoryInternal(choice);
        this._advanceStepInternal();

        this.log.info('route:choice_made', {
          runId: this.state.runId,
          prevStep,
          nextStep: this.state.step,
          choiceLabel: choice.label,
          arenaSeed: choice.arenaSeed,
          version: 'v1',
        });

        return ok({ step: this.state.step, choice });
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err(ROUTE_ERR.Aborted);
      this.log.error('route:choose_failed', { error: error?.message });
      return err(ROUTE_ERR.Internal);
    }
  }

  public current(): RunPointer | null {
    if (!this.state) return null;
    return { runId: this.state.runId, step: this.state.step };
  }

  public history(): readonly Choice[] {
    return this.state?.history || [];
  }

  public serialize(): string {
    if (!this.state) {
      return JSON.stringify({ version: 'v1', state: null });
    }
    return JSON.stringify({ version: 'v1', state: this.state });
  }

  public deserialize(json: string): Result<void, RouteError> {
    try {
      const parsed = JSON.parse(json) as { version: string; state: unknown };

      if (parsed.version !== 'v1') {
        return err(ROUTE_ERR.UnsupportedVersion);
      }

      if (!parsed.state) {
        this.state = null;
        this.runRng = null;
        this.choicesCache = null;
        return ok(undefined);
      }

      const validation = validate(RunStateSchema, parsed.state);
      if (!validation.ok) {
        return err(ROUTE_ERR.InvalidState);
      }

      this.state = validation.value;
      this.runRng = this.routeRngRoot.fork(`run#${this.state.runId}:${this.state.seed}:v1`);
      this.choicesCache = null;

      this.log.info('route:deserialized', {
        runId: this.state.runId,
        step: this.state.step,
      });

      return ok(undefined);
    } catch (e: unknown) {
      this.log.error('route:deserialize_failed', { error: String(e) });
      return err(ROUTE_ERR.DeserializationFailed);
    }
  }

  // ========================================
  // SystemTemplate Lifecycle
  // ========================================

  protected async onInitialize(): Promise<void> {
    this.log.info('route:init', { version: 'v1' });
  }

  protected async onUpdate(_deltaTime: number): Promise<void> {
    // Route system is passive
  }

  protected async onDestroy(): Promise<void> {
    const summary = {
      runId: this.state?.runId ?? null,
      steps: this.state?.step ?? 0,
      choices: this.state?.history.length ?? 0,
    };

    this.state = null;
    this.runRng = null;
    this.choicesCache = null;

    this.log.info('route:destroy', summary);
  }

  // ========================================
  // Internal Methods (pure, non-throwing)
  // ========================================

  private _buildChoicesInternal(state: RunState): Choice[] {
    const stepRng = this.runRng!.fork(`step#${state.step}:v1`);
    const choices: Choice[] = [];
    const labels: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];

    for (let i = 0; i < 3; i++) {
      const arenaSeed = stepRng.int(1, 2147483647);

      choices.push({
        id: `${state.runId}:s${state.step}:i${i}:lbl${labels[i]}`,
        step: state.step,
        type: 'battle',
        label: labels[i],
        arenaSeed,
        arenaHint: { width: 48, height: 48 },
      });
    }

    return choices;
  }

  private _appendHistoryInternal(choice: Choice): void {
    this.state = {
      ...this.state!,
      history: [...this.state!.history, choice],
    };
  }

  private _advanceStepInternal(): void {
    this.state = {
      ...this.state!,
      step: this.state!.step + 1,
    };
    this.choicesCache = null;
  }
}

