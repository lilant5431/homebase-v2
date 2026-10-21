import { commit, KEY, parseState, seed, type State } from "./domain";

export type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type Snapshot = { state: State; raw: string | null; error: string };
export function readWorkspace(storage: StoragePort): Snapshot {
  let raw: string | null = null;
  try {
    raw = storage.getItem(KEY);
    return { state: raw === null ? seed() : parseState(raw), raw, error: "" };
  } catch {
    return {
      state: seed(),
      raw,
      error:
        "Saved data could not be read. Original data is preserved. Use Export recovery data before replacing it.",
    };
  }
}
export class WorkspaceStore {
  snapshot: Snapshot;
  constructor(private storage: StoragePort) {
    this.snapshot = readWorkspace(storage);
  }
  save(next: State, expectedRevision = next.revision): State {
    if (
      this.snapshot.state.revision !== expectedRevision ||
      this.storage.getItem(KEY) !== this.snapshot.raw
    )
      throw Error(
        "This workspace changed in another tab or operation. Reload before saving.",
      );
    const updated = commit(this.snapshot.state, next);
    const raw = JSON.stringify(updated);
    if (raw.length > 5_000_000)
      throw Error(
        "Workspace exceeds the 5 MB backup limit. Export and reduce it before saving.",
      );
    const original = this.snapshot.raw;
    if (original !== null) {
      let readable = true;
      try {
        parseState(original);
      } catch {
        readable = false;
      }
      if (!readable) {
        const old = this.storage.getItem(KEY + ".recovery");
        if (old !== null && old !== original)
          this.storage.setItem(KEY + ".recovery." + crypto.randomUUID(), old);
        this.storage.setItem(KEY + ".recovery", original);
      }
    }
    // All recovery writes precede the primary write. Failure leaves the visible
    // snapshot and original primary data unchanged; never report partial success.
    const oldRollback = this.storage.getItem(KEY + ".rollback");
    this.storage.setItem(
      KEY + ".rollback",
      JSON.stringify(this.snapshot.state),
    );
    try {
      this.storage.setItem(KEY, raw);
    } catch (error) {
      // Best-effort compensation preserves the prior undo target after a quota
      // failure. Recovery records remain intentionally retained.
      try {
        if (oldRollback === null) this.storage.removeItem(KEY + ".rollback");
        else this.storage.setItem(KEY + ".rollback", oldRollback);
      } catch {
        /* primary state is still intact */
      }
      throw error;
    }
    this.snapshot = { state: updated, raw, error: "" };
    return updated;
  }
  restore(raw: string, revision = this.snapshot.state.revision) {
    return this.save(parseState(raw), revision);
  }
  undo() {
    const raw = this.storage.getItem(KEY + ".rollback");
    if (raw === null) throw Error("No previous save is available.");
    return this.save(parseState(raw), this.snapshot.state.revision);
  }
  exportRecovery() {
    if (this.snapshot.error && this.snapshot.raw !== null)
      return this.snapshot.raw;
    const raw = this.storage.getItem(KEY + ".recovery");
    if (raw === null) throw Error("No unreadable recovery data is available.");
    return raw;
  }
}
