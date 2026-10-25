/**
 * Cozy HTTP contract (October25 prototype; no final submission).
 * Every save operation returns {save:CozySaveDTO}; preview/model/apply also returns {proposal}.
 * All writes use trusted creator authorization except /tick, which additionally supports the
 * existing owner-private Sites service boundary. GET never advances a clock. No route enables
 * keys, billing, inference flags, hosting or a background schedule.
 *
 * GET /api/cozy -> {save:null|DTO}; POST {seed?,fresh?:false} creates/reuses a paused main cozy save.
 *   fresh:true creates a new independent slot-null paused save; no existing/main data is changed.
 * GET /api/cozy/status -> naturalLanguageAvailable,npcPlansAvailable,falseReason,actualMetaCalls,
 *   capabilities,capsHash,defaultMode:'rule-policy',backgroundWriterEnabled.
 * GET /api/cozy/:id -> {save}; PATCH {expectedRevision,paused?,pace?:0.01..1,commandId?}.
 * POST /:id/command {expectedRevision,commandId,command} accepts engine's exact command union.
 *   While unpaused it first consumes owed100ms steps under the OLD intent, then records the new
 *   command, clock debit and receipt in one CAS transaction. A short move/stop tap therefore has
 *   real duration. DuplicatecommandId consumes nothing again. Debt>60seconds returns409
 *   COZY_CATCH_UP unchanged until bounded /tick calls flush it. Paused actions never step time.
 * POST /:id/advance {expectedRevision,commandId,steps:1..600} is owner manual playback.
 * POST /:id/tick {maxSeconds?:0.1..60(default1),requestId?} consumes only owed100ms steps.
 *   State, clock debit and tick receipt commit atomically; repeated requestId never steps twice.
 * GET /:id/rules returns {save,capabilities}; GET /:id/rules/proposals returns {save} with recent
 *   proposals/change history. Manual label is 'exact rule editor', never natural-language AI.
 * POST /:id/rules/preview {requestId,patch} stores a validated manual preview; no state mutation.
 * POST /:id/rules/proposals {requestId,prompt:3..1000chars} is REAL Meta interpretation only.
 *   Missing gates returns503 COZY_META_NOT_CONNECTED; no keyword/template fallback exists.
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
