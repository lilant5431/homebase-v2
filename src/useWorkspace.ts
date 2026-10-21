import { useRef, useState } from "react";
import { KEY, type State } from "./domain";
import { WorkspaceStore } from "./storage";

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
  async function mutate(operation: () => State): Promise<boolean> {
    if (saving.current) {
      setNotice("A save is already in progress. Try again.");
      return false;
    }
    saving.current = true;
    try {
      // Web Locks serialize cooperating tabs. The raw snapshot comparison also
      // detects stale writes and remains active when Web Locks are unavailable.
      const execute = () => {
        const next = operation();
        setState(next);
        return true;
      };
      const result = navigator.locks
        ? await navigator.locks.request(KEY, execute)
        : execute();
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
      const raw = recovery
        ? store.exportRecovery()
        : JSON.stringify(state, null, 2);
      const url = URL.createObjectURL(
        new Blob([raw], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `homebase-${recovery ? "recovery" : "backup"}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
  }
  return { state, notice, setNotice, save, undo, restore, exportData };
}
