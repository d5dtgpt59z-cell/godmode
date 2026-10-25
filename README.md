# GODMODE

A secular living-world experiment/game by **Ryan Morrison — founder of Built by Magnus LLC, Creative Director at North of Common Capital, and independent developer**.

Twenty-four residents carry supplies, bake, build, eat, trade information and form individual beliefs in Bellwether. Observe their limited knowledge, change the weather or supplies, deliver an ordinary note, then inspect or branch the recorded consequences. The presentation uses original anime-inspired chibi pixel art. There is no religious or deity mechanic.

**October 25, 2026: local prototype; final hackathon submission ON HOLD.** Ryan authorized implementation and preparation, with an explicit stop before final submission. This is currently a working **rule-policy** simulation. The Meta adapter is implemented and fixture-tested, but no real Meta inference has run. Competition eligibility, the Worldlift-to-GODMODE pivot and final participant rules remain unresolved. See [COMPLIANCE.md](./COMPLIANCE.md) and [SUBMISSION-DRAFT.md](./SUBMISSION-DRAFT.md).

## Current release state

| Area | Verified or reported state |
|---|---|
| Simulation | Pure TypeScript, 24 distinct residents, local knowledge, finite goods, directed relationships and sourced beliefs; scenario and continuing-world modes. |
| Persistence | Local SQLite/D1 routes verified, saved wall-clock debt, pause/pace controls, serialized tick jobs, crash recovery and immutable history segments. |
| Presentation | Phaser renderer, original chibi assets, corrected normalized sprite anchors and six-step tutorial component. Latest saved-world UI integration and browser QA are still in progress. |
| Meta | Server adapter, strict decisions, token preflight, durable usage/budget accounting and injected synthetic tests. Real account access and behavior are unverified. |
| Hosting | Owner-private Site registered as `appgprj_6ade1785d97081918bf2848820894406`; deployment has not yet been confirmed. |
| Background | Writer implemented. No unattended writer invocation or active native schedule has been verified. |
| Final package | Source, art and draft documentation exist. Release commit, final demo video, official field mapping and final submission are pending. |

