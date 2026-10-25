# GODMODE — inspection entry point

Original cozy life sim: deterministic physical simulation, validated natural-language world-rule proposals, persistent evidence and reversible comparisons. Current temporary interpreter is local Qwen; NPC decisions/dialogue remain the recorded rule policy. Meta adapters are implemented but disconnected and unverified.

## Run and verify

Follow README local setup for dependencies and fresh local migrations. Use `npm run dev` for Qwen; its transport hard-requires development mode, explicit local flags and the already-installed pinned Ollama tag. No weights, credentials or local databases are in Git. No automatic model downloads or remote fallback occur. `npm start` uses the production build and keeps local Qwen disabled.

`npm test` passes104 tests. `npm run typecheck`, scoped ESLint and `npm run build` pass. Evidence: `quality/current-refinement-*`, `quality/local-qwen-verification.md`, `quality/local-qwen-evaluation.json` and `quality/dialogue-interaction-qa.json`.

## Source map

- `lib/cozy/`: fixed 100ms movement/crops/resources, rules, goals/memories, physical festival tasks, flood routing, conservation, exact replay/forks. `lib/sim/` preserves the earlier 24-resident engine.
- `lib/server/cozy-*`: SQL lease/CAS, command/clock receipts, archived recordings, validated proposals and explicit Apply. Qwen generation receipts are separate from Meta use/budget. Five real service heldouts and two real browser requests passed; fixtures are labeled separately.
- `components/cozy/`: Phaser stage, game HUD, portrait dialogue and authored pose timing. Dialogue queues only new player-audible spoken events, locks player input and uses a save-bound stop barrier; it never substitutes NPC reasons or old memories for spoken text.
- `public/assets/cozy/`: current runtime background/state pieces, v3 sprites and eight portraits. `art/cozy/character-refinement/v3/` contains original editable Aseprite masters, Lua sources, proofs and audits. Earlier art is preserved. Native art helpers have explicit author-workspace ROOT paths; adjust ROOT when reproducing them in another checkout.
- `tests/cozy-engine.test.ts`, `tests/cozy-server.test.ts`: physical/replay and server/transport tests.

## Boundaries

The map is an original fixed raster with separate semantic pieces, not a fully modular tileset. Supported rules are organizer, venue, food target, seed reserve and bounded low-path flooding. Unsupported mechanics return unsupported/clarify and cannot be applied. Qwen is a temporary local interpreter and does not establish Meta technology compliance. No unattended browser-closed evolution is verified.

The 72-second film’s editable source and exact recordings are included; generated MP4 exports stay local and the film uses first-pass sprites. Current screenshots show the v3 runtime. Hosted deployment is unchanged and final hackathon submission remains ON HOLD. Code/art dates are preserved, including work before the event; admission, pivot and prior-work eligibility remain unconfirmed.
