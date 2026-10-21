# V2.1B — The Observatory

Run `npm ci` if dependencies are missing, then `npm run dev` and open
`http://localhost:5173/#world` (use the port Vite prints if occupied).
The current session uses port **5174**. `npm run build` and `npm run preview`
also serve this hash route. No HTTPS world deployment is configured: the
inherited Pages workflow is restricted to the original prototype branch.

Use My week / Assignments / Planning studio to travel through the environment.
“Explore the architecture” hides the workbench without changing demo state.
The instrument panel exposes measurements, recording and failure-injection
controls. “Disable graphics” releases the renderer; HTML controls remain usable.
“Back to planner” returns to the existing saved V2 application.

## Rendering

- Three.js **0.186.1**, WebGL2, perspective camera, twelve procedural bays with
  fluted stone pillars, capitals, metal inlays, coffered vaults, paving, steps and
  an illuminated distant portal. Directional shadow map and procedural PMREM
  environment lighting establish foreground, intermediate and far depth.
- A full-resolution HDR scene capture feeds a custom GLSL crystal material.
  Schlick Fresnel, three refractive indices (1.44/1.47/1.51), view-dependent
  specular response, faceted normals and luminous edges give real transmission,
  controlled RGB dispersion and moving edge highlights. Crystal meshes are
  hidden during capture to avoid sampling their own framebuffer.
- GPU-driven **2,200 dust particles**, additive light shafts, distance haze,
  moving point illumination, drifting floor caustics, crystal float/turn and
  subtle camera drift evolve continuously at idle. Pointer movement changes
  camera parallax and the point light used by both stone and crystal shaders.
- Navigation changes the camera eye/look targets, eased in the render loop;
  calendar `(17,8,27)`, assignments `(-12,6.5,18)`, planning `(4,6,9)` before
  pointer/idle offsets. Proposal/detail emphasis also reaches the glass shader.
- HDR UnrealBloomPass, ACES filmic tone mapping and OutputPass. Rendering is
  separate from semantic HTML, so bloom/refraction never distort academic text.

The only renderer input is `{area, emphasis, reducedMotion}`. It imports no
academic fixtures, storage, scheduling validators or inference code. The existing
audition fixtures and presentation interactions are reused unchanged. The optional
renderer chunk is **571 KB / 144 KB gzip**; Three is not loaded by the saved planner
or the static auditions. No images, models, textures or new fonts are downloaded.
The inherited planner stylesheet retains its existing Google font requests.

## Actual browser evidence

Desktop Chromium in the in-app browser, Windows, ANGLE / **NVIDIA RTX 5060**,
1600×1000 CSS viewport, DPR 1. The workbench's scrollbar makes its drawing buffer
1585×1000; immersive mode uses 1600×1000. GPU/driver shader caches were warm on
production reload; this is not a first-visit network or cold-GPU benchmark.
Startup is measured from mounting the renderer stage through its first frame
submission. It excludes the main React bundle bootstrap and does not measure
compositor scanout; GPU elapsed time is reported separately.

| Observation | Measured result |
| --- | --- |
| First production frame, fresh renderer/module reload | **178 ms**; first submission ~58 ms |
| First development initialization in this session | ~1.10 s, including initial module/shader work |
| Steady submitted FPS | ~165 (monitor/browser cadence; not scanout measurement) |
| Production frame interval p95 / worst observed | 6.2–6.6 ms / **58.5 ms** |
| CPU update + render submission | 3.5–3.8 ms production; ~4 ms development |
| Sampled GPU elapsed query | ~0.5–0.7 ms production; up to ~5 ms observed in development |
| Steady calls / triangles, all passes | **1,616 / 165,690**; camera culling varies counts |
| Allocated geometry / texture / program indicators | **25 / 19 / 28**, stable across navigation |
| Estimated HDR color targets only | ~47.4–47.8 MiB; excludes depth, shadow maps, PMREM and driver allocations |

Raw visible instrument readings are in `production-performance.txt` and
`dev-performance.txt`. There is no FPS-driven quality downgrade. Full-resolution
scene capture, a second scene pass, bloom, numerous separate architectural meshes
and DPR up to 2 are deliberate costs. Higher DPR increases fill/buffer costs
quadratically; integrated/mobile GPUs were not benchmarked. No sustained interaction
stall was observed after startup, but the measured worst frame exceeds a 60 Hz
frame budget and this is not a responsiveness certification.

`idle-a.jpg` and `idle-b.jpg` were captured without interaction four seconds apart.
Across a fixed scene-only region, 8,276 / 12,560 sampled pixels (65.9%) changed by
more than 20 combined RGB levels. This is a coarse JPEG comparison, not a visual
quality score. `living-world-motion.webm` is a real canvas recording, **1600×1000,
7.969 s, 3,942,073 bytes**, played back in the browser and verified nonblank. It
contains idle motion and the calendar-to-assignments camera transition; HTML is
intentionally absent from the world-only recording. Other screenshots show the
calendar, assignments and planning workbenches in their respective camera views.

Browser checks also confirmed:

- Startup-failure injection tears down the allocated renderer; assignment and
  proposal controls continue working, and Retry graphics rebuilds a live world.
- Actual `WEBGL_lose_context` loss enters recovery; proposal preview/approval
  works during failure and graphics recover through retry.
- Freeze stops the rendered-frame and world-time counters completely; resuming
  returns to ~165 FPS without counting the paused interval as a giant stall.
  This exercises the renderer's reduced-motion path. OS media-preference override
  was unavailable in the browser tools; its matchMedia wiring and CSS were
  inspected, and delayed initialization with reduced motion is unit-tested.
- Demo approval inserts only a disposable calendar block. No model was loaded.

## Verification and limits

**63 tests passed**, TypeScript/production build passed. New tests exercise late
module cancellation, import/construction failures, resource release, missing HDR
support, initial reduced-motion input, recording cleanup and world UI rendering
without academic storage or Workers. Independent Codex review identified optional
chunk isolation, HDR capability, metric-clock and shader portability issues; all
were fixed, with no remaining actionable findings in the final pass.

This remains a deliberate visual experiment: transmission is screen-space with
approximate thickness, reflection color is analytic, the floor caustics are
procedural (not physically traced), and light shafts approximate scattering.
There is no multi-bounce ray tracing, dynamic floor reflection, photographic asset
library or measured GPU VRAM-byte total. Shadow lighting is baked per renderer
initialization while the unshadowed point light moves. WebGL2 plus HDR half-float
color targets are required; unsupported capability/allocation fails explicitly
instead of silently substituting CSS. System reduced motion renders static poses,
and graphics may be disabled entirely. Physical devices and screen-reader speech
were not tested. Existing planner engines, V1, PR #1 and PR #2 are untouched.

Implementation references inspected: [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html),
[ShaderMaterial](https://threejs.org/docs/pages/ShaderMaterial.html),
[EffectComposer](https://threejs.org/docs/pages/EffectComposer.html),
[UnrealBloomPass](https://threejs.org/docs/pages/UnrealBloomPass.html), and installed
Three.js shader/render-target implementation where needed during review.
