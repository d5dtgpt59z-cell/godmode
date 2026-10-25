import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localSqliteStore} from '../lib/server/local-sqlite';
import {RESERVATION_MICRO_USD} from '../lib/server/meta-adapter';

test('durable SQLite heads enforce lease/CAS and transactional rollback',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'godmode-sql-'));const path=join(directory,'town.sqlite');let local=localSqliteStore(path);
 try{await local.store.create('town','rule-policy',{tick:0});const token=await local.store.lease('town');await assert.rejects(local.store.lease('town'),/another operation/);
  await local.store.append('town',0,token,{tick:60},'advance',{seconds:60},'hash1','cmd1');
  await assert.rejects(local.store.append('town',0,token,{tick:999},'advance',{},'bad'),/changed/);
  assert.equal((await local.store.get<{tick:number}>('town')).state.tick,60);assert.equal(await local.store.hasCommand('town','cmd1'),true);await local.store.release('town',token);
  local.close();local=localSqliteStore(path);assert.equal((await local.store.get('town')).revision,1);
 }finally{local.close();rmSync(directory,{recursive:true,force:true});}
});
test('budget reservations, request receipts and unknown billing reconcile once',async()=>{
 const local=localSqliteStore(':memory:');try{await local.store.configureProjectBudget(3_000_000);await local.store.create('town','live',{tick:0});const job=await local.store.reserve('town','ticket1',true);assert.equal((await local.store.reserve('town','ticket1',true)).id,job.id);
  await local.store.beforeRequest(job.id,'count');await local.store.beforeRequest(job.id,'generation');await assert.rejects(local.store.beforeRequest(job.id,'generation'));
  await local.store.finish(job.id,null,'TRANSPORT_UNKNOWN');await local.store.finish(job.id,null,'DUPLICATE');
  const head=await local.store.get('town');assert.equal(head.budget.reservedMicroUsd,0);assert.equal(head.budget.spentMicroUsd,RESERVATION_MICRO_USD);assert.equal(head.budget.generationAttempts,1);assert.equal(head.budget.httpRequests,2);assert.equal(head.budget.eventDecisions,1);assert.equal((await local.store.job(job.id))?.status,'unknown');
 }finally{local.close();}
});
test('event and generation caps reject before increment or dispatch',async()=>{
 const local=localSqliteStore(':memory:');try{await local.store.configureProjectBudget(3_000_000);await local.store.create('town','live',{tick:0});await local.store.db.prepare('UPDATE godmode_runs SET event_admitted=96 WHERE id=?').bind('town').run();await assert.rejects(local.store.reserve('town','event-overflow',true),/budget/);
  assert.equal((await local.store.get('town')).budget.reservedMicroUsd,0);
  const job=await local.store.reserve('town','heartbeat',false);await local.store.db.prepare('UPDATE godmode_runs SET generation_attempts=500 WHERE id=?').bind('town').run();await assert.rejects(local.store.beforeRequest(job.id,'generation'),/request limit/);assert.equal((await local.store.get('town')).budget.httpRequests,0);
 }finally{local.close();}
});
test('project reservations span every run and cannot be raised by another configured run',async()=>{
 const local=localSqliteStore(':memory:');try{await local.store.configureProjectBudget(2*RESERVATION_MICRO_USD);for(const id of ['a','b','c'])await local.store.create(id,'live',{tick:0});
  const a=await local.store.reserve('a','one',false);await local.store.reserve('b','two',false);await assert.rejects(local.store.reserve('c','three',false),/budget/);
  await local.store.configureProjectBudget(110_000_000);assert.equal((await local.store.projectBudget())?.limit_micro,2*RESERVATION_MICRO_USD);
  await local.store.beforeRequest(a.id,'count');await local.store.beforeRequest(a.id,'generation');await local.store.finish(a.id,null,'UNKNOWN');
  const budget=await local.store.projectBudget();assert.equal(budget?.spent_micro,RESERVATION_MICRO_USD);assert.equal(budget?.reserved_micro,RESERVATION_MICRO_USD);assert.equal(budget?.generation_attempts,1);assert.equal(budget?.http_requests,2);
  await assert.rejects(local.store.reserve('c','three',false),/budget/);
 }finally{local.close();}
});
test('six active generation slots are shared across runs',async()=>{
 const local=localSqliteStore(':memory:');try{await local.store.configureProjectBudget(1_000_000);const jobs=[];for(let i=0;i<7;i++){await local.store.create(`run${i}`,'live',{tick:0});jobs.push(await local.store.reserve(`run${i}`,'ticket',false));}
  for(const job of jobs)await local.store.beforeRequest(job.id,'count');for(const job of jobs.slice(0,6))await local.store.beforeRequest(job.id,'generation');
  await assert.rejects(local.store.beforeRequest(jobs[6].id,'generation'),/request limit/);assert.equal((await local.store.get('run6')).budget.generationAttempts,0);
  await local.store.finish(jobs[0].id,null,'UNKNOWN');await local.store.beforeRequest(jobs[6].id,'generation');assert.equal((await local.store.projectBudget())?.generation_attempts,7);
 }finally{local.close();}
});
