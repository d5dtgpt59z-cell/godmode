# GODMODE — inspection entry point

Public source mirror: [d5dtgpt59z-cell/godmode](https://github.com/d5dtgpt59z-cell/godmode). Local preview: `http://127.0.0.1:4318/play`. Local saves, credentials, model weights and generated video exports are excluded from Git. Current work is on `codex/wren-inner-life`; the preserved baseline is `ffd02eecddc3998dbee7e36f122306511064ebec`.

## Current implementation

- Black command-line opening → natural-language description → Muse-only blueprint preview → explicit independent paused creation. Stable preview/create receipts survive retries. The current blueprint customizes three resident slots and existing rules on the fixed32×24 neighborhood; new terrain/mechanics are not pretended. **The live creation path is blocked by Meta access.** Continue saved world remains functional.
- Engine3 personal agent: persistent values/preferences, relationships, evidence-backed beliefs, aspirations, missing-capability requests and at most one unfinished three-step plan. Hunger/fatigue can interrupt it. The player can deliver an idea in person; it is remembered as testimony rather than forced adoption. Ada and Mara keep their independent bounded policies.
- Composable social programs: up to six validated steps using travel, meetings, communication, collection, transfer, consumption, rest, observation and timed dance/embrace/kiss gestures. Individuals can decline or withdraw. No food-festival reskin or guaranteed-party sequence. Actual effects are recorded, conserved and replayable.
- Semantic generated props: a luminous mushroom, finite-water rain catcher and usable garden bench. Introduction creates a physical entity and explicit resource allocation. Discovery is proximity-bound and private; no automatic global knowledge. This is a registered image-generated asset catalog, not unlimited runtime content generation.
- Quieter playfield, portrait-led residents, readable needs and personal notes. Technical formulas, raw receipts and exact JSON authoring are behind Developer inspection. Old gardening, social charters, festivals, timeline branching, export/replay and Bellwether remain.
- State-based first-minute guidance, readable **Direct changes** activity/object forms, explicit preview/Apply and an observed-event journal with actual evidence links. Private thoughts stay private; raw JSON stays in Developer inspection. Native gameplay verified finite water6→5, plant/water/harvest/gift with portrait dialogue, and reload paused at8:05am with wheat6/water2.
- Original image-generated replacement art, with source images, prompts, crop/normalization audits and previous assets retained under `art/cozy/imagegen-v4/`.

## Verification and evidence

The integrated suite passes **256/256** tests. Typecheck, scoped ESLint and the final production build pass; current logs are `quality/readiness-*`. See the [native gameplay/reload/replay report](./quality/readiness/VERIFICATION.md). Earlier 220-test logs in `quality/personal-agent/` retain their historical scope. Tests cover needs interrupting/resuming plans, private knowledge, unsupported dreams, physical resource use, differing social choices, idempotent commands, persistence, exact replay and provider gates. Automated model transports are explicitly synthetic fixtures.

Native gameplay on a separate V3 timeline applied a manual rain-catcher proposal with six finite water and a manual social program. Wren declined because he needed food; the journal retained that actual cause. Exact replay after physical collection at3371.4s verified hash `a53fa1c4a471279b5f381c833e242414da13d75e7a03ced7210de61d69c7b9c7` with no new model calls. The player gained one water and the container fell from6 to5. A fresh separate world completed Ada/Wren’s timed gesture while Mara declined; `browser-qa-party*` retains its actual choices and exact replay. Both programs were authored manually, without a model. The paused QA save, recording and replay receipt are recorded in `quality/personal-agent/browser-qa*`. This is physical-engine/UI evidence, **not a claim of a Muse-generated decision**.

One actual local Qwen personal-agent evaluation was made before the user's Muse selection. Its malformed structured plan was rejected before application. Raw input/output/receipt are retained in `quality/personal-local-evaluation.json`; no successful personal-model behavior is claimed from that attempt. Earlier genuine Qwen social-charter evidence remains in `quality/emergence-browser-*`; its frozen V2 final hash remains `fbda78e37755f346589ec291584ae2fddddf947e9f7ceb3f72949689b12c7ebf` at534.8s.

## Source map

| Area | Purpose |
|---|---|
| `lib/cozy/engine.ts`, `personal.ts` | Deterministic physics, bounded personal state/plans/needs |
| `lib/cozy/activities.ts` | Validated composed social actions, consent and timed effects |
| `lib/cozy/world-blueprint.ts`, `world-objects.ts` | Independent world genesis and semantic objects |
| `lib/cozy/v1/`, `lib/cozy/v2/` | Frozen legacy replay implementations |
| `lib/sim/` | Original Bellwether24-resident simulation |
| `lib/server/cozy-*`, `app/api/cozy/` | SQL leases/CAS, receipts, provider quotas, proposals and explicit Apply |
| `components/cozy/world-forge*` | Black entry, honest readiness and recoverable creation |
| `components/cozy/cozy-stage.tsx` | Phaser sprites, physical positions, effects and object interaction |
| `components/cozy/cozy-{resident,world-changes,developer}.tsx` | Human-readable inhabitants, changes and explicit inspection |
| `components/cozy/{direct-world*,play-guide*,cozy-play-guide,cozy-world-history,cozy-history}*` | Direct authoring, state-based onboarding and player-observed linked history |
| `public/assets/cozy/`, `art/cozy/imagegen-v4/` | Runtime art and retained image-generation provenance |

## Model and contest boundaries

Muse Spark1.3 adapters support bounded personal reasoning, rules, activities, objects and world blueprints. Meta calls require explicit provider selection, API key, credit authorization, enabled purpose and positive project budget. Local configuration now selects Meta with credit authorization **false**; credentials remain unchanged and no fallback to Qwen is allowed. Muse Image's separate adapter is fixture-tested but game delivery remains unimplemented. **Actual Muse calls remain zero.** The database retains21 historical local Qwen calls. New preflight checks reject unsupported source/item and object-use combinations without changing legacy accepted-operation replay. Protocol tests cover strict terminal responses, cached-token accounting, returned-image charging and bounded failure receipts; all transport responses are fixtures, not live Muse evidence.

The [current demo plan](./docs/GODMODE-PLAYABLE-DEMO-PLAN.md) is an80–90second capture plan only. The earlier72-second MP4 is historical and predates the current UI/cast. No new video was rendered.

The current **GODMODE** application was received on October25 and shows **Pending**. The user explicitly authorized replacing Worldlift; native unregister succeeded at 22:55:36.993 UTC, followed by the corrected GODMODE application’s “Successfully applied to event” confirmation. View Application shows the GODMODE black-command-line pitch, including the pre-event foundation and pending Muse access. Historical Worldlift records are preserved. October25 is the application deadline (21:59 Boise); completed projects are due November4 at19:00 Boise. Admission notices are due October26 at07:00 Boise. [Official schedule](https://cerebralvalley.ai/e/meta-ai-developer-hackathon). No payment method, API key, credit activation, hosted deployment, unattended schedule or final submission was created in this milestone.

This build is a foundation, not arbitrary executable world modification or simulated human-level intelligence. Broader occupations, institutions, mortality, dynamic terrain and unlimited mechanics remain unimplemented. Worldlift was withdrawn and the replacement application now proposes GODMODE; admission, replacement/duplicate-policy interpretation, organizer approval of the project change, pre-event eligibility and final selected-participant rules still need clarification. Dates and originals are preserved. Final hackathon submission remains **ON HOLD**.
