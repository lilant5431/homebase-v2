# Crystal World — V2.1C

Experimental branch `codex/crystal-world`, based on PR #3 (`165c195`). No merge or deployment. Scheduling, persistence, schema/backup/recovery, AI approval/inference and Canvas behavior are unchanged. No new dependencies.

Run `npm ci` if dependencies are absent, then `npm run dev -- --port 5174`. Open `http://localhost:5174/#crystal`. The previous `#world` link is an alias in this experiment. Use **Explore the crystal** for a central sculpture view; navigation remains available. **Back to planner** returns to the working application. PR #3 preserves the architectural experiment separately.

## One object, three perspectives

| Area | Facet | Camera azimuth / radius / height | Presentation |
| --- | --- | --- | --- |
| Calendar | 01 / Meridian | 20° / 22.5 / 7.5 | Cyan light, broad front facets, weekly display |
| Assignments | 02 / Archive | 135° / 21 / 8.7 | Green light, elevated oblique view, assignment display |
| Planning | 03 / Possible | 252° / 19.7 / 6.6 | Violet light, closer opposing view, proposal display |

Polar interpolation keeps the camera outside the crystal and near-field instruments throughout navigation. Pointer position offsets the camera and moving key light. A centered presentation mode removes the workspace composition offset. HTML remains flat and readable, with a clipped-corner surface, a luminous facet-colored seam and an angled connecting rule. Navigation, filters, details, keyboard focus and explicit demo approval reuse the disposable audition workflows. The existing intention textarea is deliberately read-only; proposals remain labeled scripted fixtures, not inference.

## Rendering

- A single closed, asymmetric quartz habit generated with Three.js `ConvexGeometry`. Its 26 unique outward planes come from the actual rendered mesh, rather than a sphere/thickness proxy.
- Custom GLSL traces the entrance refraction and exact convex exit facet for IOR 1.475/1.480/1.485. Each band follows up to three internal segments (direct transmission plus two reflected continuations), including total internal reflection, Fresnel energy splitting and Beer–Lambert absorption.
- Twelve volume samples per segment integrate animated growth veils and a light core along the refracted path. Facet-adjacency distances create edge highlights; fine growth striations preserve face character. Pointer-reactive highlights and captured environment reflections complete the surface.
- A live 512×512×6 half-float cube probe captures the actual surrounding scene every frame with the crystal excluded. Box projection provides first-order parallax at the exit position. Light rings and moving surrounding ribbons become visibly bent, displaced and split in the crystal; this replaces V2.1B's screen-space color offsets.
- Three spatial metal/light instruments, a calibrated plinth, procedural floor caustics, animated surrounding illumination, 1,600 drifting particles and gentle crystal motion keep the environment alive. Full-resolution HDR composition, UnrealBloom and ACES output remain enabled.
- The renderer accepts presentation state only: area, emphasis, motion, refraction comparison and composition mode. No academic data or storage APIs enter it. Its lazy module, resource ownership, hidden-tab pause, initial reduced-motion state, error fallback and retry remain isolated from the shell. Both HDR composition and all six cube framebuffer attachments are checked.

## Actual desktop verification

Production build tested in the in-app Chromium browser on Windows, ANGLE/D3D11 **NVIDIA GeForce RTX 5060**. The viewport override was 1600×1000 device pixels; observed CSS canvas was approximately 1201–1212×758 with browser/device scale 1.32. Drawing buffers were 1585–1599×1000 depending on the vertical scrollbar. Saved browser JPEGs are 1212×758. Measurements are submitted frames, not scanout or an end-to-end cold network benchmark.

| Observation | Measured result |
| --- | --- |
| Stage mount, renderer import, initialization to first submitted frame | 286 ms first measured session; 124 ms warm retry |
| Steady submitted frame rate | Approximately 161–165 FPS |
| Frame interval p95 | 6.2–7.1 ms across observed samples |
| Worst interval before recording | 48.4 ms |
| Worst interval after recording/browser playback exercise | 163.6 ms; cause not isolated |
| CPU update + submission | Approximately 1.1–1.8 ms |
| Sampled GPU elapsed time | Approximately 0.7–4.0 ms; individual samples, not a percentile |
| Scene + probe + postprocessing | 252–295 draw calls, approximately 224k triangles, depending on culling |
| Resource counters | 29 geometries / 17 textures / 27 programs, stable across navigation |
| Estimated HDR color targets | 47.3–47.6 MiB, including 12 MiB probe; excludes depth, PMREM, driver overhead and total VRAM |
| Lazy renderer chunk | 575.79 kB / 146.17 kB gzip |

