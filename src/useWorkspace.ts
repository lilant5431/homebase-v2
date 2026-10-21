import { useRef, useState } from "react";
import { type State } from "./domain";
import { WorkspaceStore, withWorkspaceWriteLock } from "./storage";
import { createBackupBlob } from "./backup";

export function useWorkspace() {
  const [store] = useState(
    () =>
      new WorkspaceStore({
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => localStorage.setItem(key, value),
        removeItem: (key) => localStorage.removeItem(key),
      }),
  );
  const [state, setState] = useState(store.snapshot.state);
  const [notice, setNotice] = useState(store.snapshot.error);
  const saving = useRef(false);
  const readOnly = typeof navigator.locks?.request !== "function";
  async function mutate(operation: () => State): Promise<boolean> {
    if (saving.current) {
      setNotice("A save is already in progress. Try again.");
      return false;
    }
    saving.current = true;
    try {
      // Snapshot checks reject stale candidates inside the exclusive lock.
      // Without Web Locks, fail before any operation or storage write executes.
      const execute = () => {
        const next = operation();
        setState(next);
        return true;
      };
      const result = await withWorkspaceWriteLock(navigator.locks, execute);
      setNotice("Saved on this device");
      return result;
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : "Storage is unavailable. Export a backup to protect your work.",
      );
      return false;
    } finally {
      saving.current = false;
    }
  }
  const save = (next: State) => mutate(() => store.save(next, next.revision));
  const undo = async () => {
    if (await mutate(() => store.undo())) setNotice("Previous save restored");
  };
  const restore = async (raw: string, revision: number) => {
    if (await mutate(() => store.restore(raw, revision)))
      setNotice("Backup restored. Undo last save is available.");
  };
  function exportData(recovery = false) {
    try {
      // Recovery is a verbatim diagnostic copy, exempt from normal-backup limits.
      const blob = recovery
        ? new Blob([store.exportRecovery()], { type: "application/json" })
        : createBackupBlob(state);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `homebase-${recovery ? "recovery" : "backup"}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
  }
  return {
    state,
    notice,
    setNotice,
    save,
    undo,
    restore,
    exportData,
    readOnly,
  };
}
