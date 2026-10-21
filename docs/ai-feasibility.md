# Browser-local AI feasibility

## Stabilization — October 20, 2026

The model is unchanged. A fully anchored request grammar now yields one assignment, date, exact start or window, and duration. Unsupported or ambiguous text asks for clarification before inference. The worker receives those constraints; approval independently checks them plus the shared calendar validator. This deliberately does not support arbitrary scheduling language.

Fresh actual WebLLM sample (Windows Chrome 155): model load **5,218 ms** with cache state unknown. Exact session: **12,228 ms**, JSON/domain/explicit instruction checks pass. 90-minute window: **1,573 ms**, JSON valid but a 240-minute answer fails both workload and duration checks. Busy requested slot: **2,003 ms**, JSON and literal time/duration match, but domain conflict blocks approval. Thus **3/3 JSON valid, 1/3 domain-valid, 2/3 literal instruction-correct, 1/3 approvable**. Literal instruction correctness here measures assignment/day/window/duration; busy-time safety is reported separately under domain validity. This is a small sample, not an accuracy improvement claim.

Two additional requests (ambiguous and an unsupported extra instruction) were rejected before inference. A **deterministic fixture**, not live inference, replayed the old domain-valid 60-minute response to a 90-minute request and was blocked by intent validation. [Raw labeled results](../scripts/ai-stabilization-results.json) distinguish actual inference, clarification, and fixtures. The evaluator page now reproduces these cases and reports JSON validity, domain validity, instruction correctness and approval eligibility separately. Original observations below are historical and used the earlier prompt; mobile/physical iPhone inference remains untested.

The prototype uses `@mlc-ai/web-llm` 0.2.83 and `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` (approximately 1.5 billion parameters, 4-bit weights). Inference runs in `src/ai.worker.ts`; no cloud completion API or mock completion path exists. First use downloads public model artifacts, so first-run setup is not offline.

The [model repository](https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC/tree/main) lists 880 MB of files; runtime Wasm/cache overhead is additional. Installed WebLLM configuration estimates 1629.75 MB VRAM. The prototype checks `shader-f16` before loading its selected f16 variant. The [worker API](https://webllm.mlc.ai/docs/user/advanced_usage.html) keeps inference work separate from the interface.

## Reproduce

Run `npm ci`, `npx vite --config scripts/ai-eval.config.ts`, and open `http://localhost:5176/scripts/ai-eval.html` in a WebGPU browser. The isolated server disables hot reload to protect measurements while source files change. Click **Run stabilized scheduling evaluation**. The page reports raw model output and separate validity/intent checks. This is a small feasibility sample, not an accuracy benchmark.

Fixture: history essay due October 23 (120 minutes), calculus set due October 22 (90 minutes), and an existing Tuesday October 20 10:00–11:00 block. Requests exercise explicit time/duration, time range/deadline, and conflict avoidance. No test output is written into the planner.

## Observations

Test date: October 19, 2026. Windows 10, Chrome 155 in-app browser; secure context and WebGPU available. These figures are device-specific and not guaranteed cold-download times.

Selected model load: **17,562 ms** (download/cache initialization plus GPU setup). The first generation includes grammar/prefill warmup, so it should be distinguished from later requests.

| Request | Generation wall time | JSON shape | Scheduling result |
| --- | ---: | --- | --- |
| History essay, Tuesday 14:00, 60 minutes | 10,139 ms | Pass | Correct: October 20, 14:00–15:00 |
| Calculus, Wednesday after 13:00/before 17:00, 90 minutes | 2,084 ms | Pass | Correct assignment/day/range; wrong duration: 14:30–15:30 (60 minutes) |
| History Tuesday 10:00, move to next morning hour if occupied | 3,336 ms | Pass | Incorrect: conflicts with occupied 10:00–11:00; adds an unrequested calculus block |

**3/3 matched the JSON shape, 2/3 avoided fixture conflicts, and only 1/3 fully followed the request.** This demonstrates real local inference and an end-to-end viable proposal, but the model is not reliable enough for automatic planning. The UI must describe it as experimental and require preview/approval. Deterministic validation rejects conflicts, bad dates, missing assignments, deadlines, and excessive total work; it cannot prove free-form intent was followed (the 90-minute mismatch illustrates this limit).

Raw selected-model output is retained in `scripts/ai-eval-results.json`. GPU hardware identity was not collected. Mobile and alternative browsers were not inference-tested. These results do not establish cross-device performance or accuracy.

An additional end-to-end planner run loaded the selected model in 18.9 seconds and correctly proposed Reading response: Modernism on October 20, 14:00–15:00, in 10.6 seconds. The proposal remained separate until explicit approval; the approved event appeared in the calendar. This additional example is not included in the three-case sample above. See [proposal screenshot](screenshots/ai-proposal.png).

An earlier SmolLM2-360M comparison used 207 MB model files and 376.06 MB estimated VRAM. Its initial unbounded-summary schema hit the 700-token cap on the first two requests (13,642 and 7,630 ms). Bounding the summary yielded 3/3 parseable JSON results (3,523 / 968 / 859 ms), but **0/3 met the requests**: two returned multi-day date-only ranges; one scheduled the wrong assignment inside an existing busy block. This is why the larger Qwen candidate was evaluated and why JSON success must not be reported as planning success.

Qwen2.5-0.5B was also tested (290 MB files; 944.62 MB estimated VRAM). Load: 7,882 ms. Generation: 12,388 / 1,004 / 914 ms. All 3 outputs matched JSON shape; all 3 incorrectly copied the occupied 10:00–11:00 slot. The second case chose the correct assignment but ignored both the requested date and 90-minute duration. This model was rejected for the prototype default.

## Boundaries

- JSON grammar constrains shape, not scheduling correctness. Every returned plan must pass the planner's deterministic validator before it can be approved. Generation cannot modify persistence.
- Local model input is limited to 20 assignments, 60 existing blocks, and 1,500 request characters. The library uses a 4,096-token context for this model; output is capped at 700 tokens and 10 proposed blocks.
- HTTPS or localhost, WebGPU, and `shader-f16` are required. Unsupported browsers show an actionable error; manual scheduling stays available. Browser/GPU memory availability and driver support vary. Mobile inference has not been demonstrated.
- The first load needs network access to Hugging Face model files and MLC GitHub-hosted Wasm. Browser cache eviction can require another download. Browser storage is not a backup; use the planner export.
- Cancellation interrupts generation and invalidates a late result. A dedicated worker protects interface responsiveness; device GPU contention can still affect the interface.

The [WebLLM structured-output documentation](https://blog.mlc.ai/2024/06/13/webllm-a-high-performance-in-browser-llm-inference-engine) describes JSON-schema-constrained decoding; semantic validation remains application-owned.
