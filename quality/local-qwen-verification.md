# Local Qwen verification — October 25, 2026

Ryan authorized temporary Qwen or Foundation use. This implementation uses **the already-installed Ollama `qwen3.5:9b`**, not Foundation Models or Meta. No model download, Llama license acceptance, account credential, purchase, cloud deployment, source push, schedule or `OLLAMA_ORIGINS` change occurred. The cozy build remains local only, and final submission remains on hold.

## Actual inference evidence

[Actual evaluation JSON](./local-qwen-evaluation.json) contains **five real, durable service requests**, original output, installed model digest, returned token counts, duration, proposal status and expected assertions. These are not injected unit fixtures. [Recording/export](./local-qwen-recording.json) retains provider audit alongside the replayable rule application. The separate local QA database is `local-qwen-evaluation.sqlite`; it does not alter the player's existing preview saves. Consequently these five calls are not added to the app preview database counter.

| Held-out request | Actual result | Duration |
|---|---|---|
| Let the villagers handle organizing the festival, instead of me. | ready | 5.99 s |
| Set the festival food goal to five and keep two grain as seed reserve. | ready | 7.25 s |
| Flood the low path for half a minute. | ready | 7.25 s |
| Add cows that produce milk every morning. | unsupported | 6.84 s |
| Give every villager a jetpack and let them fly over buildings. | unsupported | 6.58 s |

All five cases passed their stated checks. The first proposal was explicitly applied, retained `local-qwen`/`qwen3.5:9b` provenance, and survived exact export/replay. Repeating its request ID produced no additional generation. Unsupported cases returned no patch. A separate preliminary direct-adapter smoke call took 13.24 seconds cold and is recorded as one additional actual call; the five durable cases took 5.99–7.25 seconds. These six evaluations are a small bounded check, not broad language accuracy evidence. Later root browser QA calls are separate.

The durable service audit reports **5 local dispatches / 0 Meta dispatches / $0 Meta API spend**. Existing save/project Meta reservation, attempt and HTTP counters were unchanged. Local counters count dispatched attempts, including a timeout, rather than claiming every attempt yielded a successful answer. Local compute still uses the user's machine.

## Actual runtime and safeguards

`GET http://127.0.0.1:4318/api/cozy/status` reported `naturalLanguageAvailable:true`, `localQwenAvailable:true`, provider `local-qwen`, model `qwen3.5:9b`, `metaRulesAvailable:false`, and `npcPlansAvailable:false`. Root owns the product-browser preview/Apply QA. The initial Worker failure was unsupported `fetch` redirect mode `error`; local transport now uses `manual` and rejects redirects. No bridge or network exposure was added.

Enable only the two explicit local `.dev.vars` flags in the environment examples and use `npm run dev`. The adapter also requires `import.meta.env.DEV`; a production build cannot use this local model. Only the approved installed tag and digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` are accepted. The outbound destination is fixed `http://127.0.0.1:11434`; incoming local authoring must use a loopback URL. Model availability checks use `/api/tags`; no pull/download endpoint exists in the adapter.

Requests use JSON schema, `think:false`, 4096 context, 768 maximum output, 11,000-byte message admission, a 90-second generation deadline, one active local generation and 100 attempts/save. Input admission is a byte bound, not an invented exact tokenizer preflight; actual prompt/output counts are audited and checked. Unknown-dispatched jobs retain a 125-second uncertainty window. No blind retry or hosted fallback occurs. Unsupported output, stale revisions and invalid current-world preconditions cannot apply. Unchanged patch values are removed structurally; no keyword interpreter exists. All rules still require preview and explicit Apply. NPCs remain rule-policy; their Meta-only optional adapter is unchanged/off.

The migration-owned jobs/proposals/receipts tables retain attempts without changing the schema or touching Meta money. Completed-receipt recovery handles a crash before proposal finalization without a second generation. Bounded invalid received output/counts remain audited; unexpected thinking content itself is not retained. Imported receipts remain unverified imports.

## Automated checks and limits

- [35 server tests](./local-qwen-server-tests.tap) pass, including disabled/production gates, valid-Meta fallback rejection, no budget debit, installed-tag checks, no-op normalization, unsupported output, request-ID conflict/reopen/crash recovery, stale revisions, one-local-slot quarantine, timeout/no resend, raw receipt retention and loopback origin restrictions. All model transport unit tests are synthetic and labeled fixture.
- [Full suite](./local-qwen-full-tests.tap): **104 passed / 0 failed**.
- [Typecheck](./local-qwen-typecheck.log) and narrow changed-server ESLint pass.
- Current Qwen source production build and root browser-control sign-off are separate from the earlier pre-Qwen build receipt. Do not infer them from Node service tests or a ready status.

Temporary Qwen behavior does **not** establish the hackathon's required real Meta contribution or resolve admission, pivot, pre-event work, assistance, credit, final fields or format questions. The completed 72-second film predates Qwen integration and remains labeled recorded rule-policy simulation; it does not demonstrate these real Qwen calls.

Primary API references checked for this adapter: [Ollama chat API](https://docs.ollama.com/api/chat), [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs). The implementation supplies a JSON schema and validates output independently.
