# Living-branch presentation review

Local source review and automated presentation checks, October 25, 2026. This is not a fresh browser capture or a live-model run.

## Changed UI

- `components/cozy/cozy-game.tsx`: explicit v1 journal upgrade/fork; new branch remains paused; separate Play control; save-bound permission decisions; foreground initiative effect outside the existing physics/command serial queue; v2 skips legacy festival NPC plan inference.
- `components/cozy/cozy-emergence.tsx`: actual proposals, physical deliveries, separate resident stances/conditions, lasting membership, current institution tasks, retained completed contributions, server-computed exact permission diffs, collapsible causal/provenance record, and honest empty/disabled/uncertain states.
- `components/cozy/initiative-pump.ts`: one in-flight request; same-ID recovery for pending/busy/network failures; atomic session receipt/probe recovery; visibility/pause/version/recording/budget gates; terminal outcome rotation; 130-second unknown backoff.
- `components/cozy/social-presentation.ts`: typed physical-task labels, player-audience-only ambient notices, explicit provider labels, receipt traversal through actual event/memory source IDs.
- `components/cozy/cozy.css`: paper-notebook styling and keyboard focus treatment. Existing map, sprites, portraits, stage and portrait dialogue component unchanged.

## Commands and results

- `node --import tsx --test tests/cozy-presentation.test.ts`: **16/16 pass**. Full output: `quality/emergence-presentation-tests.tap`.
- `npx tsc --noEmit`: exit 0.
- Scoped ESLint for the four changed/new TypeScript UI files and presentation test: exit 0.
- Static React markup checks verify v1 opt-in copy, v2 paused/empty/disabled state, genuine fixture provenance, independent refusal, and absence of an approval control until the actual exact preview exists. They also cover a differing pending charter when villagers already organize and restoration after a later law change.

## Recovery and permission corrections

Fresh tabs may recover a pending server ticket even without a local request ID or remaining admission allowance. These probes persist `recoveryOnly:true` atomically with their ID, retain it through pending/network/busy outcomes, and cannot admit a new generation after the original ticket finishes. The backend enforces the recovery-only guard. Paused ready tickets remain untouched until explicit Play. Permission controls depend on the actual group permission and server preview rather than the current organizer; an approved charter waiting after a later rule change offers an exact restoration preview.

## Fresh browser path for integration owner

1. Open an existing v1 neighborhood and its town journal. Select **Start a living branch**.
2. Confirm a different save ID, paused clock and unchanged original saved neighborhood. Select **Play living branch** in the journal.
3. Confirm movement and physical clock continue during any enabled Qwen request. The pump must stop dispatching when hidden or paused; pending recovery keeps its request ID.
4. Inspect a physically delivered proposal, individual replies and permission diff. Decline/approve only a real formed group request. Verify physical work against source events and exact replay.
5. Open NPC speech while moving; the preserved portrait queue must stop player motion and retain Enter/Continue behavior. Inspect responsive notebook wrapping.

The backend initiative flag was not enabled by this UI task. No provider call, fresh native screenshot, deployment, upload or final submission is claimed. Town pace remains within the current server schema: 0.5× and 1×.
