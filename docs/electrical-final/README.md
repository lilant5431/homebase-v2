# Final electrical sequence and orbital readability

Refinement of PR #11 on `codex/electrical-energy`; PR remains open. Scheduling, storage, schema, session identity and AI behavior are unchanged.

## Changes

- Creation lasts 6.2 seconds (previously 4.6), without delaying saves or controls.
- All 96 pedestal nodes share one charged double perimeter. Three distributed feeder nodes per route remain distinct; the shared axial discharge feeds Lumen once rather than stacking identical spines.
- Lumen discharges upstream of the saved time position. Two electrical fronts follow the actual transformed rail in opposite directions, arriving at that exact sector. A contracting local sector and six-spoke compression knot bridge the small depth offset into the saved orb position.
- Parallel rails use wider vertical spacing and a restrained common tilt. Shared circular torus gates replace box collars; one through four small lights retain the quarter-day markers. Date/time mapping is unchanged.
- Four simultaneous routed creations remain the limit. Shared pedestal charging uses the maximum active envelope; per-route intensity is budgeted by route count. Fixed GPU buffers, reset paths and disposal remain bounded.

## Actual desktop evidence

Tested in the in-app Chromium browser at an isolated localhost origin with disposable assignments. No existing user origin or planner records were replaced.

- [Before](before.png) and [after](after.png): ring separation and circular gates. Camera phase differs; these are composition evidence, not pixel-matched optical comparisons.
- [Sequence MP4](../../public/recordings/lumimark-electrical-final.mp4): selected session reopened to show the same arrival presentation with a clear destination view. Twelve seconds, original speed, 30 FPS, H.264 Main / yuv420p / fast-start MP4, no audio.
- [Rapid-creation MP4](../../public/recordings/lumimark-electrical-rapid.mp4): five distinct manual saves completed within **672 ms**, with one session already present. All six remained saved; zero active effects after settling. Route overlap stayed bounded and the pedestal returned to idle. [Save timings](rapid-timing.json), [settled metrics](rapid-settled.txt).
- Selection remained attached during camera/rail movement. Completion/reopen retained the session record. Rescheduling with graphics disabled and undo restored the original time.
- Injected context loss and startup failure both retained HTML workflows; Retry rebuilt all six saved lights without replaying arrival effects.
- Keyboard-operated freeze entered the shared reduced/static rendering path and resumed successfully. This pass did not change OS motion-preference handling; existing regression coverage is retained.
- [390×844 narrow layout](narrow.png), scheduling dialog, and [1280×500 short layout](short.png) remained usable through existing scrolling. Viewport override reset afterward.

At 1212×930 on NVIDIA RTX 5060 / ANGLE D3D11: approximately **158–165 submitted FPS**, steady frame-interval p95 **6.2–6.4 ms**, CPU submission **2.3–2.7 ms**, sampled GPU **1.8–4.4 ms**. Warm renderer rebuilds took **143–189 ms**; worst observed interval was **64 ms** including initialization. Approximately 660–675 draw calls and 0.49–0.51 million triangles including extra passes; 45–46 geometries, 18 textures, 39 programs. Estimated HDR color buffers alone remain ~248 MB, excluding depth, probes and driver overhead. These are desktop observations, not mobile performance guarantees or display scanout measurements.

## Regression and review

All **100 tests** pass. Added focused coverage checks full-platform participation, exact two-front convergence for transformed rails and different saved angles, and 20 rapid immutable snapshot updates with bounded finite geometry, unique destinations, quiet-state clearing and disposal. Timing assertions use the shared duration constant.

TypeScript, Pages-base production build and dependency audit are checked for the final commit through local checks and CI. The existing large lazy WebLLM/Wasm bundle warning remains; no inference was run.

Independent renderer review found no substantive blockers and independently passed all ten focused energy tests. Hosted Codex review status is reported on PR #11; this report does not imply hosted approval.

## Staging and limits

[HTTPS preview](https://lilant5431.github.io/homebase-v2/#crystal) · [recording/download page](https://lilant5431.github.io/homebase-v2/recordings/index.html). Existing Pages workflow automatically republishes pushes to this explicitly authorized branch. `staging.json` identifies the deployed SHA; no main merge or production deployment is involved.

The crystal can occlude a rear-facing destination from some camera angles; selection improves framing but does not remove physical occlusion. Crowded schedules still use session semantics and existing depth stacking. Extra arrivals beyond four settle directly rather than receive full simultaneous lightning. High desktop rendering and memory costs remain intentional. Physical iPhone graphics, inference and MP4 playback have not been tested. Canvas recordings contain disposable lights only, no academic text or private records.
