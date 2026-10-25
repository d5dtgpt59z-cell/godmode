import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localSqliteStore} from '../lib/server/local-sqlite';
import {PersistentWorldService} from '../lib/server/persistent-world';
import {Coordinator} from '../lib/server/coordinator';
import {ServiceError} from '../lib/server/errors';
import {hashState} from '../lib/sim';

test('saved clock accrues real elapsed time but reads never pretend to advance it',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'godmode-world-')),path=join(directory,'world.sqlite');let local=localSqliteStore(path);let now=Date.parse('2026-10-25T17:00:00Z');let world=new PersistentWorldService(local.store,()=>now,true);
 try{const initial=(await world.create(52)).world;assert.equal(initial.run.state.mode,'persistent');now+=30*60*1000;const before=(await world.get()).world!;assert.equal(before.run.state.tick,0);assert.equal(before.clock.dueSeconds,180);assert.equal(before.background.serviceTickVerified,false);
  let latest=before;for(let i=0;i<3;i++)latest=(await world.tick('service',60)).world;assert.equal(latest.run.state.tick,180);assert.equal(latest.clock.dueSeconds,0);assert.equal(latest.history.length,3);assert.ok(latest.history.every(job=>job.actual_seconds===60));assert.equal(latest.run.budget.httpRequests,0);
  const id=latest.run.id;local.close();local=localSqliteStore(path);world=new PersistentWorldService(local.store,()=>now,true);const reopened=(await world.get()).world!;assert.equal(reopened.run.id,id);assert.equal(reopened.run.state.tick,180);assert.equal(reopened.background.serviceTickVerified,true);
 }finally{local.close();rmSync(directory,{recursive:true,force:true});}
});
test('paused wall time is excluded and pace changes preserve already owed time',async()=>{
 const local=localSqliteStore(':memory:');let now=100000;const world=new PersistentWorldService(local.store,()=>now);try{let current=(await world.create()).world;now+=10000;current=(await world.settings(current.revision,{paused:true})).world;assert.equal(current.clock.dueSeconds,1);now+=3600000;const paused=(await world.tick('local-test')).world;assert.equal(paused.run.state.tick,0);assert.equal(paused.clock.dueSeconds,1);
  current=(await world.settings(paused.revision,{paused:false,pace:0.5})).world;current=(await world.tick('owner')).world;assert.equal(current.run.state.tick,1);now+=10000;current=(await world.tick('owner')).world;assert.equal(current.run.state.tick,6);assert.equal(current.clock.dueSeconds,0);assert.equal(current.background.serviceTickVerified,false);
 }finally{local.close();}
});
test('a crash after simulation commit recovers its durable tick receipt without stepping twice',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'godmode-recovery-')),path=join(directory,'world.sqlite');let local=localSqliteStore(path);let now=100000;let world=new PersistentWorldService(local.store,()=>now);
 try{await world.create(3);now+=600000;const internal=world as unknown as {coordinator:Coordinator};const original=internal.coordinator.advance.bind(internal.coordinator);internal.coordinator.advance=async(...args)=>{await original(...args);throw new ServiceError('SYNTHETIC_PROCESS_LOSS','Simulated loss after durable commit.',503);};
  await assert.rejects(world.tick('local-test'),/Simulated loss/);const pending=(await world.get()).world!;assert.equal(pending.run.state.tick,60);assert.ok(pending.clock.pendingJobId);
  local.close();local=localSqliteStore(path);world=new PersistentWorldService(local.store,()=>now);const recovered=(await world.tick('local-test')).world;assert.equal(recovered.run.state.tick,60);assert.equal(recovered.clock.dueSeconds,0);assert.equal(recovered.clock.pendingJobId,null);assert.equal(recovered.history.length,1);assert.equal(recovered.history[0].status,'completed');
 }finally{local.close();rmSync(directory,{recursive:true,force:true});}
});
test('simultaneous saved-world tick writers cannot consume the same clock debt',async()=>{
 const local=localSqliteStore(':memory:');let now=100000;const world=new PersistentWorldService(local.store,()=>now);const second=new PersistentWorldService(local.store,()=>now);
 try{await world.create();now+=600000;const internal=world as unknown as {coordinator:Coordinator};const original=internal.coordinator.advance.bind(internal.coordinator);let entered!:()=>void,release!:()=>void;const ready=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});internal.coordinator.advance=async(...args)=>{entered();await gate;return original(...args);};
  const first=world.tick('owner');await ready;await assert.rejects(second.tick('service'),/another tick/);release();const result=(await first).world;assert.equal(result.run.state.tick,60);assert.equal(result.history.length,1);assert.equal(result.clock.dueSeconds,0);
 }finally{local.close();}
});
test('persistent archives commit before checkpoint replacement and continue exact cold replay',async()=>{
 const local=localSqliteStore(':memory:');const world=new PersistentWorldService(local.store);const coordinator=new Coordinator(local.store);
 try{let run=(await world.create(27)).world.run;for(let i=0;i<72;i++)run=await coordinator.advance(run.id,run.revision,300);assert.equal(run.state.tick,21600);assert.equal(run.state.ended,false);const priorHash=hashState(run.state);run=await coordinator.checkpointPersistent(run.id);
  const archives=(await world.archives()).archives;assert.equal(archives.length,1);const archived=await world.archive(archives[0].id);assert.equal((await coordinator.replay(archived)).finalHash,priorHash);assert.equal(run.state.origin.priorArchiveHash,priorHash);assert.ok(new TextEncoder().encode(JSON.stringify(run.state)).length<1800000);
  run=await coordinator.advance(run.id,run.revision,60);assert.equal(run.state.tick,21660);const exported=await coordinator.export(run.id);assert.equal((await coordinator.replay(exported)).finalHash,hashState(run.state));assert.equal(run.budget.httpRequests,0);
  run=await coordinator.advance(run.id,run.revision,240);assert.equal(run.state.tick,21900);assert.equal(run.historyStartTick,21600);
  const playback=await coordinator.rewind(run.id,run.revision,21720);assert.equal(playback.state.tick,21720);assert.equal(playback.historyStartTick,21600);assert.equal(playback.playback,true);
  const child=await coordinator.fork(run.id,run.revision,21900);assert.equal(child.state.mode,'persistent');assert.equal(child.state.tick,21900);assert.equal(child.historyStartTick,21900);assert.equal((await coordinator.get(run.id)).revision,run.revision);
  for(const operation of [()=>coordinator.rewind(run.id,run.revision,21599),()=>coordinator.fork(run.id,run.revision,21300)])await assert.rejects(operation,error=>error instanceof ServiceError&&error.code==='ARCHIVED_HISTORY'&&error.status===422);
  await assert.rejects(coordinator.rewind(run.id,run.revision,21720.5),error=>error instanceof ServiceError&&error.code==='INVALID_HISTORY_TICK');
 }finally{local.close();}
});
