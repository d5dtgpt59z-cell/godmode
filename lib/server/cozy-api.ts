/**
 * Cozy HTTP contract (October25 prototype; no final submission).
 * Every save operation returns {save:CozySaveDTO}; preview/model/apply also returns {proposal}.
 * All writes use trusted creator authorization except /tick, which additionally supports the
 * existing owner-private Sites service boundary. GET never advances a clock. No route enables
 * keys, billing, inference flags, hosting or a background schedule.
 *
 * Muse extension (October25, no actual Meta access verified):
 *   GODMODE_COZY_PROVIDER=meta explicitly selects Muse; never falls back to local Qwen.
 *   MODEL_API_KEY + GODMODE_META_CREDIT_AUTHORIZED=true + an explicit project budget are required.
 *   GODMODE_RULE_AUTHORING_ENABLED=true gates rule/activity/world-object authoring and Forge;
 *   GODMODE_RESIDENT_REASONING_ENABLED=true gates personal/social autonomous reasoning.
 *   All new flags remain absent/off. Account still Pending; no free credits/key/paid activation.
 *   Spark standard model muse-spark-1.3 uses minimal reasoning, strict JSON, token-count preflight,
 *   768 TOTAL output tokens and raw response/usage receipts. V3 personal/authoring/Forge have a
 *   6000input-token cap with13994microUSD upper-bound reservation incl30%; old paths stay2000.
 *   Dollar caps remain $3/save plus explicit shared project cap;500generations/1000HTTP/save.
 *   Resident decisions retain foreground admission, pause/cache/resume and recoveryOnly behavior.
 *   /tick performs zero model inference. Selected Meta access/config failure never invokes Qwen.
 * POST /api/cozy/forge/proposals {requestId,prompt:3..1000} -> {draftId,proposal}.
 *   A deterministic paused internal draft stores budget/receipt only; current playable save unchanged.
 *   Blueprint preview shows actual map generated:false, all3merged resident profiles, real values,
 *   rules and unsupported requests. No pretend generated terrain or ten dynamic people.
 * POST /api/cozy/forge/create {draftId,proposalId,commandId} -> {save:newPausedV3World}.
 *   Explicit Create only; deterministic child ID recovers interruption without duplicate or overwrite.
 *   Export creationAudit binds blueprint/prompt/raw model receipt. Imported evidence is unverified.
 *   status adds worldForgeAvailable/worldForgeFalseReason; disabled returns503 without a draft/call.
 *   V3 /rules/proposals may return kind activity or world-object, each with its own engine preview;
 *   /rules/apply remains explicit and checks capabilities/current physical preconditions.
 *   World-object assets are actual pre-generated catalog art, not runtime Muse Image outputs.
 *   Muse Image has a separately gated adapter only (no public route/automatic asset registration).
 *   It requests one PNG, disables web/image search+shell, reserves13000microUSD including30%,
 *   verifies returned bytes/dimensions/hash and records flat10000microUSD actual returned-image cost.
 *   Real image/auth/storage/asset-delivery integration remains unverified; no image was requested.
 *
 * GET /api/cozy -> {save:null|DTO}; POST {seed?,fresh?:false} creates/reuses a paused main cozy save.
 *   fresh:true creates a new independent slot-null paused save; no existing/main data is changed.
 * GET /api/cozy/status -> naturalLanguageAvailable,npcPlansAvailable,falseReason,actualMetaCalls,
 *   ruleProvider:'local-qwen'|'meta'|'none',ruleModel:string|null,localQwenAvailable,metaRulesAvailable,
 *   actualLocalCalls,capabilities,capsHash,defaultMode:'rule-policy',backgroundWriterEnabled.
 * GET /api/cozy/:id -> {save}; PATCH {expectedRevision,paused?,pace?:0.01..1,commandId?}.
 * POST /:id/command {expectedRevision,commandId,command} accepts engine's exact command union.
 *   While unpaused it first consumes owed100ms steps under the OLD intent, then records the new
 *   command, clock debit and receipt in one CAS transaction. A short move/stop tap therefore has
 *   real duration. DuplicatecommandId consumes nothing again. Debt>60seconds returns409
 *   COZY_CATCH_UP unchanged until bounded /tick calls flush it. Paused actions never step time.
 * POST /:id/advance {expectedRevision,commandId,steps:1..600} is owner manual playback.
 * POST /:id/tick {maxSeconds?:0.1..60(default1),requestId?} consumes only owed100ms steps.
 *   State, clock debit and tick receipt commit atomically; repeated requestId never steps twice.
 * POST /:id/evolve {expectedRevision} creates a NEW paused cozy-engine-2 branch, original untouched.
 * POST /:id/personal-evolve {expectedRevision} creates a NEW paused cozy-engine-3 Wren branch.
 *   V1/V2 saves, actual recordings, and existing entrypoints remain unchanged. state.mind contains
 *   Wren-only bounded values/relationships/beliefs/aspirations/capability requests and plan state.
 *   Normal command union adds physically-adjacent share-idea {npcId:'wren',text:3..500chars}; this
 *   is attributed untrusted player testimony, never automatic adoption or executable mechanics.
 *   The same pump detects frozen context.kind='personal', selects only Wren, validates a personal
 *   decision, and records personal-decision with local-qwen/fixture provenance. Every old async
 *   receipt, stale-intent, pause/cache/resume and recoveryOnly guarantee remains in force.
 *   New purpose cozy-personal-local shares100/save with rules+social and12/hour with social,
 *   plus the same global single local slot/125s quarantine. No new migration or feature flag.
 *   Model dreams or beliefs may be unusual; unsupported effects persist as capability requests,
 *   never resources/actions/rules. Beliefs remain attributed inference, not observed world facts.
 *   personalAgentAvailable/FalseReason/actualPersonalCalls are additional status fields;
 *   save.initiative.kind distinguishes social/personal. ActualMetaCalls remains separate.
 * POST /:id/initiative/pump {requestId,recoveryOnly?:false} admits/drives at most one actual local resident decision.
 *   Engine selects a grounded opportunity; no player prompt is accepted. Immutable actor context,
 *   trigger/intent/evidence hashes and model receipts persist in0005 tickets. No world lease spans
 *   inference. Completion checks current intent/physical preconditions against latest head, so
 *   unrelated physics revisions need not stale every model reply. Duplicate IDs never redispatch.
 *   Fresh-tab recovery uses recoveryOnly:true; a probe can recover existing work but cannot admit
 *   a new generation if the original ticket completes between a status read and the probe.
 *   Returns {save,initiative:{ticketId,npcId,status,summary?,errorCode?}}. idle/pending/rate-limited
 *   are quiet200 outcomes; disabled503. Only foreground visible/unpaused UI pumps are established.
 *   Feature requires GODMODE_LOCAL_INITIATIVE_ENABLED=true plus existing DEV/local Qwen gates.
 *   Per actor30simsec cooldown,12dispatches/save/rolling wallhour,100total attempts shared with
 *   local rule authoring, one global local generation and125s unknown quarantine. Meta untouched.
 * POST /:id/social/decision {expectedRevision,proposalId,decision:'approve'|'decline',commandId}
 *   performs only the bounded engine-owned player permission operation; no arbitrary rule code.
 * status adds initiativeAvailable/initiativeFalseReason/initiativeProvider/actualInitiativeCalls;
 *   save.initiative reports enabled/eligible/pending,lastOutcome/lastAt,actualCalls,remainingTotal,
 *   hourCalls/hourLimit. actualLocalCalls includes real rules+initiative dispatches; fixtures0.
 * GET /:id/rules returns {save,capabilities}; GET /:id/rules/proposals returns {save} with recent
 *   proposals/change history. Manual label is 'exact rule editor', never natural-language AI.
 * POST /:id/rules/preview {requestId,patch} stores a validated manual preview; no state mutation.
 *   patch remains an ordinary RulePatch, or exact {kind:'activity',program:ActivityBlueprint} /
 *   {kind:'world-object',object:WorldObjectProposal}. Source is manual, never fake natural language;
 *   real engine preview/capsHash and the same explicit Apply/current-precondition checks apply.
 * POST /:id/rules/proposals {requestId,prompt:3..1000chars} uses the selected real interpreter.
 *   Local development may explicitly select existing Ollama Qwen via GODMODE_LOCAL_QWEN_ENABLED=true
 *   and GODMODE_LOCAL_QWEN_MODEL=qwen3.5:9b; production builds cannot enable this adapter. Fixed
 *   server-only 127.0.0.1:11434, installed-tag check, 4096context/768output, think:false,90s deadline,
 *   one local generation globally,100attempts/save. No download/cloud/tool/remote fallback.
 *   Proposal source/provenance is local-qwen (fixtures stay fixture); actualLocalCalls counts only
 *   real local dispatches. Meta counters/global budget remain untouched. Durable request receipts
 *   prevent repeat sends, including unknown timeout outcomes. Local requests remain previews.
 *   Otherwise original Meta gates apply. No keyword/template fallback exists.
 * POST /:id/rules/apply {expectedRevision,proposalId,commandId} explicitly applies a ready preview.
 * POST /:id/rules/revert {expectedRevision,expectedRulesRevision,commandId} restores prior rules
 *   prospectively; earned/consumed goods, memories and historical events remain intact.
 * POST /:id/npc-plans {requestId,npcId:'ada'|'mara'|'wren'} creates a REAL Meta plan preview.
 * POST /:id/npc-plans/apply {expectedRevision,proposalId,commandId} revalidates own knowledge and
 *   actual current physical preconditions. No inference runs in /tick. Foreground UI may request
 *   at most one plan per NPC/rulesRevision using stable IDs and only when npcPlansAvailable.
 * POST /:id/rewind {expectedRevision,step} returns {save,playback:true}, parent unchanged.
 * POST /:id/fork {expectedRevision,step?} creates a paused independent branch.
 *   Exact Undo uses {expectedRevision,operationIndex,originHash} instead of step, using metadata
 *   on ruleChanges or state.ruleHistory. Earlier same-step actions stay. Wrong archive hash422.
 * POST /:id/compare {otherSaveId} compares actual fields at equal logical end-of-step moments,
 *   including edits recorded at that step on both sides; zero model calls.
 * GET /:id/export -> cozy recording/current segment, archiveIndex and providerAudit; imported
 *   claims remain separate importedProviderAudit:{provenance:'unverified-import',records:[...]}.
 * GET /:id/archives?beforeStep=N lists100 retained segments; GET /:id/archives/:archiveId downloads.
 * POST /api/cozy/import accepts recording/envelope, verifies, creates read-only recorded save.
 * POST /api/cozy/replay accepts recording/envelope -> verified,finalHash,state,modelCalls:0.
 *
 * Production prerequisites for Meta: creator access, MODEL_API_KEY, positive explicit
 * GODMODE_PROJECT_BUDGET_MICRO_USD<=110000000, plus GODMODE_RULE_AUTHORING_ENABLED=true for
 * NL rules or GODMODE_COZY_NPC_ENABLED=true for NPC plans. All remain absent/off here. The old
 * GODMODE_LIVE_ENABLED flag/resident integration is unchanged. Both families share the project
 * ledger and global6-generation gate; each cozy save has500attempts/1000HTTP/$3 reservation cap.
 * Attempts are durably reserved before count/generation. Unknown billing is conservatively
 * retained; abandoned attempts are not blindly retried. Stored request IDs prevent double sends.
 * Fixture transport exists only through injectable test options and stays labeled fixture.
 *
 * New migration0004 is additive and locally applied; keep0000..0003 immutable. It introduces
 * separate cozy saves/ops/actions/ticks/archives/proposals/rule history and a shared model-job
 * purpose column defaulting to'resident'. Do not apply it again to the existing local preview.
 * No DDL runs in handlers. A fresh local database needs all pending migrations; tests explicitly
 * exercise upgrade of an existing v1 SQLite file and verify original saves/recordings unchanged.
 */
export const COZY_API_FORMAT='godmode-cozy-save' as const;
