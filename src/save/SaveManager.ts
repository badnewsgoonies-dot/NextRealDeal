/*
 * SaveManager: Cross-system persistence (save:v1).
 *
 * Features:
 * - Registry mode: Auto-gather from registered subsystems
 * - Payload mode: Manual SaveData for special cases
 * - Store abstraction: InMemory (tests) or LocalStorage (browser)
 * - Versioned envelopes (v1, migration-ready)
 * - Deterministic slot ordering
 */

import type { ILogger } from '../util/Logger.js';
import type { IAsyncQueue } from '../util/AsyncQueue.js';
import { ok, err, type Result } from '../util/Result.js';
import { makeAsyncQueue } from '../util/AsyncQueue.js';
import { validate } from '../validation/validate.js';
import {
  SlotSchema,
  SaveEnvelopeSchema,
  SaveDataSchema,
  SaveManagerStateSchema,
} from './SaveValidator.js';
import { InMemorySaveStore } from './SaveStore.js';
import {
  type ISaveStore,
  type SaveEnvelope,
  type SaveData,
  type SaveSubsystem,
  type SaveError,
  SAVE_ERR,
} from '../types/contracts.js';

const SAVE_VERSION = 'v1' as const;
const RESERVED_KEYS = new Set<string>(['_payload']); // ✅ Reserved subsystem names

export interface ISaveManager {
  readonly name: string;
  initialize(): Promise<Result<void, Error>>;
  update(deltaTime: number): Promise<Result<void, Error>>;
  destroy(): Promise<void>;
  getDebugStats(): {
    queuePending: number;
    registered: number;
    lastSaveISO: string | null;
  } | undefined;
}

/**
 * SaveManager implementation
 */
export class SaveManager implements ISaveManager {
  public readonly name = 'Save';
  private readonly queue: IAsyncQueue;

  private store: ISaveStore = new InMemorySaveStore();
  private subsystems = new Map<string, SaveSubsystem>();
  private lastSaveISO: string | null = null;

  constructor(
    protected readonly log: ILogger,
  ) {
    this.queue = makeAsyncQueue();
  }


  // ========================================
  // Lifecycle
  // ========================================

  public async initialize(): Promise<Result<void, Error>> {
    try {
      return await this.queue.run(async () => {
        this.log.info('save:init', { storeType: this.store.constructor.name });
        return ok(undefined);
      });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      this.log.error('save:init_failed', { error: error?.message });
      return err(new Error(`Save initialization failed: ${error?.message || 'Unknown error'}`));
    }
  }

  public async update(_deltaTime: number): Promise<Result<void, Error>> {
    // SaveManager doesn't need per-frame updates
    return ok(undefined);
  }

  public async destroy(): Promise<void> {
    // Cleanup resources if needed
    this.subsystems.clear();
  }

  public getDebugStats(): {
    queuePending: number;
    registered: number;
    lastSaveISO: string | null;
  } | undefined {
    if (process.env.NODE_ENV !== 'test') return undefined;
    return {
      queuePending: this.queue.pending,
      registered: this.subsystems.size,
      lastSaveISO: this.lastSaveISO,
    };
  }

  // ========================================
  // Subsystem Registry
  // ========================================

  public register(subsystem: SaveSubsystem): void {
    // ✅ Reserved key protection
    if (RESERVED_KEYS.has(subsystem.name)) {
      this.log.warn('save:reserved_name_rejected', { name: subsystem.name });
      return;
    }

    this.subsystems.set(subsystem.name, subsystem);
    this.log.info('save:subsystem_registered', { name: subsystem.name });
  }

  public unregister(name: string): void {
    this.subsystems.delete(name);
    this.log.info('save:subsystem_unregistered', { name });
  }

  public listRegistered(): readonly string[] {
    return Array.from(this.subsystems.keys());
  }

  // ========================================
  // Registry Mode (Auto-Gather)
  // ========================================

  public async save(
    slot: string,
    signal?: AbortSignal
  ): Promise<Result<void, SaveError>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err(SAVE_ERR.Aborted);

        const slotValidation = validate(SlotSchema, slot);
        if (!slotValidation.ok) return err(SAVE_ERR.InvalidSlot);

        const subs: Record<string, string> = {};

