import test from 'node:test';
import assert from 'node:assert/strict';
import {localSqliteStore} from '../lib/server/local-sqlite';
import {Coordinator} from '../lib/server/coordinator';
import {hashState,chooseRuleDecision} from '../lib/sim';
import type {AgentContext} from '../lib/sim/contracts';

test('rule-policy routes execute, preserve command idempotence, rewind, fork and cold replay with zero inference',async()=>{
 const local=localSqliteStore(':memory:');let calls=0;const coordinator=new Coordinator(local.store,{enabled:false,fetcher:async()=>{calls++;throw new Error('No provider traffic is authorized.');}});
 try{
  let run=await coordinator.create(42);assert.equal(run.state.agents.length,24);assert.equal(run.mode,'rule-policy');assert.equal(run.historyStartTick,0);
  await assert.rejects(coordinator.create(42,'live'),/not connected/);
  run=await coordinator.command(run.id,run.revision,'rain-once',{id:'ignored',type:'rain'});
  const revision=run.revision;const duplicate=await coordinator.command(run.id,0,'rain-once',{id:'ignored',type:'rain'});assert.equal(duplicate.revision,revision);
  for(let i=0;i<4;i++)run=await coordinator.advance(run.id,run.revision,300);
  assert.equal(run.state.tick,1200);await assert.rejects(coordinator.advance(run.id,0,60),/changed/);
  const beforeHash=hashState(run.state);const playback=await coordinator.rewind(run.id,run.revision,600);assert.equal(playback.state.tick,600);assert.equal(playback.playback,true);assert.equal((await coordinator.get(run.id)).revision,run.revision);assert.equal(hashState((await coordinator.get(run.id)).state),beforeHash);
  const child=await coordinator.fork(run.id,run.revision,600);assert.notEqual(child.id,run.id);assert.equal(child.parentId,run.id);assert.equal(child.state.tick,600);assert.equal(child.historyStartTick,600);
  const envelope=await coordinator.export(run.id);const replay=await coordinator.replay(envelope);assert.equal(replay.verified,true);assert.equal(replay.modelCalls,0);assert.equal(replay.finalHash,beforeHash);
  const authoredAudit=[{attemptId:'unverified-foreign-record',result:{responseId:'claimed-id',rawText:'{"fixture":"never a live model call"}',inputTokens:42}}];
  const imported=await coordinator.import({...envelope,providerAudit:authoredAudit});assert.equal(imported.mode,'recorded');await assert.rejects(coordinator.advance(imported.id,imported.revision,60),/read-only/);
  const roundtrip=await coordinator.export(imported.id);assert.deepEqual(roundtrip.providerAudit,[]);assert.equal(roundtrip.importedProviderAudit.provenance,'unverified-import');assert.deepEqual(roundtrip.importedProviderAudit.records,authoredAudit);
  const reimport=await coordinator.import(roundtrip);assert.deepEqual((await coordinator.export(reimport.id)).importedProviderAudit.records,authoredAudit);
  await assert.rejects(coordinator.import({...envelope,recording:{...envelope.recording,finalHash:'tampered'}}),/verification/);
  assert.equal(calls,0);assert.equal(run.budget.generationAttempts,0);
 }finally{local.close();}
});
test('synthetic transport integration captures usage and commits canonical decisions without real provider traffic',async()=>{
 const local=localSqliteStore(':memory:');let http=0,inflight=0,maximum=0;
 const fetcher:typeof fetch=async(url,init)=>{http++;if(String(url).endsWith('/input_tokens'))return Response.json({input_tokens:1500});const payload=JSON.parse(String(init?.body));const context=JSON.parse(payload.input) as AgentContext;inflight++;maximum=Math.max(maximum,inflight);await new Promise(resolve=>setTimeout(resolve,(6-context.agent.id.length%6)));inflight--;return Response.json({id:`synthetic_${context.agent.id}`,model:'muse-spark-1.3',status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(chooseRuleDecision(context))}]}],usage:{input_tokens:1500,output_tokens:150,output_tokens_details:{reasoning_tokens:20}}});};
 try{const blocked=new Coordinator(local.store,{enabled:true,apiKey:'synthetic-only',fetcher});assert.equal(blocked.liveAvailable(),false);await assert.rejects(blocked.create(42,'live'),/not connected/);assert.equal(http,0);
  const coordinator=new Coordinator(local.store,{enabled:true,apiKey:'synthetic-only',projectBudgetMicroUsd:3_000_000,fetcher});let run=await coordinator.create(42,'live');
  for(let i=0;i<4;i++)run=await coordinator.advance(run.id,run.revision,60);
  assert.equal(run.state.tick,60);assert.equal(run.budget.generationAttempts,24);assert.equal(run.budget.httpRequests,48);assert.equal(http,48);assert.ok(maximum<=6);assert.equal(run.budget.reservedMicroUsd,0);
  const exported=await coordinator.export(run.id);assert.equal(exported.providerAudit.length,24);assert.ok(exported.providerAudit.every(record=>record.status==='applied'&&record.result?.responseId.startsWith('synthetic_')));
  assert.equal((await coordinator.replay(exported)).finalHash,hashState(run.state));assert.equal(http,48);assert.equal((await local.store.projectBudget())?.generation_attempts,24);
 }finally{local.close();}
});

test('a complete six-hour rule-policy afternoon remains durably exportable below the state cap',async()=>{
 const local=localSqliteStore(':memory:');const coordinator=new Coordinator(local.store);const started=performance.now();let maximum=0;
 try{let run=await coordinator.create(7);for(let i=0;i<72;i++){run=await coordinator.advance(run.id,run.revision,300);maximum=Math.max(maximum,new TextEncoder().encode(JSON.stringify(run.state)).length);}
  assert.equal(run.state.tick,21600);assert.equal(run.state.ended,true);assert.ok(maximum<1800000);assert.equal(run.budget.httpRequests,0);
  const exported=await coordinator.export(run.id);const replay=await coordinator.replay(exported);assert.equal(replay.finalHash,hashState(run.state));
  const rows=await local.store.db.prepare('SELECT count(*) AS count FROM godmode_operations WHERE run_id=?').bind(run.id).first<{count:number}>();assert.equal(rows?.count,72);
  process.stdout.write(`Local Node/SQLite full-afternoon evidence: ${Math.round(performance.now()-started)} ms including cold replay; max state ${maximum} bytes; 72 append batches; zero HTTP/model calls. Not a Cloudflare CPU measurement.\n`);
 }finally{local.close();}
});
