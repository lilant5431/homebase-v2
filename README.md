# Lumimark V2

A local academic planner with a living Lumen schedule constellation. Open `/#crystal` to inspect and manage **your saved study sessions** as orbital lights. **Back to planner** opens the conventional calendar. The previous disposable visual workspace remains at `/#demo`. See [V2.3A energy and temporal verification](docs/energy/README.md) and [V2.2 evidence](docs/constellation/README.md). Repository paths and storage identifiers are unchanged; schema v2 data imports migrate to v3.

A responsive academic planner prototype built with React, TypeScript, and Vite. Homebase V1 is separate and has not been modified.

```sh
npm ci
npm run dev
npm test
npm run build
```

Open the localhost URL printed by Vite. Use a current Node release compatible with Vite 7 and Vitest 5 (Node 22.12+ recommended). Manual scheduling requires no AI download.

## Try it

- Navigate weeks, add/edit assignments, mark work complete, and schedule by clicking a calendar slot or **Schedule time**. Click an event to edit or remove it. Calendar hours cover the full day; scroll horizontally on narrow screens.
- Reload to verify local persistence. Export a JSON backup, restore it, or undo the last successful save. Recovery controls are also available below the planner on small screens.
- Enable local AI to download Qwen2.5 1.5B (~880 MB model files, ~1.63 GB estimated VRAM). Supported requests are deliberately explicit: `Schedule "Problem set 04" on 2026-10-21 between 13:00 and 17:00 for 90 minutes.` Or use `at 14:00` instead of a window. One assignment title (or unique ID), ISO date, 24-hour time, and duration are required. Ambiguous wording or extra instructions asks for clarification before inference. The proposal stays separate until explicit approval; wrong assignment/day/window/duration, conflicts, and stale proposals cannot be approved.
- Run the reproducible [AI evaluation](docs/ai-feasibility.md) for raw outputs and observed performance. This is experimental: the selected model fully followed only 1 of 3 tested requests, despite 3/3 valid JSON.

## Data and rollback

`homebase.v2` holds schema-version-3 JSON in localStorage. Valid v2 state is migrated in memory on read; nothing is written until an explicit save. Unknown schema versions and malformed backups are rejected. V3 adds optional `sessionCompleted` and `locked` booleans to calendar blocks; absent means unfinished/unlocked. Assignment completion remains independent. Completing a session preserves its ID, time, work accounting and conflict occupation. A locked block cannot be moved, relinked or deleted until explicitly unlocked. Completed sessions must be reopened before changing their time. `homebase.v2.rollback` retains the previous successful state, and `homebase.v2.recovery` preserves unreadable original data before replacement. Export regularly: browser clearing and cache eviction can remove local data. Storage write failure leaves the visible schedule unchanged. Revision checks reject saves from stale tabs; reload that tab before continuing. This is a single-device prototype, without account sync or multi-tab transactional storage.

Normal backups and saved state use the same compact JSON encoding with a **5,000,000 UTF-8 byte** limit (inclusive), plus 1,000 assignments and 5,000 blocks. Imports, manual saves, and AI approval share the same domain validator: schema, IDs, dates, references, positive same-day duration, linked-session bounds (15–240 minutes), deadlines and total estimated work. A linked study session cannot overlap any event. Unlinked commitments may overlap each other and render in separate lanes. Invalid imports leave existing data intact. Completed assignments retain their existing study history, including in backups; reopen before adding, moving or relinking those sessions. Removing a session remains reversible with undo. Deadlines/estimates cannot be shortened past scheduled work. Recovery downloads remain verbatim diagnostic copies, exempt from the normal-backup byte limit; they are not guaranteed valid import files.

Schema v2 uses **floating wall-clock dates**, not instants: a 14:00 block remains 14:00 when travelling. Gregorian validation, duration calculations and display are independent of the device timezone. DST gap/fold values remain nominal clock times; this prototype does not resolve them to physical instants or support timezone conversion/reminders. Existing floating dates and IDs remain unchanged by migration. Web Locks serialize cooperating saves, with snapshot/revision checks inside the lock. **Without Web Locks the workspace is read-only**: save, restore, and undo cannot write; export and recovery downloads remain available. Use HTTPS/localhost and a current Web Locks browser for manual saving; WebGPU is not required for manual planning. Browser storage is not a transactional database.

