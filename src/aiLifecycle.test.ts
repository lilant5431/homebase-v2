import { describe, it, expect, vi, afterEach } from "vitest";
// Deterministic worker/engine fixture. These tests are NOT model inference.
const fake = vi.hoisted(() => ({
  create: vi.fn(),
  interrupt: vi.fn(),
  reset: vi.fn(),
  load: vi.fn(),
}));
vi.mock("@mlc-ai/web-llm", () => ({ CreateWebWorkerMLCEngine: fake.load }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.resetModules();
});
describe("AI worker lifecycle (deterministic fixture)", () => {
  function browser() {
    vi.stubGlobal("window", { isSecureContext: true });
    vi.stubGlobal("navigator", {
      gpu: { requestAdapter: async () => ({ features: { has: () => true } }) },
    });
    vi.stubGlobal(
      "Worker",
      class {
        terminate() {}
      },
    );
    fake.load.mockResolvedValue({
      chat: { completions: { create: fake.create } },
      interruptGenerate: fake.interrupt,
      resetChat: fake.reset,
    });
    fake.reset.mockResolvedValue(undefined);
  }
  it("unsupported WebGPU fails without loading an engine", async () => {
    browser();
    vi.stubGlobal("navigator", {});
    const ai = await import("./ai");
    await expect(ai.loadModel()).rejects.toThrow(/WebGPU/);
    expect(fake.load).not.toHaveBeenCalled();
  });
  it("cancel discards late output, retires worker, then allows fresh model loading", async () => {
    browser();
    const ai = await import("./ai");
    await ai.loadModel();
    let finish!: (value: unknown) => void;
    fake.create.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const state = {
      assignments: [{ id: "essay", title: "History essay" }],
      blocks: [],
    };
    const request =
      'Schedule "History essay" on 2026-10-20 at 14:00 for 60 minutes.';
    const pending = ai.propose(state, request);
    const discarded = expect(pending).rejects.toThrow(/canceled/);
    ai.cancelInference();
    finish({
      choices: [
        {
          finish_reason: "stop",
          message: { content: '{"summary":"fixture","blocks":[]}' },
        },
      ],
    });
    await discarded;
    expect(fake.interrupt).toHaveBeenCalledOnce();
    expect(ai.getAIStatus().loaded).toBe(false);
    expect(ai.getAIStatus().busy).toBe(false);
    fake.create.mockResolvedValueOnce({
      choices: [
        {
          finish_reason: "stop",
          message: { content: '{"summary":"fixture","blocks":[]}' },
        },
      ],
    });
    await ai.loadModel();
    await expect(ai.propose(state, request)).resolves.toMatchObject({
      summary: "fixture",
      blocks: [],
    });
  });
  it("unsupported extra instructions never call completion", async () => {
    browser();
    const ai = await import("./ai");
    await ai.loadModel();
    await expect(
      ai.propose(
        { assignments: [{ id: "essay", title: "History essay" }], blocks: [] },
        "Find time tomorrow",
      ),
    ).rejects.toThrow(/Clarification/);
    expect(fake.create).not.toHaveBeenCalled();
  });
});
