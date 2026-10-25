# GODMODE — inspection entry point

Public source mirror: [d5dtgpt59z-cell/godmode](https://github.com/d5dtgpt59z-cell/godmode). This repository contains the project source and editable art; local saves, credentials, model weights and generated video exports remain on the author’s machine.

Original cozy life sim: deterministic physical simulation, validated natural-language world-rule proposals, persistent evidence and reversible comparisons. Local Qwen now also generates bounded resident-origin cooperative charters in an optional living branch. Neighbors must hear them physically before choosing independent policy responses; associations persist and can carry out finite gathering work. Meta adapters remain disconnected and unverified.

## Run and verify

Follow README local setup for dependencies and fresh local migrations. Use `npm run dev` for Qwen; its transport hard-requires development mode, explicit local flags and the already-installed pinned Ollama tag. No weights, credentials or local databases are in Git. No automatic model downloads or remote fallback occur. `npm start` uses the production build and keeps local Qwen disabled.

`npm test` passes147 tests. `npm run typecheck`, scoped ESLint and `npm run build` pass. Current evidence: `quality/emergence-*`. Earlier evidence is preserved in `quality/current-refinement-*`, `quality/local-qwen-verification.md` and `quality/dialogue-interaction-qa.json`.

Start with [architecture audit and migration plan](./docs/EMERGENCE-PLAN.md). In actual native gameplay Wren proposed a four-grain gathering, Ada joined, Mara withheld consent until witnessing a real harvest, and the group used real grain, timber, travel and labor. [Browser report](./quality/emergence-browser-qa.json) and [recording with frozen inputs/raw receipts](./quality/emergence-browser-recording.json) retain the evidence. Exact replay at534.8s produced `fbda78e37755f346589ec291584ae2fddddf947e9f7ceb3f72949689b12c7ebf`; reload retained the completed meal and three-member association. One separate actual-model service run plus four browser calls used Qwen; Meta calls remain zero.

## Source map

- `lib/cozy/`: fixed 100ms movement/crops/resources, rules, goals/memories, physical festival tasks, flood routing, conservation, exact replay/forks. `lib/cozy/v1/` freezes the old engine; three captured pre-change recordings reproduce exact hashes. Explicit `upgradeCozyWorld` forks into engine2 without changing the parent. `lib/sim/` preserves the earlier24-resident engine unchanged.
- `lib/server/cozy-*`: SQL lease/CAS, command/clock receipts, archived recordings, validated proposals and explicit Apply. Qwen generation receipts are separate from Meta use/budget. Five real service heldouts and two real browser requests passed; fixtures are labeled separately.
- `components/cozy/`: Phaser stage, game HUD, portrait dialogue and authored pose timing. Dialogue queues only new player-audible spoken events, locks player input and uses a save-bound stop barrier; it never substitutes NPC reasons or old memories for spoken text.
- `public/assets/cozy/`: current runtime background/state pieces, v3 sprites and eight portraits. `art/cozy/character-refinement/v3/` contains original editable Aseprite masters, Lua sources, proofs and audits. Earlier art is preserved. Native art helpers have explicit author-workspace ROOT paths; adjust ROOT when reproducing them in another checkout.
- `tests/cozy-{engine,server,emergence,presentation}.test.ts`, `tests/emergence-server.test.ts`: old functionality plus private knowledge, differentiated consent, resources/time, multiple work rounds, persistence/replay, asynchronous receipts, recovery, pause, limits and presentation tests. Model transports in automated tests are labeled fixtures; real local receipts are separate evidence.

## Boundaries

The map is an original fixed raster with separate semantic pieces, not a fully modular tileset. Supported rules are organizer, venue, food target, seed reserve and bounded low-path flooding. Unsupported mechanics return unsupported/clarify and cannot be applied. The sole executable institution capability is shared gathering: immutable charters, no member-leave operation, one shared festival account. General beliefs, rich pairwise relationships, new professions, death and broad terrain transformations remain future work. Qwen does not establish Meta technology compliance. No unattended browser-closed evolution is verified. See [fresh official-rules and Meta options research](./docs/META-STATUS-20261025.md).

The 72-second film’s editable source and exact recordings are included; generated MP4 exports stay local and the film uses first-pass sprites. Current screenshots show the v3 runtime. Hosted deployment is unchanged and final hackathon submission remains ON HOLD. Code/art dates are preserved, including work before the event; admission, pivot and prior-work eligibility remain unconfirmed.