AI runs through a Web Worker and WebLLM, with no cloud inference fallback. Model files and Wasm require network access on first load. HTTPS/localhost, WebGPU, and shader-f16 support are checked. Shape-valid JSON is not proof of instruction correctness: both domain and structured-intent checks are mandatory at preview and approval. Arbitrary scheduling language is unsupported. See [feasibility findings](docs/ai-feasibility.md).

Worker `error`/`messageerror` during initialization rejects loading, terminates the failed worker and permits retry. Startup listeners and obsolete progress callbacks are retired on settlement. This is not a general network-download timeout or automatic model retry.

Before the first v3 save over existing v2 primary data, the original v2 bytes are retained once at `homebase.v2.schema-v2`; failure to retain them aborts the save. **Export pre-migration v2** in the constellation downloads that snapshot. Keep a current v3 export as well. A code rollback to the v2 application cannot read v3 session flags: restore the exported pre-migration snapshot through its recovery UI, retaining your v3 export for returning to this version. The snapshot predates subsequent edits; do not mistake it for a current-data downgrade. A new v3-only workspace has no pre-migration snapshot. V1 keys are untouched.

## Verification

The [current energy refinement](docs/electrical-interior/README.md) covers the 5-second overlapping sequence, refracted internal branching, full pedestal routing, rail-centered lights and rapid-event evidence. The [previous electrical report](docs/electrical-final/README.md) preserves the earlier comparison.

See [current electrical refinement](docs/electrical/README.md), [V2.2 verification](docs/constellation/README.md), [integration verification](docs/integration/README.md), [foundation verification](docs/verification.md), and [planner screenshots](docs/screenshots). Historical visual experiments and their evidence remain in `docs/auditions`, `docs/world`, `docs/crystal`, `docs/gemstone`, `docs/lumen`, and `docs/optical`; their comparison controls are no longer part of the application. `npm audit` reports zero known vulnerabilities at implementation time. Build warns about the large lazy WebLLM/Wasm chunks; ordinary planner startup loads the smaller application bundle and does not initialize inference.

## Selected visual environment

Lumen uses coherent convex-facet transmission, a luminous internal spine, a 64-step atmospheric beacon, filtered HDR reflections, 4× HDR MSAA, metallic orbital rails, a planar reflective receiver and bounded interaction wavefronts. Semantic HTML workflows communicate presentation state through `src/world/contract.ts`; the renderer cannot write planner data. Disable graphics at any time. Reduced-motion preferences and the explicit freeze control use static rendering with immediate navigation. Graphics errors retain the workbench and expose retry.

The previous identity auditions, alternate gemstone cuts and optical reference/comparison modes have been removed. The constellation instrument panel provides a user-started canvas-only recording capped at 60 seconds, canceling and discarding on navigation or renderer failure. Old audition/world hash links resolve to the selected Lumen workspace. Existing historical branches and evidence are preserved. A separate experimental-branch workflow publishes temporary staging to the existing GitHub Pages URL; see the electrical refinement report for trigger and verification details.

## Living study sessions

Each persisted assignment-linked block has one stable orb identity. The inner/lower ring holds past dates, the middle ring holds today, and the outer/upper ring holds future dates. All three share a clockwise local 24-hour dial, with one through four luminous gate pins marking the six-hour quarters. The compact accessible legend explains the clock and date anchor. Duration controls aura size and course color supplies its hue. Past unfinished work stays unfinished and visible. Completed sessions dissolve from the scene but remain in the Completed/All HTML history views. The session list is equivalent when graphics are disabled or unavailable.

Creation charges a branching pedestal lattice and Lumen, discharges to the destination rail, sends counterpropagating pulses around its geometry, and compresses the energy before materializing the light. At most four routed creations run together; larger batches settle directly into their saved positions. Rescheduling sweeps the same light along the rails; completion returns energy to the core; deletion fades quietly. Selection reframes the camera and slows rail motion, with GPU focus and HTML hit targets synchronized to the rendered transforms. Effects are bounded and interruptible, derived only from committed snapshots. Initial load and renderer recovery establish a baseline without arrival effects. All writes use the existing academic operations and Web Locks storage path. No inference is initiated by graphics or selection.
