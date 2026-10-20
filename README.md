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
- Enable local AI to download Qwen2.5 1.5B (~880 MB model files, ~1.63 GB estimated VRAM). Ask for one assignment at a specific date and time. The proposal is separate from saved data; review its actual dates/durations, then explicitly approve. Conflicts and stale proposals cannot be approved.
- Run the reproducible [AI evaluation](docs/ai-feasibility.md) for raw outputs and observed performance. This is experimental: the selected model fully followed only 1 of 3 tested requests, despite 3/3 valid JSON.

## Data and rollback

`homebase.v2` holds a schema-version-2 JSON state in localStorage. Unknown schema versions and malformed backups are rejected. `homebase.v2.rollback` retains the previous successful state, and `homebase.v2.recovery` preserves unreadable original data before replacement. Export regularly: browser clearing and cache eviction can remove local data. Storage write failure leaves the visible schedule unchanged. Revision checks reject saves from stale tabs; reload that tab before continuing. This is a single-device prototype, without account sync or multi-tab transactional storage.

Imported files are limited to 5 MB, 1,000 assignments, and 5,000 blocks. Imports validate schema, IDs, dates, references, and field types, then retain the previous plan for undo. Manual/AI additions check overlaps; imports retain the source calendar as-is. Calendar events spanning midnight must be split into separate daily events. Assignment deadlines/estimates cannot be shortened past scheduled work.

AI runs through a Web Worker and WebLLM, with no cloud inference fallback. Model files and Wasm require network access on first load. HTTPS/localhost, WebGPU, and shader-f16 support are checked. Shape-valid JSON is not proof of user intent: the deterministic validator checks date validity, assignment references, overlaps (including within proposals), deadlines, duration bounds, and remaining estimated work; users must check request fidelity. See [feasibility findings](docs/ai-feasibility.md).

Rollback the application by reverting this feature commit; versioned storage keys do not touch V1 data. Before changing schema in a future release, export and implement an explicit migration rather than silently replacing user data.

## Verification

See [verification results](docs/verification.md) and [screenshots](docs/screenshots). `npm audit` reports zero known vulnerabilities at implementation time. Build warns about the large lazy WebLLM/Wasm chunks; ordinary planner startup loads the smaller application bundle and does not initialize inference.
