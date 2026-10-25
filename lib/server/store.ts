import {ServiceError} from './errors';
import {RESERVATION_MICRO_USD,type ModelResult} from './meta-adapter';
export type RunMode='rule-policy'|'live'|'recorded'|'fixture';
export type Statement={bind(...values:unknown[]):Statement;first<T>():Promise<T|null>;all<T>():Promise<{results:T[]}>;run():Promise<{meta?:{changes?:number}}>};
export type SqlDatabase={prepare(sql:string):Statement;batch(statements:Statement[]):Promise<unknown[]>;exec(sql:string):Promise<unknown>};
type RunRow={id:string;revision:number;mode:RunMode;state_json:string;parent_id:string|null;created_at:string;reserved_micro:number;spent_micro:number;generation_attempts:number;http_requests:number;event_admitted:number;budget_micro:number};
export type RunHead<T=unknown>={id:string;revision:number;mode:RunMode;state:T;parentId:string|null;createdAt:string;budget:{reservedMicroUsd:number;spentMicroUsd:number;limitMicroUsd:number;generationAttempts:number;httpRequests:number;eventDecisions:number}};
export type Job={id:string;run_id:string;ticket_id:string;status:'reserved'|'dispatched'|'completed'|'failed'|'unknown'|'applied';reserved_micro:number;actual_micro:number|null;result_json:string|null;error_code:string|null;dispatched_at:number|null;created_at:number};
export const MAX_PROJECT_BUDGET_MICRO_USD=110_000_000;
export function validProjectBudget(value:unknown):value is number{return typeof value==='number'&&Number.isSafeInteger(value)&&value>0&&value<=MAX_PROJECT_BUDGET_MICRO_USD;}
const stateBytes=(state:unknown)=>{const text=JSON.stringify(state);if(new TextEncoder().encode(text).length>1_800_000)throw new ServiceError('STATE_LIMIT','This town reached the local prototype storage limit. Export the recording before continuing.',413);return text;};
export class SqlStore{
 constructor(public db:SqlDatabase){}
 async get<T=unknown>(id:string):Promise<RunHead<T>>{const row=await this.db.prepare('SELECT * FROM godmode_runs WHERE id=?').bind(id).first<RunRow>();if(!row)throw new ServiceError('RUN_NOT_FOUND','That town was not found.',404);return{id:row.id,revision:row.revision,mode:row.mode,state:JSON.parse(row.state_json),parentId:row.parent_id,createdAt:row.created_at,budget:{reservedMicroUsd:row.reserved_micro,spentMicroUsd:row.spent_micro,limitMicroUsd:row.budget_micro,generationAttempts:row.generation_attempts,httpRequests:row.http_requests,eventDecisions:row.event_admitted}};}
 async create<T>(id:string,mode:RunMode,state:T,parentId:string|null=null,importedAudits:unknown[]=[]){
  const statements=[this.db.prepare('INSERT INTO godmode_runs(id,mode,state_json,parent_id,created_at) VALUES(?,?,?,?,?)').bind(id,mode,stateBytes(state),parentId,new Date().toISOString())];
  // Bounded chunks preserve imported claims without placing a large envelope in one D1 row.
  let chunk:unknown[]=[],bytes=0,sequence=0;const flush=()=>{if(chunk.length){statements.push(this.db.prepare('INSERT INTO godmode_imported_audits(run_id,sequence,payload_json) VALUES(?,?,?)').bind(id,sequence++,JSON.stringify(chunk)));chunk=[];bytes=0;}};
  for(const audit of importedAudits){const size=new TextEncoder().encode(JSON.stringify(audit)).length;if(size>1_000_000)throw new ServiceError('AUDIT_LIMIT','One imported provider record exceeds its storage limit.',413);if(bytes+size>1_000_000)flush();chunk.push(audit);bytes+=size+1;}flush();
  if(statements.length>20)throw new ServiceError('AUDIT_LIMIT','Imported provider records exceed the storage limit.',413);
  await this.db.batch(statements);return this.get<T>(id);
 }
 async configureProjectBudget(cap:number){if(!validProjectBudget(cap))throw new ServiceError('PROJECT_BUDGET_NOT_CONFIGURED','An explicit project-wide credit cap is required before live mode.',503);await this.db.prepare("INSERT INTO godmode_project_budget(id,limit_micro) VALUES('main',?) ON CONFLICT(id) DO UPDATE SET limit_micro=MIN(limit_micro,excluded.limit_micro)").bind(cap).run();return this.projectBudget();}
 async projectBudget(){return this.db.prepare("SELECT limit_micro,reserved_micro,spent_micro,generation_attempts,http_requests FROM godmode_project_budget WHERE id='main'").first<{limit_micro:number;reserved_micro:number;spent_micro:number;generation_attempts:number;http_requests:number}>();}
 async importedAudits(id:string){const chunks=(await this.db.prepare('SELECT payload_json FROM godmode_imported_audits WHERE run_id=? ORDER BY sequence').bind(id).all<{payload_json:string}>()).results;return chunks.flatMap(chunk=>JSON.parse(chunk.payload_json) as unknown[]);}
 async lease(id:string,now=Date.now()){const token=crypto.randomUUID();const result=await this.db.prepare('UPDATE godmode_runs SET lease_token=?,lease_until=? WHERE id=? AND lease_until<=?').bind(token,now+120000,id,now).run();if(result.meta?.changes!==1)throw new ServiceError('RUN_BUSY','This town is finishing another operation. Try again shortly.',409);return token;}
 async release(id:string,token:string){await this.db.prepare('UPDATE godmode_runs SET lease_token=NULL,lease_until=0 WHERE id=? AND lease_token=?').bind(id,token).run();}
 async append<T>(id:string,expected:number,token:string,state:T,kind:string,payload:unknown,stateHash:string,commandId?:string,prefix:Statement[]=[]){
  const statements=[...prefix,this.db.prepare('INSERT INTO godmode_operations(run_id,revision,kind,payload_json,state_hash,guard) VALUES(?,?,?,?,?,(SELECT CASE WHEN revision=? AND lease_token=? AND lease_until>? THEN 1 ELSE 0 END FROM godmode_runs WHERE id=?))').bind(id,expected+1,kind,JSON.stringify(payload),stateHash,expected,token,Date.now(),id),this.db.prepare('UPDATE godmode_runs SET state_json=?,revision=revision+1 WHERE id=? AND revision=? AND lease_token=?').bind(stateBytes(state),id,expected,token)];
  if(commandId)statements.push(this.db.prepare('INSERT INTO godmode_commands(run_id,command_id,revision) VALUES(?,?,?)').bind(id,commandId,expected+1));
  try{await this.db.batch(statements);}catch{throw new ServiceError('REVISION_CONFLICT','The town changed. Reload its latest state and try again.',409);}return this.get<T>(id);
 }
 async hasCommand(id:string,commandId:string){return !!await this.db.prepare('SELECT revision FROM godmode_commands WHERE run_id=? AND command_id=?').bind(id,commandId).first();}
 async reserve(id:string,ticketId:string,event:boolean):Promise<Job>{
  const existing=await this.db.prepare('SELECT * FROM godmode_jobs WHERE run_id=? AND ticket_id=?').bind(id,ticketId).first<Job>();if(existing)return existing;
  const jobId=crypto.randomUUID();
  // A CHECK guard in the same transaction makes budget admission atomic across workers.
  try{await this.db.batch([
   this.db.prepare("INSERT INTO godmode_jobs(id,run_id,ticket_id,status,reserved_micro,created_at,guard) VALUES(?,?,?,?,?,?,(SELECT CASE WHEN reserved_micro+spent_micro+?<=budget_micro AND generation_attempts<500 AND http_requests<1000 AND event_admitted+?<=96 AND EXISTS(SELECT 1 FROM godmode_project_budget WHERE id='main' AND reserved_micro+spent_micro+?<=limit_micro) THEN 1 ELSE 0 END FROM godmode_runs WHERE id=?))").bind(jobId,id,ticketId,'reserved',RESERVATION_MICRO_USD,Date.now(),RESERVATION_MICRO_USD,event?1:0,RESERVATION_MICRO_USD,id),
   this.db.prepare('UPDATE godmode_runs SET reserved_micro=reserved_micro+?,event_admitted=event_admitted+? WHERE id=?').bind(RESERVATION_MICRO_USD,event?1:0,id),
   this.db.prepare("UPDATE godmode_project_budget SET reserved_micro=reserved_micro+? WHERE id='main'").bind(RESERVATION_MICRO_USD),
  ]);}catch{throw new ServiceError('RUN_BUDGET_LIMIT','The run reached its decision or budget limit; a recorded rule fallback will be used.',429);}return(await this.job(jobId))!;
 }
 async job(id:string){return this.db.prepare('SELECT * FROM godmode_jobs WHERE id=?').bind(id).first<Job>();}
 async beforeRequest(jobId:string,kind:'count'|'generation'){
  const job=await this.job(jobId);if(!job||job.status!=='reserved')throw new ServiceError('ATTEMPT_ALREADY_DISPATCHED','This decision attempt cannot be sent again.',409);
  const statements=[this.db.prepare("INSERT INTO godmode_requests(job_id,kind,guard) VALUES(?,?,(SELECT CASE WHEN http_requests<1000 AND generation_attempts+?<=500 AND (?=0 OR (SELECT count(*) FROM godmode_jobs WHERE status='dispatched' AND dispatched_at>?)<6) THEN 1 ELSE 0 END FROM godmode_runs WHERE id=?))").bind(jobId,kind,kind==='generation'?1:0,kind==='generation'?1:0,Date.now()-65000,job.run_id),this.db.prepare('UPDATE godmode_runs SET http_requests=http_requests+1,generation_attempts=generation_attempts+? WHERE id=?').bind(kind==='generation'?1:0,job.run_id),this.db.prepare("UPDATE godmode_project_budget SET http_requests=http_requests+1,generation_attempts=generation_attempts+? WHERE id='main'").bind(kind==='generation'?1:0)];
  if(kind==='generation')statements.push(this.db.prepare("UPDATE godmode_jobs SET status='dispatched',dispatched_at=? WHERE id=? AND status='reserved'").bind(Date.now(),jobId));
  try{await this.db.batch(statements);}catch{throw new ServiceError('RUN_CALL_LIMIT','This request already ran or the run reached its request limit.',429);}
 }
 async finish(jobId:string,result:ModelResult|null,errorCode:string|null=null,audit?:Record<string,unknown>){
  const job=await this.job(jobId);if(!job||['completed','failed','unknown','applied'].includes(job.status))return;
  const unknown=job.status==='dispatched'&&!result&&!audit;const billed=typeof audit?.actualMicroUsd==='number'&&Number.isSafeInteger(audit.actualMicroUsd)&&audit.actualMicroUsd>=0?audit.actualMicroUsd:undefined;const actual=result?.actualMicroUsd??billed??(job.status==='dispatched'?job.reserved_micro:0);
  try{await this.db.batch([
   this.db.prepare('INSERT INTO godmode_receipts(job_id,guard) VALUES(?,1)').bind(jobId),
   this.db.prepare('UPDATE godmode_jobs SET status=?,actual_micro=?,result_json=?,error_code=? WHERE id=? AND status IN (?,?)').bind(result?'completed':unknown?'unknown':'failed',actual,result?JSON.stringify(result):audit?JSON.stringify(audit):null,errorCode,jobId,'reserved','dispatched'),
   this.db.prepare('UPDATE godmode_runs SET reserved_micro=reserved_micro-?,spent_micro=spent_micro+? WHERE id=?').bind(job.reserved_micro,actual,job.run_id),
   this.db.prepare("UPDATE godmode_project_budget SET reserved_micro=reserved_micro-?,spent_micro=spent_micro+? WHERE id='main'").bind(job.reserved_micro,actual),
  ]);}catch{const latest=await this.job(jobId);if(latest&&!['completed','failed','unknown','applied'].includes(latest.status))throw new ServiceError('BUDGET_RECONCILE_FAILED','The decision receipt could not be saved.',503);}
 }
 async markApplied(jobId:string){await this.db.prepare("UPDATE godmode_jobs SET status='applied' WHERE id=? AND status IN ('completed','failed','unknown')").bind(jobId).run();}
 async jobs(id:string){return(await this.db.prepare('SELECT * FROM godmode_jobs WHERE run_id=? ORDER BY created_at,id').bind(id).all<Job>()).results;}
 async ticketJob(id:string,ticket:string){return this.db.prepare('SELECT * FROM godmode_jobs WHERE run_id=? AND ticket_id=?').bind(id,ticket).first<Job>();}
}
