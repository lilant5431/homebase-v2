# Electrical energy refinement — V2.3A.1

## Implementation

The pedestal's 96 instruments now feed a deterministic three-branch lattice. Camera-facing HDR shader ribbons contain angular filaments with fixed conductor endpoints, white-hot cores and restrained cyan sheaths. Short localized strikes replace moving heads and Gaussian trails. No new dependency, render target, academic state or storage field was added.

A 4.6-second presentation sequence charges the pedestal and Lumen, discharges to the opposite side of the destination rail, sends two counterpropagating pulses along that rail's actual transformed geometry, then compresses six electrical spokes at the session position before materialization. Existing shared light uniforms coordinate core emission, beacon, receiver, particles and environmental response. Refraction, exposure and bloom settings remain unchanged. Four routed births are the maximum; excess arrivals settle directly. Effects terminate and return to idle; recovery never replays arrivals.

The GPU focus and HTML projection continue to use the same authoritative orb transform each rendered frame. Focus opacity now also matches birth opacity. Scoped responsive CSS corrects inherited planner navigation rules that hid Planning studio and right-aligned the remaining tabs below 760px. At 320px the header wraps deliberately. Academic validation, data formats, locks, undo, local AI and inference approval are unchanged.

## Browser evidence (24 October 2026)

Isolated origin `http://127.0.0.1:43132/#crystal`, disposable 33-session fixture, then two manual saves 45 minutes each. Existing user origins were not modified.

- [58.878-second canvas recording](electrical-lifecycle.webm): pedestal network, directed discharge, ring reception and convergence during two consecutive creations. Inspect around 15s (charge), 42s (discharge), 53–59s (rail/compression). The background browser is throttled; this is sparse motion evidence, not a smooth real-time performance demonstration.
- [Pedestal charge](charging.png), [overlapping event network](discharge.png), [rail reception from recording](rail-reception.png).
- [390×667 fallback](mobile-fallback.png), [1280×500 session controls](short-window.png), [selected static presentation](selection-static.png).
- Both created sessions persisted (35 total). Keyboard rescheduling 06:00→07:00 retained selection and record; undo restored 06:00. Graphics-disabled Assignments and Planning studio remained usable without loading AI. All three navigation buttons were available at 390px and 320px; DOM bounds found no horizontal control overflow. Dialog controls remained reachable through scrolling at short height.
- Injected initialization failure retained scheduling dialog access; retry restored the renderer. Context-loss injection produced the expected fallback and retry recovered 35 sessions without arrival replay. Freeze uses the reduced-motion presentation path. OS preference switching was not available through browser controls; quiet-mode behavior and delayed renderer handoff are covered by automated tests.
- Camera inspection and selected-orb movement were exercised. GPU/HTML transform equality under camera, rail, rapid selection and rescheduling changes is asserted directly in tests. No shader warnings/errors during the electrical recording. No live model inference was run.

## Measurements and limitations

RTX 5060 via ANGLE/D3D11, 1280×720. Cold/rehydrated first-frame samples 366–1182ms; retry 187–188ms. Background tab submitted approximately 1 FPS with ~1000ms intervals; its clock clamps large deltas, so effects progress more slowly in wall time. Foreground FPS is **not verified**. Automatic approval review blocked bringing the shared browser forward because it includes a live user session; verification stayed isolated.

Steady samples: CPU submission roughly 4.6–21.4ms, GPU roughly 2.3–7.5ms. Initialization/resize samples reached 89–562ms and should not be interpreted as steady performance. [Saved diagnostics](metrics.txt): 684 calls / 500,490 triangles including multiple passes, 69 geometries / 18 textures / 39 programs. Estimated HDR color buffers ~230.8MB, excluding depth, shadows and driver overhead. Existing six-face refraction probe, planar reflection, atmosphere and MSAA remain the dominant costs; no fidelity was removed to improve these numbers.

Electrical ribbons are a bounded visual simulation, not physical plasma. Occluded rail portions obey scene depth. Very large creation batches prioritize the latest four visible routes. Physical iPhone/Safari performance, WebGL support and local inference require actual device testing; no such compatibility claim is made.

## Checks and independent review

98 tests / 14 files pass, including transformed rail reception, route bounds, cancellation, fade-out, phase ordering, selected birth opacity, reduced-motion settlement, interruption and per-frame focus/projection. TypeScript, Pages-base production build and npm audit pass (zero vulnerabilities). The existing lazy WebLLM bundle-size warning remains. Independent Codex review of renderer isolation, lifecycle and staging permissions found no actionable findings and independently ran the focused tests. GitHub checks and the requested hosted Codex review are tracked on the PR.

## Reusable staging

The existing GitHub Pages site uses GitHub Actions and enforced HTTPS. `staging.yml` validates and builds only `dist`, with Vite base `/homebase-v2/`, then deploys through the existing `github-pages` environment. Pushes to `codex/**` branches containing this workflow automatically replace staging; main pushes do not deploy. Future milestones can retain this workflow. The single staging URL shows the latest successful deployment, not multiple simultaneous branch previews. Branch/environment protections remain in force.

- Preview: https://lilant5431.github.io/homebase-v2/#crystal
- Exact deployed revision: https://lilant5431.github.io/homebase-v2/staging.json
- Local: `npm ci`, `npm run dev -- --port 43132 --strictPort`, then `/#crystal`.
- No fixture files, browser storage, local development data, recordings or secrets are included in the Pages artifact.

On a physical iPhone, check all three navigation views; create/edit an assignment; schedule/reschedule a session; reload and confirm persistence; export then restore a disposable backup; disable/retry graphics; only then explicitly enable on-device AI and record Safari/WebGPU/model-loading results. Back up existing device data before importing anything. These device checks are outstanding.