        for (const [name, subsystem] of this.subsystems.entries()) {
          try {
            subs[name] = subsystem.serialize();
          } catch (e: unknown) {
            const error = e as { message?: string };
            this.log.error('save:subsystem_serialize_failed', { name, error: error?.message });
            return err(SAVE_ERR.Internal);
          }
        }

        const envelope: SaveEnvelope = {
          version: SAVE_VERSION,
          timestamp: new Date().toISOString(),
          subsystems: subs,
        };

        const envelopeValidation = validate(SaveEnvelopeSchema, envelope);
        if (!envelopeValidation.ok) return err(SAVE_ERR.InvalidEnvelope);

        try {
          await this.store.write(slot, JSON.stringify(envelope));
        } catch (e: unknown) {
          const error = e as { message?: string };
          this.log.error('save:store_write_failed', { slot, error: error?.message });
          return err(SAVE_ERR.IoFailed);
        }

        this.lastSaveISO = envelope.timestamp;

        this.log.info('save:complete', {
          slot,
          subsystems: Object.keys(subs),
          bytes: JSON.stringify(envelope).length,
        });

        // Note: applyPostSave removed to prevent queue deadlock
        // If validation needed, call load() separately after save() completes

        return ok(undefined);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err(SAVE_ERR.Aborted);
      this.log.error('save:save_failed', { error: error?.message });
      return err(SAVE_ERR.Internal);
    }
  }

  // ========================================
  // Payload Mode (Manual Control)
  // ========================================

  public async saveWithData(
    slot: string,
    data: SaveData,
    signal?: AbortSignal
  ): Promise<Result<void, SaveError>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err(SAVE_ERR.Aborted);

        const slotValidation = validate(SlotSchema, slot);
        if (!slotValidation.ok) return err(SAVE_ERR.InvalidSlot);

        const dataValidation = validate(SaveDataSchema, data);
        if (!dataValidation.ok) return err(SAVE_ERR.InvalidData);

        const envelope: SaveEnvelope = {
          version: SAVE_VERSION,
          timestamp: new Date().toISOString(),
          subsystems: {
            _payload: JSON.stringify(data),
          },
        };

        try {
          await this.store.write(slot, JSON.stringify(envelope));
        } catch (e: unknown) {
          const error = e as { message?: string };
          this.log.error('save:store_write_failed', { slot, error: error?.message });
          return err(SAVE_ERR.IoFailed);
        }

        this.lastSaveISO = envelope.timestamp;

        this.log.info('save:saveWithData_complete', {
          slot,
          bytes: JSON.stringify(envelope).length,
        });

        return ok(undefined);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err(SAVE_ERR.Aborted);
      this.log.error('save:saveWithData_failed', { error: error?.message });
      return err(SAVE_ERR.Internal);
    }
  }

  // ========================================
  // Load Operation
  // ========================================

  public async load(
    slot: string,
    signal?: AbortSignal,
    opts?: { apply?: boolean }
  ): Promise<Result<SaveEnvelope, SaveError>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err(SAVE_ERR.Aborted);

        const slotValidation = validate(SlotSchema, slot);
        if (!slotValidation.ok) return err(SAVE_ERR.InvalidSlot);

        let raw: string;
        try {
          raw = await this.store.read(slot);
        } catch (e: unknown) {
          const error = e as { message?: string };
          if (String(error?.message).includes('ENOENT')) {
            return err(SAVE_ERR.SlotNotFound);
          }
          this.log.error('save:store_read_failed', { slot, error: error?.message });
          return err(SAVE_ERR.IoFailed);
        }

        let envelope: SaveEnvelope;
        try {
          envelope = JSON.parse(raw) as SaveEnvelope;
        } catch {
          return err(SAVE_ERR.InvalidEnvelope);
        }

        if (envelope.version !== SAVE_VERSION) {
          this.log.warn('save:unsupported_version', { slot, version: envelope.version });
          return err(SAVE_ERR.UnsupportedVersion);
        }

        const envelopeValidation = validate(SaveEnvelopeSchema, envelope);
        if (!envelopeValidation.ok) return err(SAVE_ERR.InvalidEnvelope);

        if (opts?.apply !== false) {
          for (const [name, payload] of Object.entries(envelope.subsystems)) {
            if (RESERVED_KEYS.has(name)) continue;

            const subsystem = this.subsystems.get(name);

            if (!subsystem) {
              this.log.info('save:skip_unregistered', { name });
              continue;
            }

            const applyResult = subsystem.deserialize(payload);
            if (!applyResult.ok) {
              this.log.error('save:subsystem_deserialize_failed', {
                name,
                error: applyResult.error,
              });
              return err(SAVE_ERR.ApplyFailed);
            }
          }
        }

        this.log.info('save:load_complete', {
          slot,
          applied: opts?.apply !== false,
          subsystems: Object.keys(envelope.subsystems),
        });

        return ok(envelope);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err(SAVE_ERR.Aborted);
      this.log.error('save:load_failed', { error: error?.message });
      return err(SAVE_ERR.Internal);
    }
  }

  // ========================================
  // Slot Management
  // ========================================

  public async listSlots(
    signal?: AbortSignal
  ): Promise<Result<readonly { slot: string; modified: string; size: number }[], SaveError>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err(SAVE_ERR.Aborted);

        try {
          const slots = await this.store.list();

          for (const slot of slots) {
            const validation = validate(SlotSchema, slot.slot);
            if (!validation.ok) return err(SAVE_ERR.InvalidSlot);
          }

          // ✅ Deterministic ordering: modified DESC, then slot ASC
          slots.sort((a, b) => {
            const timeDiff = b.modified.localeCompare(a.modified);
            if (timeDiff !== 0) return timeDiff;
            return a.slot.localeCompare(b.slot);
          });

          return ok(slots);
        } catch (e: unknown) {
          const error = e as { message?: string };
          this.log.error('save:list_slots_failed', { error: error?.message });
          return err(SAVE_ERR.IoFailed);
        }
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string };
      if (error?.name === 'AbortError') return err(SAVE_ERR.Aborted);
      return err(SAVE_ERR.Internal);
    }
  }

  public async deleteSlot(slot: string, signal?: AbortSignal): Promise<Result<void, SaveError>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err(SAVE_ERR.Aborted);

        const slotValidation = validate(SlotSchema, slot);
        if (!slotValidation.ok) return err(SAVE_ERR.InvalidSlot);

        try {
          await this.store.delete(slot);
          this.log.info('save:slot_deleted', { slot });
          return ok(undefined);
        } catch (e: unknown) {
          const error = e as { message?: string };
          if (String(error?.message).includes('ENOENT')) {
            return err(SAVE_ERR.SlotNotFound);
          }
          this.log.error('save:delete_slot_failed', { slot, error: error?.message });
          return err(SAVE_ERR.IoFailed);
        }
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string };
      if (error?.name === 'AbortError') return err(SAVE_ERR.Aborted);
      return err(SAVE_ERR.Internal);
    }
  }

  public async autoSave(slot = 'autosave', signal?: AbortSignal): Promise<Result<void, SaveError>> {
    return this.save(slot, signal);
  }

  // ========================================
  // SaveManager State Persistence
  // ========================================

  public serialize(): string {
    return JSON.stringify({
      version: SAVE_VERSION,
      state: { lastSaveISO: this.lastSaveISO },
    });
  }

  public deserialize(json: string): Result<void, SaveError> {
    try {
      const parsed = JSON.parse(json) as { version: string; state?: unknown };

      if (parsed.version !== SAVE_VERSION) {
        return err(SAVE_ERR.UnsupportedVersion);
      }

      const validation = validate(SaveManagerStateSchema, parsed.state ?? {});
      if (!validation.ok) return err(SAVE_ERR.InvalidEnvelope);

      this.lastSaveISO = validation.value.lastSaveISO ?? null;

      this.log.info('save:state_deserialized', {});
      return ok(undefined);
    } catch (e: unknown) {
      const error = e as { message?: string };
      this.log.error('save:deserialize_failed', { error: error?.message });
      return err(SAVE_ERR.InvalidEnvelope);
    }
  }

  // ========================================
  // SystemTemplate Lifecycle
  // ========================================

  protected async onInitialize(): Promise<void> {
    this.log.info('save:init', { version: SAVE_VERSION });
  }

  protected async onUpdate(_deltaTime: number): Promise<void> {
    // Save system is passive
  }

  protected async onDestroy(): Promise<void> {
    const registered = this.subsystems.size;

    this.subsystems.clear();
    this.lastSaveISO = null;

    this.log.info('save:destroy', { subsystemsCleared: registered });
  }
}

