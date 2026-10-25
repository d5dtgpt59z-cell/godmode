# Saved world and unattended updates

This is a secular, persistent **rule-policy** world. It uses no model API, API key or paid inference. The original six-hour scenario/run endpoints remain available separately. A saved world is real D1 state; opening or polling its page never advances it.

The server records wall-clock debt at a default pace of 0.1 simulation seconds per real second. Each explicit tick consumes at most 60 owed simulation seconds. Closing a browser does not itself run a Worker: a separately configured cloud schedule must invoke the writer. Until that is configured and exercised, report **saved world, background schedule not active**.

## Routes

- `GET /api/world` → `{world:null}` before creation, otherwise `{world:{revision,paused,pace,run,clock,background,history}}`. `run` is the existing full RunDTO. `clock` has `dueSeconds`, `lastWallAt`, `lastTickAt`, `lastBackgroundTickAt`, `pendingJobId`, and `lastError`. `history` is the 20 most recent durable tick-job receipts.
- `POST /api/world` JSON `{seed?:integer}` creates the singleton once or reuses it. Owner-only.
- `PATCH /api/world` JSON `{expectedRevision,paused?,pace?}` changes its clock. Pace is 0.01..1 simulation seconds per real second. Slow is 0.1; Normal is 1. The UI's explicit Play selects Normal and unpauses; the stored default remains Slow. Owner-only. Paused wall time adds no debt.
- `POST /api/world/tick` JSON `{maxSeconds:60}` executes one bounded catch-up job. At Slow, 30 minutes normally produces 180 owed seconds (three calls); at Normal it produces 1,800 owed seconds (30 calls). Extra elapsed time remains visible as debt; the server does not pretend that unprocessed time has already evolved.
- `GET /api/world/archives` lists up to 100 retained history segments. `GET /api/world/archives/:id` downloads one replayable recording. Every six simulation hours, a settled checkpoint atomically saves the complete preceding segment before replacing the active head. The continuation links its previous archive hash. No archive is deleted by this service.

Each tick has a persisted unique job ID and command receipt. A crash after simulation commit recovers the same receipt instead of advancing twice. World/run leases and SQL CAS serialize writers. There are no browser timers pretending to be unattended execution. `background.serviceTickVerified` proves only that a service invocation was persisted previously; it does not prove a future schedule remains enabled. Local tests and signed-in owner ticks have separate source labels and do not set that service timestamp.

Each RunDTO includes `historyStartTick`: use this as the history slider's minimum, with the current run tick as its maximum. A checkpoint or fork has an earlier-history floor. Rewind/fork requests before that floor return `ARCHIVED_HISTORY`422 and direct the user to retained archives. Persistent playback supports absolute ticks beyond the first six-hour day, with an explicit ten-year absolute clock bound and a separate, unchanged replay-work limit per segment. Scenario runs retain their six-hour bound.

## Root-owned setup after publication

Follow the Sites recurring-update workflow. Confirm the active Site is owner-private and inspect linked automations before creating one. Keep that audience unchanged. Obtain source access and supported Site service access independently. Never place access credentials in source, browser code, schedule prompts or output.

The background writer gate is `GODMODE_BACKGROUND_ENABLED=true`. Configure it only after confirming the private boundary. Signed-in owner calls still use `CREATOR_EMAIL`; a service call carries no visitor identity and relies on Sites Dispatch validating/consuming `OAI-Sites-Authorization: Bearer <supported Site service token>`. Send that credential only to this Site. Do not invent another token, create/rotate credentials just to inspect access, or make the Site public to make updates work.

Exercise `POST /api/world/tick` through that intended service access, then independently read `GET /api/world`: verify saved tick/job history and `lastBackgroundTickAt` changed. This verifies the writer, not a schedule. Only the root should create/reuse a native Sites schedule, for example every 30 minutes in America/Boise. Its future task must retrieve supported access afresh. Keep Meta disabled and final hackathon submission prohibited.

The scheduled task must first read the clock, then process at most 1,800 owed simulation seconds using at most 30 writer calls per occurrence. For each call, choose `maxSeconds = min(60, remaining allowance, whole owed seconds)`. Stop immediately if paused, debt is below one second, or a writer returns409; read back the saved receipts. At Slow this normally needs three calls, and at Normal30. Report repeated errors or remaining backlog; never issue an unlimited catch-up loop. No step enables Meta or incurs inference charges.

Local migrations 0000..0003 have been explicitly applied to the preview only. Production schema remains owned by Sites migrations. D1 row heads/archives are capped at 1.8 MB; recording replay work is bounded. Four-day engine tests and server archival integration support the continuity design, but hosted CPU/free-tier suitability still requires its separate benchmark. Native schedule creation, service-access verification and future execution are distinct milestones.
