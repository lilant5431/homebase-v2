# Prototype verification — October 19, 2026

- `npm test`: 6 deterministic domain tests passed. Covers non-mutation, valid additions, existing and intra-proposal conflicts, completed/unknown assignments, work limits, invalid dates, schema rejection, backup roundtrip, and revision increment.
- `npm run build`: TypeScript and production Vite build passed. Expected warning: lazy WebLLM runtime/worker chunks are large (about 6 MB each uncompressed); model weights are downloaded separately on explicit enable.
- `npm audit --audit-level=high`: zero known vulnerabilities after updating Vitest. Lockfile committed.
- Actual browser: Windows Chrome 155 in-app browser. Verified assignment creation/edit, linked manual scheduling, persistence after reload, inline conflict rejection, JSON export/restore, and undo of restore. Checked desktop and 390×844 mobile layouts. Calendar scroll is internal on narrow screens; recovery controls remain available below the planner.
- Planner integration: loaded the real selected model in 18.9 seconds, requested Reading response: Modernism on October 20 from 14:00–15:00, and received the correct one-block proposal in 10.6 seconds. Captured its separate preview, approved it, and verified the calendar event appeared. Export/restore/undo then confirmed rollback of the changed state. No mocked inference was involved.
- Real local model evaluation: three models loaded and executed. Selected Qwen2.5 1.5B completed three requests with 3/3 JSON shape validity, 2/3 conflict-free outputs, and 1/3 fully correct requests. A real correct proposal passes the same deterministic validator; conflicting output is rejected. See [raw results](../scripts/ai-eval-results.json) and [limitations](ai-feasibility.md).
- Independent code review completed twice; identified issues were fixed: full-day calendar coverage, corrupt-data preservation/export, mobile recovery access, strict dates, linked completed assignments, dialog labeling/errors, model labeling, and 23:00 defaults. Approval remains separate from persistence and is revalidated with stale-state guards.

Evidence: [desktop](screenshots/desktop.png), [mobile](screenshots/mobile.png), [actual inference evaluation](screenshots/ai-evaluation.png), [real proposal preview](screenshots/ai-proposal.png).

Limits: mobile visual checks do not demonstrate mobile inference. Free-form intent cannot be proven by the deterministic validator. Browser/GPU support and model cache behavior vary. CI workflow is included but its hosted result must be inspected on the PR. No merge or deployment was performed.
