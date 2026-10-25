import { describe, it, expect } from "vitest";
import {
  seed,
  parseState,
  serializeState,
  validateState,
  KEY,
} from "../domain";
import {
  putBlock,
  removeBlock,
  setSessionCompleted,
  setBlockLocked,
  toggleAssignment,
  applyProposal,
} from "../academic";
import { WorkspaceStore } from "../storage";
import { createBackupBlob, readBackupFile } from "../backup";
import { scheduleOrbs } from "./adapter";
import { CREATION_SECONDS, createOrbLifecycle } from "../world/orbLifecycle";
import { projectOrbs } from "../world/orbLayer";
import { PerspectiveCamera, Vector3 } from "three";

const now = "2099-01-01T12:00";
function memory(raw = serializeState(seed())) {
  const values = new Map<string, string>([[KEY, raw]]);
  const store = new WorkspaceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  });
  return { values, store };
}
describe("versioned session semantics", () => {
  it("migrates real v2 bytes without losing IDs, wall-clock data, metadata or assignment history", () => {
    const old = { ...seed(), schemaVersion: 2, metadata: { note: "演習 🌙" } };
    old.assignments[0].completed = true;
    const raw = JSON.stringify(old),
      { store, values } = memory(raw);
    expect(values.get(KEY)).toBe(raw);
    expect(store.snapshot.state.schemaVersion).toBe(3);
    expect(store.snapshot.state.blocks).toEqual(old.blocks);
    expect(scheduleOrbs(store.snapshot.state, now)[0].completed).toBe(false);
    store.save(setSessionCompleted(store.snapshot.state, "b6", true));
    expect(store.exportLegacy()).toBe(raw);
    expect(values.get(KEY + ".schema-v2")).toBe(raw);
    const undone = store.undo();
    expect(
      undone.blocks.find((b) => b.id === "b6")!.sessionCompleted,
    ).toBeUndefined();
    expect(undone.assignments[0].completed).toBe(true);
    expect(store.exportLegacy()).toBe(raw);
  });
  it("session completion leaves assignment, time, conflict occupation and estimated work intact", () => {
    const state = seed(),
      block = state.blocks.find((b) => b.id === "b6")!;
    const next = setSessionCompleted(state, block.id, true);
    expect(next.assignments).toEqual(state.assignments);
    expect(next.blocks.find((b) => b.id === block.id)).toEqual({
      ...block,
      sessionCompleted: true,
    });
    expect(() => putBlock(next, { ...block, id: "overlap" })).toThrow(
      /overlaps/,
    );
    expect(() =>
      putBlock(next, {
        ...next.blocks.find((b) => b.id === block.id)!,
        start: block.start.slice(0, 11) + "15:00",
        end: block.end.slice(0, 11) + "16:00",
      }),
    ).toThrow(/reopen/);
    expect(
      setSessionCompleted(next, block.id, false).assignments[0].completed,
    ).toBe(false);
    const assignmentDone = toggleAssignment(state, "a1");
    expect(scheduleOrbs(assignmentDone, now)[0].completed).toBe(false);
  });
  it("locks block rescheduling/deletion but allow separate session completion and explicit unlocking", () => {
    const state = setBlockLocked(seed(), "b6", true),
      block = state.blocks.find((b) => b.id === "b6")!;
    expect(() => removeBlock(state, "b6")).toThrow(/Unlock/);
    expect(() =>
      putBlock(state, {
        ...block,
        start: block.start.slice(0, 11) + "15:00",
        end: block.end.slice(0, 11) + "16:00",
      }),
    ).toThrow(/Unlock/);
    expect(
      setSessionCompleted(state, "b6", true).blocks.find((b) => b.id === "b6")!
        .locked,
    ).toBe(true);
    expect(
      removeBlock(setBlockLocked(state, "b6", false), "b6").blocks,
    ).toHaveLength(5);
    expect(() => putBlock(state, { ...block, locked: false })).toThrow(
      /operation/,
    );
  });
  it("rejects malformed/ambiguous status, missing IDs and unsupported schemas", () => {
    const state = seed();
    expect(() =>
      parseState(
        JSON.stringify({
          ...state,
          schemaVersion: 2,
          blocks: state.blocks.map((b) => ({ ...b, sessionCompleted: true })),
        }),
      ),
    ).toThrow(/ambiguous/);
    expect(() =>
      parseState(JSON.stringify({ ...state, schemaVersion: 4 })),
    ).toThrow(/version/);
    expect(
      validateState({
        ...state,
        blocks: state.blocks.map((b) => ({ ...b, sessionCompleted: "yes" })),
      }),
    ).not.toEqual([]);
    expect(() => setSessionCompleted(state, "b1", true)).toThrow(
      /Study session/,
    );
    expect(() => setBlockLocked(state, "missing", true)).toThrow(/exists/);
  });
  it("completion and locks round-trip through actual backup paths and preserve stale-tab guards", async () => {
    const { store, values } = memory(),
      stale = new WorkspaceStore({
        getItem: (k) => values.get(k) ?? null,
        setItem: (k, v) => {
          values.set(k, v);
        },
        removeItem: (k) => {
          values.delete(k);
        },
      });
    const done = store.save(
      setSessionCompleted(
        setBlockLocked(store.snapshot.state, "b6", true),
        "b6",
        true,
      ),
    );
    const raw = await readBackupFile(createBackupBlob(done));
    expect(parseState(raw)).toEqual(done);
    expect(() => stale.save(stale.snapshot.state)).toThrow(/another tab/);
    const restored = memory().store.restore(raw);
    expect(restored.blocks).toEqual(done.blocks);
  });
  it("keeps a v2 primary unchanged if preserving the migration snapshot fails", () => {
    const raw = JSON.stringify({ ...seed(), schemaVersion: 2 });
    const values = new Map([[KEY, raw]]);
    const store = new WorkspaceStore({
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => {
        if (k.endsWith(".schema-v2")) throw Error("quota");
        values.set(k, v);
      },
      removeItem: (k) => {
        values.delete(k);
      },
    });
    expect(() =>
      store.save(setSessionCompleted(store.snapshot.state, "b6", true)),
    ).toThrow(/quota/);
    expect(values.get(KEY)).toBe(raw);
    expect(store.snapshot.state.revision).toBe(0);
  });
});
describe("academic snapshot to constellation", () => {
  it("ignores model-injected session status and locks at proposal application", () => {
    const state = seed(),
      day = state.blocks[0].start.slice(0, 10);
    const next = applyProposal(state, {
      summary: "",
      blocks: [
        {
          assignmentId: "a2",
          start: day + "T15:00",
          end: day + "T16:00",
          sessionCompleted: true,
          locked: true,
        } as never,
      ],
    });
    const block = next.blocks.at(-1)!;
    expect(block.sessionCompleted).toBeUndefined();
    expect(block.locked).toBeUndefined();
  });
  it("projects correct keyboard/mouse hit targets immediately after a static camera change", () => {
    const camera = new PerspectiveCamera(43, 1.6, 0.2, 140);
    camera.position.set(0, 7, 26);
    camera.lookAt(0, 6, 0);
    camera.updateMatrixWorld();
    camera.position.set(10, 8, 23);
    camera.lookAt(-3, 6, 0);
    const point = new Vector3(0, 6, 0);
    const targets = projectOrbs(new Map([["session", point]]), camera);
    const expected = point.clone().project(camera);
    expect(targets[0].x).toBeCloseTo((expected.x + 1) * 50, 8);
    expect(targets[0].y).toBeCloseTo((1 - expected.y) * 50, 8);
    // World center is to the right of this camera's intentionally offset aim.
    expect(targets[0].x).toBeGreaterThan(55);
  });
  it("produces one stable orb per real linked session, retains past unfinished sessions, excludes classes", () => {
    const state = seed();
    const before = JSON.stringify(state),
      nodes = scheduleOrbs(state, now);
    expect(nodes.map((n) => n.id)).toEqual(["b6"]);
    expect(nodes[0].overdue).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
    expect(scheduleOrbs(parseState(serializeState(state)), now)).toEqual(nodes);
  });
  it("approval adds exactly one node, rescheduling preserves ID and changes angle, undo reconstructs the original", () => {
    const { store } = memory();
    const original = scheduleOrbs(store.snapshot.state, now);
    const day = store.snapshot.state.blocks[0].start.slice(0, 10);
    const proposed = applyProposal(store.snapshot.state, {
      summary: "approved",
      blocks: [
        { assignmentId: "a2", start: day + "T15:00", end: day + "T16:00" },
      ],
    });
    const saved = store.save(proposed),
      added = scheduleOrbs(saved, now).find((n) => n.id !== "b6")!;
    expect(scheduleOrbs(saved, now)).toHaveLength(2);
    const block = saved.blocks.find((b) => b.id === added.id)!;
    const moved = store.save(
      putBlock(saved, { ...block, start: day + "T16:00", end: day + "T17:00" }),
    );
    expect(
      scheduleOrbs(moved, now).find((n) => n.id === added.id)!.angle,
    ).not.toBe(added.angle);
    expect(scheduleOrbs(store.undo(), now)).toEqual(scheduleOrbs(saved, now));
    expect(original).toHaveLength(1);
  });
  it("handles empty and crowded multi-week schedules deterministically without duplicate identities", () => {
    const state = seed();
    state.blocks = [];
    expect(scheduleOrbs(state, now)).toEqual([]);
    const source = seed().blocks.find((b) => b.id === "b6")!;
    state.assignments[0].dueDate = "2033-12-31T23:00";
    state.assignments[0].estimatedMinutes = 10080;
    state.blocks = Array.from({ length: 300 }, (_, i) => {
      const day = new Date(Date.UTC(2026, 10, 2 + i * 7))
        .toISOString()
        .slice(0, 10);
      return {
        ...source,
        id: `session-${i}`,
        start: day + "T13:00",
        end: day + "T13:15",
      };
    });
    expect(validateState(state)).toEqual([]);
    const nodes = scheduleOrbs(state, now);
    expect(new Set(nodes.map((n) => n.id)).size).toBe(300);
    expect(Math.max(...nodes.map((n) => n.spread))).toBeLessThan(0.7);
    expect(
      new Set(nodes.map((n) => `${n.angle}:${n.spread}:${n.radialOffset}`))
        .size,
    ).toBeGreaterThan(100);
    expect(
      scheduleOrbs({ ...state, blocks: state.blocks.slice().reverse() }, now),
    ).toEqual(nodes);
  });
});
describe("interruptible committed-snapshot lifecycle", () => {
  const node = scheduleOrbs(seed(), now)[0];
  it("starts with no arrivals and uses exactly one creation after a committed addition", () => {
    const life = createOrbLifecycle([node]);
    expect(life.sample(0).effects).toEqual([]);
    const added = { ...node, id: "new" };
    life.update([node, added], null, 1, false);
    life.update([node, added], null, 1.1, false);
    expect(life.sample(1.1).effects).toMatchObject([
      { id: "new", kind: "creation" },
    ]);
    expect(life.sample(1.1).count).toBe(1);
  });
  it("distinguishes completion from deletion and replaces interrupted transitions on undo/recreate", () => {
    const life = createOrbLifecycle([node]);
    life.update([{ ...node, completed: true }], null, 1, false);
    expect(life.sample(1).effects[0].kind).toBe("completion");
    life.update([node], null, 1.2, false);
    expect(life.sample(1.2).effects).toMatchObject([{ kind: "creation" }]);
    life.update([], null, 1.3, false);
    expect(life.sample(1.3).effects).toMatchObject([{ kind: "deletion" }]);
    life.update([node], null, 1.4, false);
    expect(life.sample(1.4).effects).toHaveLength(1);
    expect(life.sample(1.4 + CREATION_SECONDS + 0.01).effects).toEqual([]);
  });
  it("moves the same ID, avoids initial/quiet effects and never replays effects after recovery", () => {
    const life = createOrbLifecycle([node]);
    life.update([{ ...node, angle: 2 }], node.id, 1, false);
    expect(life.sample(1).effects[0]).toMatchObject({
      id: node.id,
      kind: "move",
      from: { angle: node.angle },
      to: { angle: 2 },
    });
    life.update([node], node.id, 1.1, true);
    expect(life.sample(1.1).effects).toEqual([]);
    const recovered = createOrbLifecycle([node], node.id);
    expect(recovered.sample(0).count).toBe(0);
  });
  it("bounds rapid lifecycle bursts without dropping the authoritative current snapshot", () => {
    const life = createOrbLifecycle([]);
    const nodes = Array.from({ length: 80 }, (_, i) => ({
      ...node,
      id: String(i),
    }));
    life.update(nodes, null, 1, false);
    expect(life.sample(1).effects).toHaveLength(48);
    expect(life.sample(1).count).toBe(80);
    life.update(nodes, null, 1.2, false);
    expect(life.sample(1.2).count).toBe(80);
  });
});
