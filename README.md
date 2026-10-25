# GODMODE

**A small world. Its own ideas.**

Grow wheat, get to know three neighbors, and change who organizes the harvest festival. Carry real supplies, watch people take on food, setup and invitation work, then branch the record and try another rule. GODMODE is a secular cozy game by **Ryan Morrison — founder of Built by Magnus LLC, Creative Director at North of Common Capital, and independent developer**.

The larger thesis is a living world whose rules you can propose in your own words, review as concrete changes, and then observe in play. **Today the playable slice uses deterministic rule-policy behavior and a working exact rule editor.** Natural-language rule interpretation now works locally through the existing Ollama `qwen3.5:9b`; it produces validated previews requiring explicit Apply. NPCs still use the rule policy. Meta language/NPC adapters remain disconnected and unverified; Qwen is not counted as Meta. There is no keyword-based substitute presented as AI.

**October 25, 2026 snapshot: the new cozy slice is LOCAL ONLY at the user’s explicit request, “Keep it local for now.” Final hackathon submission is ON HOLD.** GitHub source delivery has now been requested for project inspection; the destination is being confirmed. Hosted deployment, schedules, new credentials and final submission remain on hold. The earlier owner-private Bellwether release remains unchanged. This prototype and its assets began before the announced October 26 event start; eligibility and the application-idea pivot remain unconfirmed. See [COMPLIANCE.md](./COMPLIANCE.md) and [SUBMISSION-DRAFT.md](./SUBMISSION-DRAFT.md).

## Latest inspection snapshot

The current cast has grounded adult life-sim proportions and eight original 96×96 neutral/warm portraits. When an NPC actually speaks to the player, the game shows that speaker’s portrait and literal recorded line in a dialogue box. Continue/Enter returns control; reading locks movement. Old dialogue is not replayed on load. Previous casts and all saved worlds remain preserved.

![Current portrait dialogue](./quality/portrait-dialogue-desktop.jpg)

Start with [PROJECT-INSPECTION.md](./PROJECT-INSPECTION.md) for the source map, current verification and limits. The GitHub copy is for source inspection; the playable preview remains local and final hackathon submission remains on hold.

## Play and preserved work

| Working-tree route | Experience |
|---|---|
| `/` | New cozy neighborhood; the primary game entry. |
| `/play` | The same cozy game. |
| `/bellwether` | Preserved 24-resident experiment/continuing-town interface. |

The cozy loop is plant → water → harvest → give a gift → change a festival rule → observe the response. Ada, Mara and Wren have individual needs, goals, trust, preferences and bounded memories. Their current choices and dialogue are rule-policy behavior. Food, timber, seed protection, work duration, movement, invitations and flood routing belong to the physical simulation, rather than being visual counters.

Use click-to-walk or WASD/arrows, the garden tools, journal and Town rules. The exact editor supports organizer, venue, food target, seed reserve and bounded low-path flooding. Preview shows the actual diff before Apply. Revert changes rules prospectively; historical Undo creates a separate branch using the exact operation prefix. Harvests, spent goods and memories are not erased from the original timeline. Unsupported language requests cannot create new mechanics.

The old `lib/sim/` engine, routes and saves remain intact. The cozy engine is separate in `lib/cozy/`; server/API additions use separate cozy tables. Preservation artifacts are the Git tag `godmode-before-cozy-20261025`, sibling [Git bundle](../godmode-before-cozy-20261025.bundle), and [local world backup](../godmode-local-world-backup.json). The earlier [56-second film](./demo/godmode-prototype-56s.mp4) remains a legacy artifact, superseded for the current pitch.

## Current release and evidence