Checks performed:

- Idle screenshots separated by a four-second wait: the world visibly changes without interaction. A sculpture-only 300×310 crop changed in 77,764/93,000 pixels at summed RGB difference >20; this supports motion, not a visual-quality score.
- Frozen A/B screenshots use the same camera and world time. **Compare without refraction** bypasses the internal optical path for a straight-through environment baseline; **Restore crystal refraction** reinstates it. Frame/time counters remained exactly 10,895 / 66.3 s across a three-second frozen interval.
- All three camera destinations verified visually and via metrics. Archive camera approximately (15.30, 8.70, -14.39), planning (-18.71, 6.35, -6.16); pointer/idle drift affects exact coordinates.
- Assignment priority filter returns two high-priority fixtures; details open and Escape closes them. Scripted proposal preview and explicit approval work, with the approved 15:00 demo calendar event reachable inside the scrolling calendar.
- Actual WebGL context loss leaves proposal approval usable; retry reconstructs the scene. Injected initialization failure also leaves assignment navigation usable and retry succeeds.
- Returning to the real planner leaves zero world canvases and retains manual scheduling controls and opt-in local AI. No model was loaded or downloaded. No production data workflow was modified.
- All **66 tests** pass, TypeScript and production build pass, dependency audit **0 vulnerabilities**. Added tests verify outward plane enclosure and compare 80 analytic exits against independent triangle-ray intersections; existing lifecycle/retry/isolation tests continue to pass.
- Independent Codex review found an occluded light filament and an inaccurate segment label; both corrected. Final review found no remaining actionable rendering/lifecycle/isolation defects. Browser/device claims rely on the primary agent's measurements.

## Evidence

[Central sculpture](crystal-desktop.jpg), [calendar](calendar-desktop.jpg), [assignments](assignments-desktop.jpg), [planning preview](planning-desktop.jpg), [graphics fallback](graphics-fallback.jpg), [idle A](idle-a.jpg), [idle B](idle-b.jpg), [refraction on](refraction-on.jpg), [straight-through baseline](refraction-baseline.jpg).

[Actual world-only WebM recording](crystal-motion.webm): 7.969 seconds, 1599×1000, 3,823,545 bytes. Played to completion in the browser and checked for visible rendered content. Captures the animated canvas without academic text or audio. Screenshots show the semantic UI separately. Raw measurements: [initial session](production-performance.txt), [archive](archive-performance.txt), [planning](planning-performance.txt), [post-capture session](capture-performance.txt).

## Costs and compromises

This is a bounded real-time optical experiment, not full path tracing. A single-origin probe with a box parallax proxy cannot reproduce exact near-field occlusion at every exit point. Three segments truncate residual reflected energy; no birefringence, polarization, rough dielectric scattering or multiple scattering. Volume veils and floor caustics are artistic procedural approximations. HTML is composited above WebGL, so it is not sampled/refracted by the crystal. Fine probe details and dispersion can alias at 512 pixels per face. The three main perspectives are deliberately staged, rather than free camera exploration.

Six environment renders per frame, full-resolution bloom and up to 234 plane intersection checks plus 108 volume samples per crystal fragment are meaningful costs. Measured long-tail stalls exceed a 60 Hz frame budget, especially during the capture exercise; their cause is not isolated. No adaptive feature removal or automatic quality downgrade was introduced. Native DPR is capped at 2 as in V2.1B. Only this desktop GPU was tested; no mobile, physical iPhone or OS reduced-motion emulation claim. The shared reduced-motion renderer flag, queued initial preference and CSS rules were verified; manual Freeze exercised that render path. WebGL2 and half-float targets are required; failure exposes a usable HTML shell rather than a CSS imitation.

Implementation references inspected: [CubeCamera](https://threejs.org/docs/pages/CubeCamera.html), [WebGLCubeRenderTarget](https://threejs.org/docs/pages/WebGLCubeRenderTarget.html), [ConvexGeometry](https://threejs.org/docs/pages/ConvexGeometry.html), [ShaderMaterial](https://threejs.org/docs/pages/ShaderMaterial.html), and the installed Three.js r186 camera/environment/postprocessing source.
