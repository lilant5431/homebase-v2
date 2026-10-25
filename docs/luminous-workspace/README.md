# V2.3B — Luminous Workspace

## Foundation and review boundary

Branch `codex/luminous-workspace` starts from PR #11 at `097c985`. The existing stack is explicit: **main ← PR #10 ← PR #11 ← V2.3B**. Both dependencies were inspected: open, mergeable, green CI, with prior independent reviews but no hosted approval returned. They are preserved and unmerged. V2.3B targets `codex/electrical-energy`, keeping this implementation review separate; integrate dependencies in order only after acceptance. No shared history was rewritten or branches deleted.

## Workspace

Calendar is the primary surface. Calendar, Crystal and Assistant are the main destinations; assignments and overview remain secondary calendar views. Quick Add reuses the validated assignment/session dialog and returns keyboard focus to its summary. Contextual Workspace tools retain export, restore, undo, recovery and atmosphere controls. The Assistant preserves bounded request help, compatibility details and explicit proposal approval.

Ice-cyan/silver surfaces, serif headings and restrained environmental light replace the green dashboard panels and repeated marketing text. Ordinary pages use two CSS background layers with slow transform motion and focus response, not WebGL, particles, render targets or new dependencies. Pause atmosphere disables them; OS reduced-motion uses a static treatment. Solid backgrounds remain readable without advanced CSS. Mobile uses three persistent navigation destinations and a horizontally scrollable calendar with an explicit swipe hint.

## Pedestal restoration

Restored the immediately preceding **`b40e16a`** pedestal treatment, identified against its `lumimark-energy-interior*.mp4` recordings: full double perimeter, three distributed feeder nodes/branches, circulating fronts and restrained axial feed. Removed only the later eight-feed branching mesh and five-strand dense intake bundle. Feeders now use the existing shared cohort clock and per-rail distribution systems. Internal Lumen optics/energy, beam balance, gate poses, ring composition, exact-time convergence, rail-centered lights, grouping and selection remain current.

[Restored pedestal/grouped-creation MP4](../../public/recordings/lumimark-luminous-pedestal.mp4), actual normal-speed canvas capture. Five validated saves within 2,412 ms form one group; seven saved sessions remain and effects settle to zero. No private records or application text are in the recording.

## Verification

- Isolated localhost origin and disposable records: assignment capture, manual scheduling, conflict rejection, rescheduling, undo, actual exported-backup removal/restore round trip, and reload persistence passed. Existing user origins were not modified.
- Desktop and 390px mobile: calendar, assignment navigation, Assistant, Quick Add focus return, contextual controls, and narrow Crystal navigation inspected. An inherited two-column mobile Assistant rule was corrected. Calendar/Assistant render **zero canvases**; no AI model was loaded.
- [Desktop calendar](desktop-calendar.png), [desktop Assistant](desktop-assistant.png), [mobile calendar](mobile-calendar.png), [mobile Assistant](mobile-assistant.png).
- All **108 tests / 15 files**, TypeScript and Pages-base production build pass. Audit: **zero vulnerabilities**. Existing large lazy renderer/WebLLM chunk warning remains. New SSR checks forbid graphics/Worker creation and storage writes during ordinary rendering, including read-only storage fallback and Assistant compatibility disclosure.
- Independent read-only review: **60 focused tests** passed; no actionable findings in persistence/editor extraction, approval, routing cleanup or preserved grouped electrical behavior. Final CI and exact deployment SHA are reported on the PR.

## Staging and limits

Existing Pages workflow builds `codex/**` branches with `/homebase-v2/` asset base; its environment currently allows only explicitly approved branches. The exact `codex/luminous-workspace` branch must be added to the allowlist before publishing this preview. No broad wildcard or protection bypass is required. `staging.json` identifies the served SHA after deployment.

Ordinary pages were checked in desktop Chromium and mobile-sized viewports, not a physical iPhone. OS motion-preference switching and live AI inference were not rerun; static/pause behavior and existing automated coverage remain. Full 3D graphics retain their desktop GPU costs and fallback; the lightweight workspace does not initialize them. Coincident crystal lights and rear occlusion remain existing limitations. PR remains open for visual acceptance.