- **Cozy local implementation:** farming, four actors including the player, three NPCs with needs/goals/memories, gifts, physical festival tasks, bounded floods, typed rule proposals, apply/revert, exact Undo, comparison, save/export/replay and real clock debt.
- **Local verification:** [quality/cozy-test-results.tap](./quality/cozy-test-results.tap) records the prior **95-test** release. The current [Qwen full suite](./quality/local-qwen-full-tests.tap) passed **104/104**, and [typecheck](./quality/local-qwen-typecheck.log) passed. The [current integrated build](./quality/current-refinement-build.log), [typecheck](./quality/current-refinement-typecheck.log) and scoped lint passed; [current full suite](./quality/current-refinement-tests.tap) passed 104/104. Real browser Qwen and portrait dialogue checks passed. Browser QA passed exact replay, a paired branch and comparison at the same 1497.3 simulated seconds, prospective rule restore and historical Undo. Saved reload retained inventory, rule history and the completed 3-person festival. Native screenshot: `quality/cozy-local-browser-final.jpg`. Scoped ESLint also passed.
- **Input timing:** command transactions consume owed 100 ms steps under the previous intent before recording a new command. 100/200 ms move-stop tests and actual local HTTP testing establish authoritative movement/replay. Duplicate commands consume nothing again; more than 60 seconds of debt returns `COZY_CATCH_UP` until bounded ticks flush it.
- **New film:** the completed [72-second cozy prototype](./demo/cozy/godmode-cozy-prototype-72s.mp4) and [editable source ZIP](./demo/cozy/godmode-cozy-demo-source.zip) passed source/recording audits and visual review of encoded contact sheets. It presents recorded rule-policy states with editorial timing, not footage of product controls or live Meta. Its generated MP4 is retained locally and excluded from Git; editable source/recordings are included. It predates the v3 character/portrait update. Official final-video requirements remain unknown. See [film provenance](./demo/cozy/README.md).
- **Deployment:** the native receipt for the older private release is `appgdep_6ade24250c848191a27a50675c8972d7`, source commit `c80fd18c94fda81a069369d93f857edd5bf31fc7`, October 25 at 15:45:51 UTC. [Private Site](https://godmode-by-magnus.magnusrobot.chatgpt.site/) access requires supported authentication. The cozy build remains local only; GitHub source delivery is now requested for inspection; no hosted deployment is authorized. That receipt belongs only to the unchanged legacy release.
- **Background:** bounded service-capable writers exist. No active native schedule or successful unattended cozy tick has been verified. Browser-driven updates are not unattended operation. The local-only instruction excludes creating a hosted schedule.

## Local setup and reproduction

Use Node.js 22.13 or newer. Local tests use Node SQLite; hosted routes use D1. The project retains the Sites/Vinext framework integration.

```sh
npm run install:ci
npm run build
```

After a fresh build creates `dist/server/wrangler.json`, apply only pending local migrations, in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_abnormal_ezekiel_stane.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_lying_siren.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_white_gabe_jones.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_new_satana.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0004_boring_pestilence.sql
npm run dev
```

Migrations 0000–0004 are already applied to this workspace's local preview. Do not replay or edit them. A fresh database is separate. New schema changes append a Drizzle migration; handlers never run DDL. `npm start` previews the built Worker locally and does not deploy it. **Keep this build local under the current user instruction.** GitHub source export is authorized for inspection; hosted migrations, deployment, schedules and credential changes remain outside this step. The existing private legacy Site stays unchanged.

Use the printed loopback address; current local QA uses port 4318. New cozy saves start paused. `POST /api/cozy {seed?,fresh:true}` creates another independent neighborhood without changing the primary or older saves. The Help action “New neighborhood · keep this one saved” uses this path.

```sh
npm test
npm run typecheck
```

The current integrated release passed 104 tests, typecheck, scoped ESLint and the local production build. See `quality/current-refinement-{tests.tap,typecheck.log,lint.log,build.log}`. Real browser Qwen preview/apply/unsupported/replay checks and portrait dialogue checks passed. Browser replay, branch/comparison and rule-history checks passed; saved reload, minimum camera fit, illustrated well hitbox and keyboard movement also passed. Preserve the final local source/package hashes and retained recording/archive lineage. The completed film’s replay/render/encoded-frame checks are documented in `demo/cozy/README.md`. A finished local artifact does not establish official submission-format compliance.

## Server, persistence and provenance

[cozy-api.ts](./lib/server/cozy-api.ts) documents the exact HTTP contract; [cozy-contract.ts](./lib/server/cozy-contract.ts) contains client DTOs. `/api/cozy` creates/loads the main save, `/:id/command` applies validated actions, `/:id/tick` consumes bounded owed time, and rule endpoints separate preview, real-model proposals, Apply and Revert. Import/replay/fork/compare/archive endpoints preserve explicit provenance. Exact Undo supplies an operation index and history-origin hash, preserving prior same-step actions.

Cozy physics uses fixed 100 ms steps. State, command receipts, clock debits and audit records commit through SQL lease/CAS transactions. 100 ms is the authoritative input resolution. GET never advances. Saved heads/archives are capped at 1.8 MB, recording work is bounded, and older segments are retained before checkpoint replacement. Existing-database upgrade, restart, concurrency, no-double-dispatch, conservation and replay checks are included. Hashes establish deterministic consistency, not signatures or proof that a provider generated an imported claim. Hosted CPU/resource suitability remains a separate verification.

Production writes require the trusted creator identity and preserve the Site's owner-private audience. Only bounded tick writers additionally support the existing private Sites service boundary. Service access is not visitor identity and cannot authorize rule editing. No source file or client response contains a key value.

| Server binding/gate | Current status |
|---|---|
| `DB` | Required D1 storage. 0004 adds separate cozy tables and a shared model-job purpose defaulting to `resident`. |
| `CREATOR_EMAIL` | Privately configured from the native Site owner. |
| `MODEL_API_KEY` | Absent; no key created. |
| `GODMODE_PROJECT_BUDGET_MICRO_USD` | Absent; a positive explicit project cap is required for model calls. |
| `GODMODE_RULE_AUTHORING_ENABLED` | Meta-based natural-language interpretation remains off; the local Qwen route works separately. |
| `GODMODE_COZY_NPC_ENABLED` | Optional Meta plans for the three NPCs remain off/unconfigured. |
| `GODMODE_LIVE_ENABLED` | Legacy resident live mode remains false. |
| `GODMODE_BACKGROUND_ENABLED` | Writer gate only; never proof of a schedule or unattended execution. |
| `GODMODE_LOCAL_QWEN_ENABLED` | Explicitly true only in local `.dev.vars`; adapter also requires development mode. |
| `GODMODE_LOCAL_QWEN_MODEL` | Existing approved `qwen3.5:9b` tag and observed digest; no downloads or remote fallback. |

Local authoring uses fixed server-only loopback Ollama with JSON schema, 4096 context, 768 output, thinking off, 90-second deadline, one active local generation and durable request receipts. Five actual held-out service requests passed: three supported changes and two honest unsupported outcomes. Local calls/provenance are separate from Meta; Meta budgets remain untouched. Use `npm run dev`, not the production-build preview, for this temporary local model. See [actual receipts, limits and verification](./quality/local-qwen-verification.md).

The implemented hosted adapter requests `muse-spark-1.3` with exact token preflight, 2,000 input tokens, 768 total output tokens including reasoning, minimal effort and strict schemas plus current-world validation. Rules produce proposals, never automatic application. NPC plans use individual received evidence and actual task/resource limits. No model inference runs continuously inside ticks. All transport tests use labeled fixtures.

Model requests share the existing project ledger and six-generation concurrency limit. Cozy saves retain 500 generation attempts/1,000 count-plus-generation HTTP requests / $3 reservation limits. Unknown outcomes stay conservatively charged in the application ledger; retries do not blindly resend an attempt. These controls are not a provider-enforced spending guarantee. [Token counting](https://dev.meta.ai/docs/token-counting), [reasoning](https://dev.meta.ai/docs/reasoning), [structured output](https://dev.meta.ai/docs/structured-output).

A local **Llama 3.2** alternative was researched because the event lists Meta open weights. It has **not been downloaded, accepted or used**. The user chose existing Qwen for now; no Llama agreement was accepted. Separate consent would be needed if that choice changes. “Keep it local for now” does not authorize accepting this license or downloading a model. Acceptance would still leave integration and real behavior tests to do; it would not connect the hosted NLP surface by itself. Hosted interpretation currently needs a verified provider path. No billing or purchases have occurred.

## New art and retained media

The current v3 cast/portraits are in [character-refinement/v3](./art/cozy/character-refinement/v3/README.md); the broader production set is [art/cozy/](./art/cozy/README.md) and `public/assets/cozy/`: a 512×384 fixed environment, four 24×32 character sets with 288 poses / 96 clips, and separate crop/gift/goods/festival/flood overlays. It is not a modular architecture tileset. Geometry masks and visual anchors are audited against interaction targets.

The environment derives from the original project concept and **two built-in image-edit calls**, followed by native Aseprite resize/palette work and authored path clearance. The earlier concept used one separate image-generation call. Characters and foreground sprites were constructed natively with Aseprite/Lua; no remote character-generation calls or protected game raster imports were used. This supersedes earlier blanket “no image generation” wording for the project's new background. See [runtime provenance](./public/assets/cozy/provenance.json), [archived first-pass source manifest](./art/cozy/ART-MANIFEST.json), [first-pass art source zip](./art/cozy/cozy-art-source.zip) and [current v3 audit](./art/cozy/character-refinement/v3/v3-report.json).

The asset room is `/assets/cozy/viewer.html`; it stages art, not gameplay. The older sprite pack and 56-second film remain preserved as earlier-revision artifacts. No separate public asset-pack license is granted by these manifests. Dependency/asset rights and required AI-assistance disclosures still need final review.

## Submission boundary

The application was received with Pending status and proposed **Worldlift**. Admission, project-pivot permission, final selected-participant rules, permitted prior work and final portal fields remain unresolved. Current code/art dates are October 25, before the announced October 26 start. Preserve those dates and comply with later disclosure/rebuild requirements.

The intended final pitch now follows the cozy loop and validated-rule thesis. Actual eligible Meta behavior, the official final-video format, final source package, judge access and field-by-field compliance still need evidence. **Final submission remains ON HOLD under the user's explicit instruction**, even if a later private deployment or preparation milestone succeeds.
