# GODMODE server — local prototype, October 25, 2026

Hackathon eligibility remains unconfirmed. This server does not submit projects, create API keys or configure billing. Rule-policy mode works without Meta. Live mode requires a server-only key, `GODMODE_LIVE_ENABLED=true`, and an explicit positive `GODMODE_PROJECT_BUDGET_MICRO_USD` (at most 110,000,000). Those live gates remain unconfigured/disabled in this workspace. Event credits and spending authorization must be verified before configuring them.

The private Site's trusted identity controls production writes: `CREATOR_EMAIL` must match `getChatGPTUser().email`, case-insensitively. Local Vite development bypasses that owner check. No client-provided email authorizes a write. Keep the Site private; do not deploy these routes without its authentication boundary.

Use `env.example` as a reference for local `.dev.vars`; never commit credentials. D1 binding `DB` stores runs, append-only operation batches, unique commands, model attempts, request receipts and budget reconciliation. Request handlers never create or alter tables. The Drizzle migration pipeline owns production schema. Node CLI/tests can use `localSqliteStore(path)` for durable SQLite; this explicit Node-only setup initializes its local file. Cloudflare routes never import Node SQLite.

After building once, apply the unapplied preview migration from the project root:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_abnormal_ezekiel_stane.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_lying_siren.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_white_gabe_jones.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_new_satana.sql
```

Do not replay already-applied migrations. This updates only the local preview. Sites applies the generated `drizzle/` migrations separately during authorized publication.

## HTTP contract

The saved persistent world has its own clock/job service; see [BACKGROUND-UPDATES.md](./BACKGROUND-UPDATES.md) for routes and verified unattended-access requirements. These run endpoints retain the six-hour experiment workflow by default.

All mutation bodies are JSON; errors are `{code,error,incidentId?}` with no provider bodies or credentials. Server failures log correlation IDs, safe database classifications and stack locations; uncontrolled exception messages and request bodies are omitted. Stale writes return 409; callers reload the current head. Mutations require creator authorization in production.

- `GET /api/status`: `metaConfigured`, `liveAvailable`, `configured` (alias for liveAvailable), storage readiness and explicit local-prototype status.
- `POST /api/runs`: `{seed?:integer,mode?:"rule-policy"|"live"|"fixture"}`. Default rule-policy. Live without configured access returns 503 before creating a run.
- `GET /api/runs/:id`: complete committed run DTO.
- `POST /api/runs/:id/command`: `{expectedRevision,commandId,command:{type:"rain"|"resourceDrop"|"message",targetId?,claimId?}}`. The command ID is idempotent and becomes the engine intervention ID.
- `POST /api/runs/:id/advance`: `{expectedRevision,seconds:1..300}`; 60-second chunks recommended. One writer lease and transactional CAS protect each committed batch.
- `POST /api/runs/:id/rewind`: `{expectedRevision,tick}`. Returns readonly `playback:true` without modifying the original head or revision.
- `POST /api/runs/:id/fork`: `{expectedRevision,tick?}`. Creates a fresh branch from a settled five-minute boundary; parent is unchanged.
- `GET /api/runs/:id/export`: recording envelope, original mode, full operation-derived recording, all provider attempt/result audit records and budget. Exact utterances are in recorded decisions; raw visible Meta JSON/usage/response IDs are in provider audit. No private chain of thought is requested or displayed.
- `POST /api/import`: accepts exported envelope or `{recording}`. Verified import is `mode:"recorded"`, readonly until forked. Imported raw provider claims persist separately and re-export as `importedProviderAudit:{provenance:"unverified-import",records:[...]}`; local `providerAudit` stays separate. Imported provenance is not new inference or proof of provider origin.
- `POST /api/replay`: envelope or `{recording}` → verified hash/state, `playback:true`, `modelCalls:0`.

DTO: `{id,revision,mode,state,view,historyStartTick,parentId,createdAt,budget,playback,provenance}`. The history slider range is `historyStartTick..state.tick`; earlier moments belong to retained archives and return `ARCHIVED_HISTORY`422. Persistent rewind/fork supports later days, while scenario playback remains bounded to six hours. `mode` includes rule-policy, live, recorded and fixture. Use `provenance.label`; a live run with a fallback is labeled hybrid. Rendering receives committed state, never speculative state.

## Live adapter and limits

Docs: https://dev.meta.ai/docs/token-counting ; https://dev.meta.ai/docs/reasoning ; https://dev.meta.ai/docs/structured-output . One exact input-token preflight precedes each `muse-spark-1.3` Responses request. Input admission is 2,000 tokens; output cap is 768 **including reasoning**; effort is minimal. There are no hosted tools, hidden auxiliary agents or automatic retries. Strict JSON plus resident-visible IDs and semantic checks constrain decisions. Physical validity is rechecked by the engine.

At most six decisions are dispatched per advance request, with six active generation slots across all runs enforced in SQL. Each attempt is durably reserved first against both its run and the single project-wide ledger. Per run: maximum 500 generation attempts, 1,000 HTTP count+generation requests, 96 event-trigger admissions, and a $3 conservative ledger ceiling. Creating or forking more runs cannot escape the configured project credit cap. The persisted cap can only decrease through runtime configuration; increasing a spent ledger requires a separate explicit administrative change. Reservation is 7,494 microdollars per decision using October 25 published prices plus 30%; this is not a provider-enforced spending cap or a guarantee against pricing changes. Review current terms/prices and authorized credits before enabling live mode.

A disconnected/crashed dispatched request is never blindly retried. After its deadline, its outcome becomes unknown and its reservation is retained as conservatively spent; the engine records a fallback. Provider calls cannot be made exactly once by a SQL transaction. A successful provider result is saved before simulation commit, allowing resume without resending. Unknown charges and late responses must not be represented as zero-cost successes.

Full state heads are capped at 1.8 MB to stay below D1 row limits. Recordings are capped at 12 MB/2,000 operations and bounded replay work. The engine retains 800 recent events for UI; append batches preserve all new derived events and external operations. CPU and full-afternoon storage measurements are required before claiming Cloudflare Free suitability. No full-day 300-tick CPU claim is made.

Local Node/SQLite integration on October25 completed a six-hour baseline in 72 append batches, with a maximum serialized state of 756,915 bytes and identical cold replay hash. The measured 2.1 seconds included replay and is not a Cloudflare CPU measurement. Synthetic provider fixtures verify24 decisions/48 injected HTTP responses, usage accounting and canonical commits; they do not verify live Meta access or behavior.
