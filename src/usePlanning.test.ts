import { afterEach, describe, expect, it, vi } from "vitest";
// Deterministic hook lifecycle harness; no browser GPU or model is started.
const fixture = vi.hoisted(() => ({
  setters: [] as ReturnType<typeof vi.fn>[],
  cleanups: [] as (() => void)[],
  load: vi.fn(),
  propose: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("react", () => ({
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => {
    const setter = vi.fn();
    fixture.setters.push(setter);
    return [typeof value === "function" ? value() : value, setter];
  },
  useEffect: (effect: () => () => void) => {
    fixture.cleanups.push(effect());
  },
}));
vi.mock("./ai", () => ({
  loadModel: fixture.load,
  propose: fixture.propose,
  cancelInference: fixture.cancel,
}));
import { usePlanning } from "./usePlanning";
import { seed } from "./domain";
afterEach(() => {
  fixture.setters = [];
  fixture.cleanups = [];
  vi.clearAllMocks();
});
const updates = () =>
  fixture.setters.reduce((n, s) => n + s.mock.calls.length, 0);
describe("planner route lifecycle", () => {
  it("unmount cancels generation and ignores a late proposal without saving", async () => {
    let finish!: (value: unknown) => void;
    fixture.propose.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const save = vi.fn();
    const planning = usePlanning(
      seed(),
      new Date("2026-10-19T00:00:00Z"),
      save,
    );
    const pending = planning.plan();
    expect(fixture.propose).toHaveBeenCalledOnce();
    fixture.cleanups[0]();
    expect(fixture.cancel).toHaveBeenCalledOnce();
    const count = updates();
    finish({ summary: "late", blocks: [], latencyMs: 2, modelId: "fixture" });
    await pending;
    expect(updates()).toBe(count);
    expect(save).not.toHaveBeenCalled();
  });
  it("unmount suppresses obsolete model progress/completion and does not cancel an idle engine", async () => {
    let finish!: (value: unknown) => void;
    let progress!: (text: string) => void;
    fixture.load.mockImplementationOnce((callback) => {
      progress = callback;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const planning = usePlanning(
      seed(),
      new Date("2026-10-19T00:00:00Z"),
      vi.fn(),
    );
    const pending = planning.enable();
    fixture.cleanups[0]();
    const count = updates();
    progress("obsolete");
    finish({ loadMs: 2 });
    await pending;
    expect(updates()).toBe(count);
    expect(fixture.cancel).not.toHaveBeenCalled();
  });
  it("explicit cancellation still clears busy state when its promise settles", async () => {
    let reject!: (reason: Error) => void;
    fixture.propose.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const planning = usePlanning(
      seed(),
      new Date("2026-10-19T00:00:00Z"),
      vi.fn(),
    );
    const pending = planning.plan();
    planning.cancel();
    fixture.setters[4].mockClear();
    reject(new Error("canceled"));
    await pending;
    expect(fixture.cancel).toHaveBeenCalledOnce();
    expect(fixture.setters[4]).toHaveBeenLastCalledWith(false);
  });
});
