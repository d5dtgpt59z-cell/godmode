# GODMODE — submission draft

**DRAFT ONLY. FINAL SUBMISSION ON HOLD.** This text is for preparation/review and must not be submitted under the current instruction. Final rules, eligibility, pivot permission and mandatory fields remain unresolved.

Applicant: **Ryan Morrison**, founder of Built by Magnus LLC, Creative Director at North of Common Capital, independent developer. Existing application track: Indie Dev; submitted proposal: Worldlift. Snapshot: October 25, 2026.

## Title and intended experience

**GODMODE — A small world. Its own ideas.**

Grow a little wheat. Give a neighbor something useful. Then ask what should change in your town.

GODMODE is a secular cozy game about living inside a small world whose rules can change while you play. You plant, water and harvest wheat; meet Ada, Mara and Wren; and prepare a harvest festival. The neighbors have different needs, goals, trust, memories and reasons to help. The interesting moment is handing the festival over to them: food still has to be found and carried, timber fetched, setup completed, invitations delivered and people physically brought together.

The larger thesis is to let a player propose a rule in ordinary language, review a validated interpretation, and watch a persistent world adapt. Designers could use the same recorded branches to inspect how a small rule changes coordination. This is a fictional game environment, not a prediction of human communities or a claim of conscious characters.

## Implemented now

The current local slice has one controllable player and three neighbors, fixed 100 ms simulation, finite inventories, wheat growth/harvest, gifts and differing reactions, needs/goals/memories, actual NPC festival tasks and bounded low-path flooding. Typed rules change festival organizer, venue, food target, seed reserve and flood policy. Preview shows an exact diff; Apply is explicit. Revert restores prior rules prospectively. Historical Undo forks the exact operation prefix and preserves the original timeline, including prior same-step actions.

Separate D1/SQLite saves, wall-clock debt, idempotent commands/ticks, import/export, exact replay, archived segments and equal-time comparisons are implemented. New neighborhoods do not overwrite older ones. The original 24-resident Bellwether engine/saves are preserved separately.

**All demonstrated decisions currently use the labeled rule policy.** The exact rule editor is functional. Local Qwen now interprets bounded rule requests into validated previews requiring explicit Apply. Five actual held-out service requests passed; this is temporary local behavior, not Meta eligibility evidence. Meta rules and optional NPC-plan adapters remain disconnected; there is no fake language interpretation or template fallback. Real Meta behavior, latency and costs remain unverified. The new cozy build is local only by the user’s explicit request, “Keep it local for now.” The user subsequently authorized the private GitHub source mirror [d5dtgpt59z-cell/godmode](https://github.com/d5dtgpt59z-cell/godmode) for inspection. No new hosted deployment, schedule or credentials are authorized; the prior private release remains unchanged.

## Intended Meta role — not yet demonstrated

The hosted adapter is designed to use Spark to translate a request into a supported structured proposal. Schema/capability bounds, current-rule revisions and physical preconditions are enforced by the server. The model cannot generate executable code, spawn arbitrary goods or invent unsupported systems. Apply remains a separate owner action.

An optional event planner can propose intentions for Ada, Mara and Wren using each person's own context and received evidence. Actual paths, reservations, work, spending and festival attendance remain engine-owned. Model calls are bounded and audited; there is no continuous inference inside the physics loop. Imported receipts remain explicitly unverified claims.

A local Llama 3.2 path was researched because the event lists Meta open weights. It has not been downloaded or used; the user chose existing Qwen instead and no Llama agreement was accepted. It is an alternative investigation, not a working feature or a solution to hosted-provider access. The local-only instruction does not grant model-license consent.

Do not describe this draft as a finished Meta-powered entry until an authorized real model path has been integrated, tested and retained with actual receipts/results. No API key, billing plan or purchases have been added.

## Demonstration and evidence plan

Show one complete, understandable play loop: grow wheat, meet/gift the neighbors, preview and apply villagers-organize, then follow actual food/setup/invitation/attendance events. Compare a preserved branch at the same logical time. Demonstrate flood routing and prospective Revert separately, then use exact historical Undo and verify a recording with no inference.

The completed [72-second cozy prototype film](./demo/cozy/godmode-cozy-prototype-72s.mp4) uses actual recorded rule-policy states with editorial camera/time compression. Its [source ZIP](./demo/cozy/godmode-cozy-demo-source.zip), source/recording audits and encoded-contact-sheet visual review are complete. It is not live Meta output or footage of the UI being operated. The earlier 56-second film remains preserved as a superseded prototype. Neither duration is an established official requirement.

If real Meta access is later cleared, capture the real interpretation, explicit preview/apply, three bounded NPC plans, actual usage/failures and a held-out request/behavior check. Keep manual, model, fixture, imported and edited footage labels accurate. The current Qwen full suite passed 104/104 and typecheck passed ([actual Qwen report](./quality/local-qwen-verification.md)). The [current integrated production build](./quality/current-refinement-build.log), typecheck and scoped lint passed. The current full suite passed 104/104; real browser Qwen and portrait dialogue checks passed. Browser QA passed exact replay, paired branch/comparison at 1497.3 seconds, prospective rule restore and historical Undo; saved reload, camera fit, well interaction and keyboard movement also passed.

## Provenance, package and stop

The new art uses an original concept-derived background with two built-in image edits and native Aseprite processing. Player/NPC animation and foreground pieces are original native Aseprite/Lua construction. The earlier concept used one separate generation call. Code and art were Codex-assisted; disclose that and true October 25 work dates as required. No protected game raster assets were imported.

Preserve the local source/package hashes, reproducible build/test instructions, complete recordings/linked archives, art/demo source packages and rights/assistance notices. Keep this release local; any future publication or judge-access change needs a later user instruction. Check the [official event](https://cerebralvalley.ai/e/meta-ai-developer-hackathon), [Meta event](https://dev.meta.ai/events/global-hackathon), [waiver](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver) and actual participant [final portal](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit). No final form field, video format, repository visibility or eligibility approval is established by this draft.

**STOP before final submission.** Local completion, a private deployment, license consent or working inference would not remove the user's hold.
