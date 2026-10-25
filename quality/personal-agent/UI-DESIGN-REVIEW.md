# Cozy UI review and focused implementation

The original village art is the visual source. This pass changes DOM presentation and interaction coordination; it does not replace the map, character sprites, portraits, engine or server.

## Fresh baseline, inspected in this audit

The parent captured and accepted these native-browser screenshots from the same paused saved neighborhood, at 604 × 984. Each saved file was opened with `view_image` before this review.

1. **Resident page — usable, impersonal presentation.** `audit-before/01-resident.jpg`: Wren's name and social actions are clear, but a portrait is absent. Activity appears twice. Numeric trust, a policy formula and tiny raw memory IDs dominate the page. The revision leads with the original portrait, one accepted activity, current needs, chat/gift actions, and private personal notes. Formula calculations remain available through Developer inspection.
2. **Playfield — strong world, competing HUD.** `audit-before/02-playfield.jpg`: detailed original architecture and characters carry the experience. A task panel, header cluster, toolbelt, full-width rules prompt, zoom/direction controls and footer compete for attention. The revision uses one compact toolbelt with a Rules tool and one small clock/pause cluster. The stage integration uses `--cozy-playfield-inset:96px` desktop / `108px` narrow to reclaim the old two-layer HUD reservation.
3. **Journal — real consequences, too much repetition.** `audit-before/03-journal.jpg`: actual independent responses and shared plans are valuable, but repeated headings, formula scores and repeated festival counters make the page feel like a ledger. The revision starts with neighbors, keeps the latest shared plan readable, folds basket/gathering details, and moves call counts, hashes, source IDs and raw policy reasons into explicit Developer inspection.

## Wren's inner-life presentation

- An explicit **Explore Wren’s inner life** action creates the server-owned independent paused branch. It does not silently upgrade the old town or request a model decision.
- Wren's portrait page shows current physical needs, wishes, typed supported plan steps, belief uncertainty/source kind, relationships and prior attempts as personal notes. It distinguishes private knowledge from overheard speech.
- An unfinished aspiration remains unfinished even when a small supported plan completes. Missing mechanics are described as unavailable; there is no invented Apply button.
- **Tell Wren an idea** queues a physical approach and attributed command. The draft survives cancelled/failed delivery and clears only after an accepted server command. NPC tracking uses the current actor position, meaningful reroute intervals and bounded attempts.
- Actual recorded portrait dialogue keeps its existing queue, movement stop barrier and verbatim speech. Source policy formula text is summarized only in observer notes, not silently rewritten in historical utterances.

## Evidence and limits

- `ui-presentation-tests.tap`: **21/21** tests passed, including recovery, private-event notices, exact permission previews, portrait/needs presentation, diagnostic separation, aspiration-versus-step completion, field labels and bounded moving-neighbor tracking.
- `ui-typecheck.log`: `npx tsc --noEmit`, exit 0.
- `ui-lint.log`: scoped UI/test ESLint, exit 0.
- All source IDs, raw reasons and retained causal receipts remain reachable in Developer inspection; History still provides recording download, branching and exact replay.
- Fresh native-browser after-state review belongs to the integration pass. Static React checks do not establish responsive fit, touch behavior, full keyboard accessibility or live-model quality. No new inference, remote media generation, deployment, push or final submission was performed in this UI task.

## Final native after-audit

All five parent-captured files in `audit-after/` were opened with `view_image` and accepted for this visual review. The manifest retains their hashes. This later integration includes the separate v4 imagegen art replacement; the original UI-only scope above describes the earlier pass.

1. **Black world entry — healthy.** `00-world-entry.jpg` (604 × 984): the command-line direction is clear, the description field has room to write, and the disabled Muse action is accompanied by an honest unavailable message. Continue saved world remains visible. The fixed three-resident neighborhood scope is disclosed; no invented generated world is shown.
2. **Resident and private mind — healthy.** `01-resident.jpg` (604 × 984): the friendlier portrait establishes identity, chat/gift/share are prominent, and the physical hunger interruption explains why a larger plan waits. The private-not-overheard caption is explicit. Repeated activity rows, formula scores and raw IDs from the baseline are absent; deeper notes are folded.
3. **Mobile playfield — healthy.** `02-playfield-mobile.jpg` (604 × 984): the new cast is visible against the environment, clock/pause remain discoverable, and one toolbelt replaces the former stacked rule prompt and controls footer. The scene center remains free for play; tools and Town rules retain labels.
4. **Desktop playfield — healthy.** `03-playfield-desktop.jpg` (1280 × 800): the village is the dominant surface, with one compact toolbelt and a small clock cluster. This screenshot establishes visible layout, not pixel-perfect font sharpness or motion performance.
5. **Finite new object — healthy.** `04-finite-object.jpg` (604 × 984): the actual rain-catcher art, remaining five water, inspect/collect actions and folded discovery record are legible. This reads as a game object rather than an administrative inventory panel.

**Residual polish risks:** the entry's placeholder/support text and the tiny HUD hint remain visually subdued; check readability on a physical small phone and in bright ambient light before claiming accessibility compliance. The finite-object page repeats “introduced into this timeline” in adjacent descriptions; a later copy trim would reduce repetition. Neither issue blocks the captured flow. No new code, generation or asset change was made during this final review.

The integration owner separately reports native activity outcomes (Ada/Wren accepted, Mara declined), a hunger-blocked action, finite transfer from container 6→5 / player 1→2, and exact replay. Those are behavioral evidence from the owner's run; screenshots alone do not establish those sequences or live Muse availability. Final integration checks reported by the owner include typecheck, lint, build and 26 passing presentation tests.
