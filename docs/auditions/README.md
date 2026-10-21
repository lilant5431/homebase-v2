# V2.1A visual auditions

Run `npm ci` if dependencies are absent, then `npm run dev`. Open
`http://localhost:5173/#auditions/aether` (or the port printed by Vite).
The selector switches concepts without losing the demo filter or proposal state.
“Back to planner” returns to the saved V2 workspace. Reloading auditions resets
the disposable demo. No audition action reads/writes academic storage or runs AI.

| Concept | Visual strengths | Cost / tradeoff |
| --- | --- | --- |
| Aether | Daylight, generous space, precise pale facets, serif editorial hierarchy | Lowest visual complexity; intentionally understated environment |
| Meridian | Stone colonnade, warm directional light, vertical gallery navigation | More CSS layers and shadow compositing; less calendar width beside its rail |
| Prism | Angular optical field, instrument typography, reversed workbench composition | Large decorative SVG/filter area; strongest visual presence around content |

All use semantic HTML, a single shared fixture set, CSS and one inline SVG.
There are no new dependencies, WebGL contexts, render loops or external assets.
Audition typography uses system fonts; the unchanged planner stylesheet still
requests its existing Google fonts. The lazy audition chunk is ~17 KB JS / ~28 KB CSS before gzip.
“Simple environment” removes facets, architecture, grain, transitions and motion.
Unsupported decorative effects leave the HTML workbench usable; there is no
advanced renderer whose initialization can block it. Reduced motion disables all
audition animations and transitions through `prefers-reduced-motion`.

Verification: 53 tests passed; TypeScript/production build passed; dependency
audit reported zero vulnerabilities. The added render tests cover all concepts
with storage and Worker access forbidden. Browser checks covered 1440×1000,
1280×800 and 390×844, switching, filters, detail focus/Escape/return focus,
skip navigation, preview/discard/approval/reset, demo calendar insertion,
simple environment and return to the existing saved planner. No model was loaded.
The browser offered viewport emulation but no reduced-motion preference override;
the media rule was inspected, and simple-environment motion suppression exercised.

Independent Codex review identified skip-link routing and missing detail focus;
both were fixed and verified in the browser. No substantive findings remained.
Screenshots use the same 1440×1000 desktop viewport; mobile planning is additional.
Physical devices, screen-reader speech and GPU performance were not benchmarked.

This branch targets the prototype branch for a bounded exploration diff. It
inherits its staging configuration unchanged, whose branch guard does not deploy
auditions. No HTTPS audition deployment is configured; no production deployment
or prototype PR merge is part of this milestone.
