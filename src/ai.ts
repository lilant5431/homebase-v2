import { parseIntent } from "./planningIntent";
import type { MLCEngineInterface } from "@mlc-ai/web-llm";

export const MODEL_ID = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";
export const MODEL_INFO = {
  parameters: "1.5 billion",
  estimatedDownloadMB: 880,
  requiredVRAMMB: 1629.75,
};
export type AIContext = {
  assignments: {
    id: string;
    title: string;
    dueDate?: string;
    estimatedMinutes?: number;
  }[];
  blocks: { assignmentId?: string; start: string; end: string }[];
  weekStart?: string;
};
export type AIProposal = {
  blocks: { assignmentId: string; start: string; end: string }[];
  summary: string;
  latencyMs: number;
  modelId: string;
};
export class AIOutputError extends Error {
  constructor(
    message: string,
    public rawOutput: string,
    public latencyMs: number,
  ) {
    super(message);
  }
}
let engine: MLCEngineInterface | undefined;
let worker: Worker | undefined;
let loading: Promise<{ modelId: string; loadMs: number }> | undefined;
let status = "Model not loaded";
let generation = 0;
let busy = false;
let rejectCurrent: ((reason: Error) => void) | undefined;
export function getAIStatus() {
  return {
    loaded: !!engine,
    loading: !!loading,
    busy,
    status,
    modelId: MODEL_ID,
  };
}

export async function loadModel(onProgress: (text: string) => void = () => {}) {
  if (engine) return { modelId: MODEL_ID, loadMs: 0 };
  if (loading) return loading;
  loading = (async () => {
    const start = performance.now();
    if (!window.isSecureContext)
      throw new Error("Local AI requires HTTPS or localhost.");
    const gpu = (
      navigator as Navigator & {
        gpu?: {
          requestAdapter(): Promise<{
            features: { has(feature: string): boolean };
          } | null>;
        };
      }
    ).gpu;
    if (!gpu)
      throw new Error(
        "WebGPU is unavailable in this browser. Manual scheduling remains available.",
      );
    const adapter = await gpu.requestAdapter();
    if (!adapter)
      throw new Error(
        "No WebGPU adapter is available. Try a current Chrome or Edge browser with hardware acceleration.",
      );
    if (!adapter.features.has("shader-f16"))
      throw new Error(
        "This GPU does not support shader-f16, required by the selected model.",
      );
    const { CreateWebWorkerMLCEngine } = await import("@mlc-ai/web-llm");
    worker = new Worker(new URL("./ai.worker.ts", import.meta.url), {
      type: "module",
    });
    const candidate = worker;
    let acceptingProgress = true;
    let rejectStartup!: (error: Error) => void;
    const startupFailure = new Promise<never>((_, reject) => {
      rejectStartup = reject;
    });
    const onError = (event: Event) => {
      event.preventDefault();
      const detail =
        "message" in event && typeof event.message === "string"
          ? ` ${event.message}`
          : "";
      rejectStartup(
        new Error(
          `Local AI worker failed to initialize.${detail} Try enabling AI again.`,
        ),
      );
    };
    const onMessageError = () =>
      rejectStartup(
        new Error(
          "Local AI worker could not read an initialization message. Try enabling AI again.",
        ),
      );
    candidate.addEventListener("error", onError);
    candidate.addEventListener("messageerror", onMessageError);
    try {
      engine = await Promise.race([
        startupFailure,
        CreateWebWorkerMLCEngine(candidate, MODEL_ID, {
          initProgressCallback: (report) => {
            if (!acceptingProgress) return;
            status = report.text;
            onProgress(report.text);
          },
        }),
      ]);
    } finally {
      acceptingProgress = false;
      candidate.removeEventListener("error", onError);
      candidate.removeEventListener("messageerror", onMessageError);
    }
    status = "Ready · running on this device";
    onProgress(status);
    return { modelId: MODEL_ID, loadMs: Math.round(performance.now() - start) };
  })();
  try {
    return await loading;
  } catch (error) {
    worker?.terminate();
    worker = undefined;
    engine = undefined;
    status = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    loading = undefined;
  }
}

