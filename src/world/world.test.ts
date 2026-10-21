import { afterEach, describe, expect, it, vi } from "vitest";
import { startWorldSession } from "./session";
import { createWorld } from "./renderer";
import { recordWorld } from "./recording";
import type { WebGLRenderer } from "three";
import type { WorldController, WorldHooks, WorldMetrics } from "./contract";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const hooks = (): WorldHooks => ({ metrics: vi.fn(), error: vi.fn() });
const canvas = () => new EventTarget() as unknown as HTMLCanvasElement;
const controller = (): WorldController => ({
  update: vi.fn(),
  dispose: vi.fn(),
  loseContext: vi.fn(),
});

describe("optional world lifecycle", () => {
  it("never initializes a late renderer after navigation or strict-mode cleanup", async () => {
    let resolve!: (module: { createWorld: typeof factory }) => void;
    const factory = vi.fn(() => controller());
    const loading = new Promise<{ createWorld: typeof factory }>((done) => {
      resolve = done;
    });
    const session = startWorldSession(canvas(), hooks(), () => loading);
    session.dispose();
    resolve({ createWorld: factory });
    await session.ready;
    expect(factory).not.toHaveBeenCalled();
  });
  it("reports import and construction failures without rejecting into the UI", async () => {
    const first = hooks();
    await startWorldSession(canvas(), first, () =>
      Promise.reject(new Error("module unavailable")),
    ).ready;
    expect(first.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: "module unavailable" }),
    );
    const failedConstruction = hooks();
    await startWorldSession(canvas(), failedConstruction, async () => ({
      createWorld() {
        throw new Error("GPU initialization failed");
      },
    })).ready;
    expect(failedConstruction.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: "GPU initialization failed" }),
    );
    const retry = hooks(),
      good = controller();
    const session = startWorldSession(canvas(), retry, async () => ({
      createWorld: () => good,
    }));
    await session.ready;
    session.update({ area: "planning", emphasis: true, reducedMotion: true });
    expect(good.update).toHaveBeenCalledWith({
      area: "planning",
      emphasis: true,
      reducedMotion: true,
    });
    expect(retry.error).not.toHaveBeenCalled();
    session.dispose();
  });
  it("disposes a constructed session and ignores all stale telemetry/errors", async () => {
    const callbacks = hooks(),
      good = controller();
    let rendererHooks!: WorldHooks;
    const session = startWorldSession(canvas(), callbacks, async () => ({
      createWorld: (_canvas, value) => {
        rendererHooks = value;
        return good;
      },
    }));
    await session.ready;
    session.dispose();
    session.dispose();
    rendererHooks.metrics({} as WorldMetrics);
    rendererHooks.error(new Error("late shader error"));
    expect(good.dispose).toHaveBeenCalledTimes(1);
    expect(callbacks.metrics).not.toHaveBeenCalled();
    expect(callbacks.error).not.toHaveBeenCalled();
  });
  it("releases the allocated WebGL renderer when initialization fails", () => {
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("document", new EventTarget());
    const allocated = {
      setAnimationLoop: vi.fn(),
      dispose: vi.fn(),
      forceContextLoss: vi.fn(),
    };
    expect(() =>
      createWorld(
        canvas(),
        hooks(),
        true,
        undefined,
        () => allocated as unknown as WebGLRenderer,
      ),
    ).toThrow("Injected renderer initialization failure");
    expect(allocated.setAnimationLoop).toHaveBeenCalledWith(null);
    expect(allocated.dispose).toHaveBeenCalledTimes(1);
    expect(allocated.forceContextLoss).toHaveBeenCalledTimes(1);
  });
  it("fails explicitly and releases resources when HDR targets are unsupported", () => {
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("document", new EventTarget());
    const allocated = {
      getContext: () => ({ getExtension: () => null }),
      setAnimationLoop: vi.fn(),
      dispose: vi.fn(),
      forceContextLoss: vi.fn(),
    };
    expect(() =>
      createWorld(
        canvas(),
        hooks(),
        false,
        undefined,
        () => allocated as unknown as WebGLRenderer,
      ),
    ).toThrow("requires HDR half-float");
    expect(allocated.dispose).toHaveBeenCalledTimes(1);
    expect(allocated.forceContextLoss).toHaveBeenCalledTimes(1);
  });
  it("passes the latest reduced-motion/area state into a delayed renderer before its first frame", async () => {
    let resolve!: (module: { createWorld: typeof factory }) => void;
    const factory = vi.fn(() => controller());
    const loading = new Promise<{ createWorld: typeof factory }>((done) => {
      resolve = done;
    });
    const session = startWorldSession(canvas(), hooks(), () => loading);
    session.update({
      area: "assignments",
      emphasis: false,
      reducedMotion: true,
    });
    resolve({ createWorld: factory });
    await session.ready;
    expect(factory).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      false,
      { area: "assignments", emphasis: false, reducedMotion: true },
    );
    session.dispose();
  });
});

describe("decorative canvas recording", () => {
  it("reports unsupported recording rather than touching any application data", () => {
    vi.stubGlobal("MediaRecorder", undefined);
    expect(() => recordWorld(canvas())).toThrow("unavailable");
  });
  it("stops capture tracks if the recorder fails to initialize", () => {
    const stop = vi.fn();
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }
        constructor() {
          throw new Error("recorder allocation failed");
        }
      },
    );
    const source = {
      captureStream: () => ({ getTracks: () => [{ stop }] }),
    } as unknown as HTMLCanvasElement;
    expect(() => recordWorld(source)).toThrow("recorder allocation failed");
    expect(stop).toHaveBeenCalledTimes(1);
  });
  it("cancels pending recording on navigation and rejects without a download", async () => {
    vi.useFakeTimers();
    const stop = vi.fn();
    const recorderStop = vi.fn();
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }
        state = "recording";
        start() {}
        stop() {
          recorderStop();
          this.state = "inactive";
        }
      },
    );
    const source = {
      captureStream: () => ({ getTracks: () => [{ stop }] }),
    } as unknown as HTMLCanvasElement;
    const capture = recordWorld(source);
    capture.cancel();
    await expect(capture.finished).rejects.toThrow("cancelled");
    expect(stop).toHaveBeenCalledTimes(1);
    expect(recorderStop).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
