# Homebase V2

A responsive academic planner prototype built with React, TypeScript, and Vite. This repository was empty apart from its initial commit; V1 has not been modified.

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

`homebase.v2` holds a schema-version-2 JSON state in localStorage. Unknown schema versions and malformed backups are rejected. `homebase.v2.rollback` retains the previous successful state, and `homebase.v2.recovery` preserves unreadable original data before replacement. Export regularly: browser clearing and cache eviction can remove local data. Storage write failure leaves the visible schedule unchanged. Revision checks reject saves from stale tabs; reload that tab before continuing. This is a single-device prototype, without account sync or multi-tab transactional storage.

Imported files are limited to 5 MB, 1,000 assignments, and 5,000 blocks. Imports, manual saves, and AI approval share the same domain validator: schema, IDs, dates, references, positive same-day duration, linked-session bounds (15–240 minutes), deadlines and total estimated work. A linked study session cannot overlap any event. Unlinked commitments may overlap each other and render in separate lanes. Invalid imports leave existing data intact. Completed assignments retain their existing study history, including in backups; reopen before adding, moving or relinking those sessions. Removing a session remains reversible with undo. Deadlines/estimates cannot be shortened past scheduled work.

Schema v2 uses **floating wall-clock dates**, not instants: a 14:00 block remains 14:00 when travelling. Gregorian validation, duration calculations and display are independent of the device timezone. DST gap/fold values remain nominal clock times; this prototype does not resolve them to physical instants or support timezone conversion/reminders. Schema version 2 and existing values remain unchanged. Web Locks serialize cooperating saves when available; snapshot and revision checks still reject stale candidates without them. Browser storage is not a transactional database.

AI runs through a Web Worker and WebLLM, with no cloud inference fallback. Model files and Wasm require network access on first load. HTTPS/localhost, WebGPU, and shader-f16 support are checked. Shape-valid JSON is not proof of instruction correctness: both domain and structured-intent checks are mandatory at preview and approval. Arbitrary scheduling language is unsupported. See [feasibility findings](docs/ai-feasibility.md).

Rollback the application by reverting this feature commit; versioned storage keys do not touch V1 data. Before changing schema in a future release, export and implement an explicit migration rather than silently replacing user data.

## Verification

See [verification results](docs/verification.md) and [screenshots](docs/screenshots). `npm audit` reports zero known vulnerabilities at implementation time. Build warns about the large lazy WebLLM/Wasm chunks; ordinary planner startup loads the smaller application bundle and does not initialize inference.
