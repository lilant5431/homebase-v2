import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { captureWorld } from "./capture";
let recorder: FakeRecorder;
class FakeRecorder {
  static isTypeSupported() {
    return true;
  }
  state = "inactive";
  mimeType = "video/webm";
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  onerror?: () => void;
  constructor() {
    recorder = this;
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["frames"]) });
    this.onstop?.();
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("MediaRecorder", FakeRecorder);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function fixture() {
  const stop = vi.fn();
  return {
    stop,
    canvas: {
      captureStream: () => ({ getTracks: () => [{ stop }] }),
    } as unknown as HTMLCanvasElement,
  };
}
it("bounds recording and releases stream/timer exactly once on stop", () => {
  const { stop, canvas } = fixture(),
    finish = vi.fn();
  captureWorld(canvas, finish);
  vi.advanceTimersByTime(60000);
  expect(stop).toHaveBeenCalledOnce();
  expect(finish).toHaveBeenCalledOnce();
  expect(finish.mock.calls[0][0]).toBeInstanceOf(Blob);
  expect(vi.getTimerCount()).toBe(0);
});
it("cancels recording without download or late callbacks after route/context disposal", () => {
  const { stop, canvas } = fixture(),
    finish = vi.fn(),
    capture = captureWorld(canvas, finish);
  capture.cancel();
  capture.cancel();
  recorder.onstop?.();
  vi.advanceTimersByTime(60000);
  expect(stop).toHaveBeenCalledOnce();
  expect(finish).not.toHaveBeenCalled();
});
it("cleans failed initialization and asynchronous recording errors", () => {
  const { stop, canvas } = fixture(),
    finish = vi.fn();
  captureWorld(canvas, finish);
  recorder.onerror?.();
  expect(stop).toHaveBeenCalledOnce();
  expect(finish).toHaveBeenCalledWith(null);
  expect(vi.getTimerCount()).toBe(0);
  vi.stubGlobal(
    "MediaRecorder",
    class extends FakeRecorder {
      constructor() {
        super();
        throw Error("encoder unavailable");
      }
    },
  );
  expect(() => captureWorld(canvas, finish)).toThrow(/encoder/);
  expect(stop).toHaveBeenCalledTimes(2);
});
