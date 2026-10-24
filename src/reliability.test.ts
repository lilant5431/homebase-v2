import { describe, it, expect, vi } from "vitest";
import {
  KEY,
  MAX_BACKUP_BYTES,
  parseState,
  serializeState,
  type State,
} from "./domain";
import {
  WorkspaceStore,
  withWorkspaceWriteLock,
  type StoragePort,
} from "./storage";
import { createBackupBlob, readBackupFile } from "./backup";
import { evaluationState } from "./testFixtures";
import { toggleAssignment, putAssignment } from "./academic";

function memory() {
  const values = new Map([[KEY, serializeState(evaluationState())]]);
  let interleave: (() => void) | undefined;
  const storage: StoragePort = {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      if (key === KEY + ".rollback" && interleave) {
        const action = interleave;
        interleave = undefined;
        action();
      }
      values.set(key, value);
    },
  };
  return {
    values,
    storage,
    interleave: (action: () => void) => {
      interleave = action;
    },
  };
}
describe("exclusive write boundary", () => {
  it("missing Web Locks blocks both stale tabs before the dangerous interleaving can run", async () => {
    const m = memory(),
      a = new WorkspaceStore(m.storage),
      b = new WorkspaceStore(m.storage);
    const aNext = putAssignment(a.snapshot.state, {
      ...a.snapshot.state.assignments[0],
      title: "Tab A edit",
    });
    const bNext = toggleAssignment(b.snapshot.state, "calculus");
    const bInterleave = vi.fn(() => b.save(bNext));
    // This is the reported lost-update position: A has passed its snapshot check,
    // but hasn't written the primary key. No-lock mode must never reach it.
    m.interleave(bInterleave);
    const writes = vi.spyOn(m.storage, "setItem");
    const before = new Map(m.values);
    const operations = await Promise.allSettled([
      withWorkspaceWriteLock(undefined, () => a.save(aNext)),
      withWorkspaceWriteLock(undefined, () => b.save(bNext)),
    ]);
    expect(
      operations.every(
        (result) =>
          result.status === "rejected" &&
          String(result.reason).includes("Read-only"),
      ),
    ).toBe(true);
    expect(bInterleave).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
    expect(m.values).toEqual(before);
    expect(a.snapshot.state.revision).toBe(0);
    expect(b.snapshot.state.revision).toBe(0);
  });
  it("queued stale candidates serialize and the second save is rejected", async () => {
    const m = memory(),
      a = new WorkspaceStore(m.storage),
      b = new WorkspaceStore(m.storage);
    const queued: Array<() => void> = [];
    // Deterministic lock scheduler: both candidates exist before either is run.
    const locks = {
      request: vi.fn(
        (_name: string, action: () => State) =>
          new Promise<State>((resolve, reject) => {
            queued.push(() => {
              try {
                resolve(action());
              } catch (e) {
                reject(e);
              }
            });
          }),
      ),
    } as unknown as Pick<LockManager, "request">;
    const first = withWorkspaceWriteLock(locks, () =>
      a.save(toggleAssignment(a.snapshot.state, "essay")),
    );
    const second = withWorkspaceWriteLock(locks, () =>
      b.save(toggleAssignment(b.snapshot.state, "calculus")),
    );
    const rejected = expect(second).rejects.toThrow(/another tab/);
    expect(queued).toHaveLength(2);
    queued.shift()!();
    await first;
    queued.shift()!();
    await rejected;
    expect(locks.request).toHaveBeenNthCalledWith(1, KEY, expect.any(Function));
    const saved = parseState(m.values.get(KEY)!);
    expect(saved.assignments.find((a) => a.id === "essay")!.completed).toBe(
      true,
    );
    expect(saved.assignments.find((a) => a.id === "calculus")!.completed).toBe(
      false,
    );
    expect(saved.revision).toBe(1);
  });
});
describe("UI backup blob/file paths and persisted UTF-8 encoding", () => {
  function nearLimit() {
    const state = { ...evaluationState(), padding: "" };
    const base = new TextEncoder().encode(JSON.stringify(state)).length;
    state.padding = "中".repeat(Math.floor((MAX_BACKUP_BYTES - 50 - base) / 3));
    return state;
  }
  it("a near-limit Unicode workspace round-trips through export Blob, file reader, and store restore", async () => {
    const state = nearLimit();
    const oldPretty = new Blob([JSON.stringify(state, null, 2)]);
    expect(oldPretty.size).toBeGreaterThan(MAX_BACKUP_BYTES);
    const blob = createBackupBlob(state);
    expect(blob.size).toBeLessThanOrEqual(MAX_BACKUP_BYTES);
    expect(blob.size).toBeGreaterThan(MAX_BACKUP_BYTES - 100);
    const m = memory(),
      store = new WorkspaceStore(m.storage);
    store.restore(await readBackupFile(blob));
    const persisted = m.values.get(KEY)!;
    expect(persisted).toBe(serializeState(store.snapshot.state));
    const exported = createBackupBlob(store.snapshot.state);
    expect(exported.size).toBeLessThanOrEqual(MAX_BACKUP_BYTES);
    const restored = parseState(await readBackupFile(exported));
    expect(restored).toEqual(store.snapshot.state);
    // Unknown imported metadata is preserved; compact export fixes size without discarding it.
    expect((restored as State & { padding: string }).padding).toBe(
      state.padding,
    );
  });
  it("the exact byte limit is inclusive and UTF-8, not JS character count", async () => {
    const state = { ...evaluationState(), padding: "" };
    state.padding = "x".repeat(MAX_BACKUP_BYTES - serializeState(state).length);
    const exact = createBackupBlob(state);
    expect(exact.size).toBe(MAX_BACKUP_BYTES);
    expect(parseState(await readBackupFile(exact))).toEqual(state);
    state.padding = state.padding.slice(0, -1) + "中";
    expect(JSON.stringify(state).length).toBe(MAX_BACKUP_BYTES);
    expect(() => serializeState(state)).toThrow(/UTF-8/);
    expect(() => parseState(JSON.stringify(state))).toThrow(/UTF-8/);
    await expect(
      readBackupFile(new Blob([JSON.stringify(state)])),
    ).rejects.toThrow(/UTF-8/);
  });
  it("oversized save/restore leaves current, rollback and recovery untouched", async () => {
    const m = memory(),
      store = new WorkspaceStore(m.storage);
    m.values.set(KEY + ".rollback", serializeState(evaluationState()));
    m.values.set(KEY + ".recovery", "raw diagnostic");
    const before = new Map(m.values);
    const oversized = {
      ...evaluationState(),
      padding: "中".repeat(Math.ceil(MAX_BACKUP_BYTES / 3)),
    };
    expect(() => store.save(oversized)).toThrow(/UTF-8/);
    expect(() => store.restore(JSON.stringify(oversized))).toThrow(/UTF-8/);
    await expect(
      readBackupFile(new Blob([JSON.stringify(oversized)])),
    ).rejects.toThrow(/UTF-8/);
    expect(m.values).toEqual(before);
  });
});
