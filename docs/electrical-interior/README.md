# Final energy refinement — PR #11

Presentation-only changes on `codex/electrical-energy`, based on `9da3a98`. Academic operations, storage/schema, locking, backups and inference are unchanged. Do not merge automatically.

## Implemented

- The full double pedestal perimeter and 96 square nodes charge together. Two electrical fronts circulate around the bus while selected feeders progressively converge inward.
- The existing convex refraction shader now evaluates finite electrical segments on each of its actual internal optical rays. One zigzag trunk divides into up to four destination-directed branches. Fixed uniform slots share a total intensity budget; quiet mode and recovery clear them. No new render target, exposure or bloom increase.
- Five-second creation replaces 6.2 seconds. Charge, internal buildup, growing discharge, exact rail propagation, compression and materialization overlap; saves and controls remain immediate.
- Orb centers use the exact conductor radius and plane under the rail’s authoritative transform. GPU focus and HTML projection use the same result. Primary rail quarters join continuously through circular time gates, including exact six-hour positions. Session IDs, clock angles and date lanes remain unchanged.
- Obsolete crowding offsets no longer trigger movement transitions. Independent review caught that adding a neighboring session could otherwise interrupt an existing birth; the fix and regression preserve that birth.

## Verification and evidence

Actual desktop Chromium / ANGLE on RTX 5060, isolated disposable localhost data:

- [Normal-speed single creation](../../public/recordings/lumimark-energy-interior.mp4), [rapid saves](../../public/recordings/lumimark-energy-interior-rapid.mp4): H.264 Main, yuv420p, fast-start MP4, 30 FPS, no audio. Manual saves use ordinary validated forms; no app-state injection or AI inference.
- Five new sessions saved within approximately 2.4 seconds, overlapping the five-second lifecycle. All 17 accumulated sessions remained saved; effects returned to zero. [Timing evidence](rapid-timing.json).
- [Internal charge](internal-charge.jpg), [selected rail-centered light](rail-centered.png), [narrow dialog](narrow.png), [short window](short.png). Inspected actual single/rapid captures for inward routing, refracted internal discharge, correct rail reception, focused compression and natural settling.
- Keyboard selection follows camera/rail movement. Graphics-disabled editing remains available. Injected context loss and retry retain all 17 records, establish a quiet baseline and clear the internal energy slots. Keyboard freeze/resume exercises the shared reduced/static path. 390×844 and 1280×500 layouts remain usable through existing scroll regions; viewport reset afterward.
- Full suite: **103 tests / 14 files**, including exact conductor alignment with nonzero legacy offsets on all three moving/transformed rails, shared internal energy budget/clearing, and non-interruption on rank-only updates. TypeScript, production build and audit checked before push; CI checks the final SHA.
- Independent read-only review: no remaining confirmed blockers after the offset fix; **29 focused tests**, TypeScript and diff checks pass. Shader distance calculation independently checked. Hosted review status is tracked on PR #11 separately.

Observed desktop costs at 1212×930: idle approximately 165 submitted FPS; rapid activity approximately 160 FPS, frame-interval p95 7.7 ms, CPU submission 3.2 ms, sampled GPU 5.5 ms. Settled GPU approximately 3.7–4.3 ms. Warm startup 107–222 ms; worst observed interval 65.5 ms including initialization. HDR color buffers remain ~248 MB, excluding depth/probes/driver resources. Internal shader work increases during active creation; no mobile performance claim.

## Limits and staging

Lights at identical date-lane/clock positions intentionally share the exact conductor center. Use the semantic session list to distinguish coincident records; selection remains linked to the individual ID. Rear destinations can be occluded by Lumen. Four destination routes remain the visual bound; excess arrivals settle directly. Physical iPhone graphics, inference and playback, and OS preference switching were not tested in this pass.

[HTTPS staging](https://lilant5431.github.io/homebase-v2/#crystal) · [MP4 download page](https://lilant5431.github.io/homebase-v2/recordings/index.html). Existing Pages authorization/workflow is reused; `staging.json` verifies the deployed commit. PR #11 remains open.