The expected private address is [godmode-by-magnus.magnusrobot.chatgpt.site](https://godmode-by-magnus.magnusrobot.chatgpt.site/). **This address is not evidence of a deployment.** Private access requires the Site's supported authentication.

## Run locally

Use Node.js **22.13 or newer**. Node's SQLite support is used only by local tests/tools; hosted routes use D1.

```sh
npm run install:ci
npm run build
```

Apply each **unapplied** local migration in order after the build creates its Wrangler configuration:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_abnormal_ezekiel_stane.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_lying_siren.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_white_gabe_jones.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_new_satana.sql
npm run dev
```

Use the printed loopback URL; the current QA preview uses port 4318. Local migrations 0000–0003 were already applied to this workspace's preview database: **do not replay them here**. A fresh checkout has a separate database. `npm start` previews the built Worker locally; it does not deploy it. Local Vite development permits the local preview's write flows; production still requires trusted owner access.

After changing `db/schema.ts`, use `npm run db:generate` to append a migration. Request handlers never create or alter schema. Do not edit applied migrations. Preserve the Sites/Vinext integration and `.openai/hosting.json`. Production publication must use the supported Sites build/source/deployment workflow, which applies hosted migrations separately. It is not performed by the commands above.

## Explore

- **Saved world:** `GET /api/world` restores the same town. Explicit Play selects Normal pace, one simulated second per real second; Slow is 0.1. The server consumes owed time only through bounded `/api/world/tick` jobs. Paused wall time adds no debt.
- **Separate experiments:** six-hour afternoons end at tick 21,600. Their controls and recordings remain separate from the saved world's clock.
- **Information:** select/follow a resident, inspect their received observations, goals and stated reasons, then use the belief lens or chronicle. The observer knows more than any resident; a rumor is not a world fact.
- **Interventions:** rain, a finite supply delivery and ordinary notes change conditions. They do not prescribe a resident's response.
- **History:** rewind within `historyStartTick..state.tick`; fork at a settled five-minute boundary. Earlier segments remain under `/api/world/archives`. Export/import and cold replay retain explicit provenance and use no new inference.
- **Art book:** open `public/assets/viewer.html` directly, or `/assets/viewer.html` through the preview. It embeds the PNG/JSON bytes and needs no model service.

The UI/tour paths require the latest integrated browser check; this README does not claim that final QA has finished.

## Architecture and server configuration

`lib/sim/` owns deterministic one-second physical ticks, permissions, resources, observations, memories, beliefs, decision barriers and replay. `lib/server/` owns D1/SQLite, identity, clocks, provider requests and budget receipts. `components/town-stage.tsx` renders committed state; Phaser owns no authoritative economy. See [simulation contract](./lib/sim/README.md), [server API](./lib/server/README.md) and [background access/setup](./lib/server/BACKGROUND-UPDATES.md).

Production writes require the trusted signed-in email to match server-only `CREATOR_EMAIL`. The registered Site is owner-private. The background writer's service path relies on the confirmed private Sites Dispatch boundary and an explicit `GODMODE_BACKGROUND_ENABLED` gate; it does not obtain visitor identity or app consent from a service token. Never make the Site public to make that writer work.

| Server binding | Purpose/current gate |
|---|---|
| `DB` | Required D1 storage binding, declared in the hosting manifest. |
| `CREATOR_EMAIL` | Owner check; configured privately from the native Site owner. No value belongs in source. |
| `GODMODE_LIVE_ENABLED` | Currently false. |
| `MODEL_API_KEY` | Absent. No key was created. |
| `GODMODE_PROJECT_BUDGET_MICRO_USD` | Absent. A positive explicit project cap is required before live mode, up to 110,000,000 microdollars. |
| `GODMODE_BACKGROUND_ENABLED` | Writer gate only; not proof of a schedule or unattended execution. |

Use [env.example](./lib/server/env.example) only as a key-name reference. Keep actual local values in ignored `.dev.vars`; never use client-exposed prefixes or commit credentials/runtime state.

The proposed live decision path uses `muse-spark-1.3`, exact input-token preflight, 2,000 input tokens, 768 total output tokens including reasoning, minimal reasoning and strict JSON plus semantic validation. Durable reservation/reconciliation covers both the run and the project. Limits are six active generations across runs, 500 generation attempts/1,000 count-plus-generation HTTP requests/96 event admissions per run, and a $3 per-run ledger ceiling. These are application controls, not a provider-enforced spending guarantee. Do not enable live mode until eligibility, account/credits, prices and spending authorization are verified. Official API references: [token counting](https://dev.meta.ai/docs/token-counting), [reasoning](https://dev.meta.ai/docs/reasoning), [structured output](https://dev.meta.ai/docs/structured-output).

Background scheduling is a distinct pending milestone. The proposed native schedule runs every 30 minutes in America/Boise and processes at most **30 requests / 1,800 owed simulation seconds** per occurrence. At Slow it normally needs three requests; at Normal, thirty. It stops on pause, exhausted debt or writer conflict, retains excess debt, and never enables inference. A past service receipt does not prove a future schedule remains enabled.

## Assets and verification

The current version-2 manifest records **1,861 named frames**: 1,728 character poses, 70 town keys and 63 object keys. Town/object keys include aliases; these are not 1,861 unique raster images. There are 24 residents and **576 character animations**. Editable Aseprite files, Lua construction source, contact sheets, hashes, native pixel audits and the anchor regression check are included. No remote image model or third-party game raster asset generated this pack. See [art provenance and reproduction](./art/README.md) and [manifest](./public/assets/manifest.json).

The sibling `../godmode-sprite-pack.zip` currently contains the earlier version-1 manifest; regenerate and verify it before presenting it as the current chibi pack. Runtime/source version 2 and its offline viewer are current. No separate public asset-pack license has been granted.

```sh
npm test
npm run typecheck
python3 art/check-package.py
```

`quality/test-results.tap` records **44 tests passed, zero failed** in the saved full-suite run. Later targeted tests also verified persistent rewind/fork beyond the first six hours and archive-floor errors. Tests cover conservation, knowledge isolation, exact replay/forks, malformed decisions, budgets, concurrency, durable restart and crash recovery. Provider-shaped fixtures are injected transport tests; they are not live Meta results. The two `quality/browser-cute-tutorial-*` images are intermediate browser evidence, not completion of the latest UI or a final demo video.

Node/SQLite afternoon and multi-day checks do not establish Cloudflare Free CPU compliance. Active heads/archives have 1.8 MB caps and replay work is bounded; hosting limits, final integrated browser behavior, private service access and unattended scheduling still need their respective checks.

## Release and submission

Freeze the final source revision, run the clean install/build/tests, verify art hashes and refresh the asset zip, retain one export plus all linked archive segments, test import/replay in a fresh database, then capture the actual supported mode. Record commit/package hashes, exact provenance, real measured usage if live access becomes available, dependency/asset rights and remaining limitations. Do not relabel a rule run or imported claim as live Meta.

The application was received with native Pending status; it proposed **Worldlift**. That is separate from this project and from a final-project receipt. The public rules review last performed October 25 did not settle pre-event work, pivot permission or final form fields. This prototype and its assets began on **October 25, before the October 26 event start**. Preserve that date and disclose/rebuild as later official instructions require. Final submission remains **ON HOLD under the user's explicit instruction**, even after publication or preparation succeeds.