/** Cancellation invalidates the result, even if GPU work finishes before interruption. */
export function cancelInference() {
  generation++;
  if (busy) engine?.interruptGenerate();
  rejectCurrent?.(new Error("Planning canceled."));
  status = "Canceled";
}

export async function propose(
  state: AIContext,
  request: string,
): Promise<AIProposal> {
  if (!engine)
    throw new Error("Load the local model before requesting a proposal.");
  if (busy) throw new Error("A local planning request is already running.");
  if (!request.trim())
    throw new Error("Describe what you would like to schedule.");
  if (!state.assignments.length)
    throw new Error("Add an assignment before requesting a plan.");
  if (
    state.assignments.length > 20 ||
    state.blocks.length > 60 ||
    request.length > 1500
  )
    throw new Error(
      "For this small model, use at most 20 assignments, 60 blocks, and a request under 1,500 characters.",
    );
  const intent = parseIntent(request, state.assignments);
  const token = ++generation;
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["summary", "blocks"],
    properties: {
      blocks: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["assignmentId", "start", "end"],
          properties: {
            assignmentId: {
              type: "string",
              enum: state.assignments.map((a) => a.id),
            },
            start: {
              type: "string",
              pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$",
            },
            end: {
              type: "string",
              pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$",
            },
          },
        },
      },
      summary: { type: "string", maxLength: 180 },
    },
  };
  busy = true;
  status = "Planning on your device";
  const start = performance.now();
  try {
    const canceled = new Promise<never>((_, reject) => {
      rejectCurrent = reject;
    });
    const result = await Promise.race([
      canceled,
      engine.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You propose academic study blocks. Return JSON only, with summary and blocks. Every block has assignmentId, start, end. Use exact assignment IDs and local ISO timestamps YYYY-MM-DDTHH:mm. Respect deadlines, existing busy blocks, and the user request. Add only new blocks; do not move existing blocks. Use exactly one block with the structured intent assignment ID, date, allowed window, and exact duration. Never copy an occupied block. Do not add other assignments. If no valid plan exists return an empty blocks array and explain why. The output is only a proposal awaiting deterministic validation and human approval.",
          },
          {
            role: "user",
            content: `Verified scheduling intent: ${JSON.stringify(intent)}\nAssignments: ${JSON.stringify(state.assignments)}\nAlready occupied times (NEVER copy these into the proposal): ${JSON.stringify(state.blocks)}\nWeek starts: ${state.weekStart || "use dates from request"}\nUSER REQUEST: ${request}\nReturn only new study blocks satisfying this request. Calculate the end time from the requested duration.`,
          },
        ],
        temperature: 0,
        max_tokens: 700,
        response_format: {
          type: "json_object",
          schema: JSON.stringify(schema),
        },
      }),
    ]);
    if (token !== generation) throw new Error("Planning canceled.");
    if (result.choices[0]?.finish_reason === "length")
      throw new AIOutputError(
        "The local model reached its output limit. Try planning fewer assignments.",
        result.choices[0]?.message.content || "",
        Math.round(performance.now() - start),
      );
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.choices[0]?.message.content || "");
    } catch {
      throw new AIOutputError(
        "The local model returned incomplete JSON. Try the request again; no changes were saved.",
        result.choices[0]?.message.content || "",
        Math.round(performance.now() - start),
      );
    }
    if (!parsed || typeof parsed !== "object")
      throw new Error("The model returned an invalid proposal.");
    const proposal = parsed as { summary?: unknown; blocks?: unknown };
    if (
      typeof proposal.summary !== "string" ||
      !Array.isArray(proposal.blocks) ||
      proposal.blocks.length > 10 ||
      proposal.blocks.some(
        (b) =>
          !b ||
          typeof b.assignmentId !== "string" ||
          typeof b.start !== "string" ||
          typeof b.end !== "string",
      )
    )
      throw new Error("The model output did not match the proposal schema.");
    status = "Proposal ready for validation";
    return {
      summary: proposal.summary,
      blocks: proposal.blocks,
      latencyMs: Math.round(performance.now() - start),
      modelId: MODEL_ID,
    };
  } catch (error) {
    status = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    if (token !== generation) {
      worker?.terminate();
      worker = undefined;
      engine = undefined;
    }
    rejectCurrent = undefined;
    busy = false;
  }
}
