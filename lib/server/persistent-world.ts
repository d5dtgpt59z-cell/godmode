import {initializePersistentWorld} from '../sim';
import type {WorldState} from '../sim/contracts';
import {Coordinator} from './coordinator';
import {ServiceError} from './errors';
import type {SqlStore} from './store';

type WorldRow={id:string;run_id:string;revision:number;paused:number;pace_milli:number;last_wall_ms:number;owed_sim_ms:number;lease_token:string|null;lease_until:number;pending_job_id:string|null;last_tick_at:string|null;last_background_tick_at:string|null;last_error:string|null;created_at:string};
type TickJob={id:string;world_id:string;run_id:string;expected_revision:number;tick_before:number;requested_seconds:number;actual_seconds:number|null;status:'planned'|'completed';source:TickSource;started_at:string;completed_at:string|null;error_code:string|null};
export type TickSource='owner'|'service'|'local-test';
const WORLD_ID='main';
const nowIso=(now:number)=>new Date(now).toISOString();
const accrued=(row:WorldRow,now:number)=>row.owed_sim_ms+(row.paused?0:Math.max(0,now-row.last_wall_ms)*row.pace_milli/1000);

/** One saved rule-policy world, driven only by explicit bounded server jobs. GET never advances time. */
export class PersistentWorldService{
 private coordinator:Coordinator;
 constructor(private store:SqlStore,private clock:()=>number=Date.now,private backgroundWriterEnabled=false){this.coordinator=new Coordinator(store);}
 private row(){return this.store.db.prepare('SELECT * FROM godmode_worlds WHERE id=?').bind(WORLD_ID).first<WorldRow>();}
 private async required(){const row=await this.row();if(!row)throw new ServiceError('WORLD_NOT_CREATED','Create the saved world first.',404);return row;}
 private async lease(){const token=crypto.randomUUID(),now=this.clock();const result=await this.store.db.prepare('UPDATE godmode_worlds SET lease_token=?,lease_until=? WHERE id=? AND lease_until<=?').bind(token,now+120000,WORLD_ID,now).run();if(result.meta?.changes!==1)throw new ServiceError('WORLD_BUSY','The saved world is finishing another tick. Try again shortly.',409);return token;}
 private async release(token:string){await this.store.db.prepare('UPDATE godmode_worlds SET lease_token=NULL,lease_until=0 WHERE id=? AND lease_token=?').bind(WORLD_ID,token).run();}
 private async dto(row:WorldRow){
  const run=await this.coordinator.get(row.run_id);
  const history=(await this.store.db.prepare('SELECT id,tick_before,requested_seconds,actual_seconds,status,source,started_at,completed_at,error_code FROM godmode_world_tick_jobs WHERE world_id=? ORDER BY started_at DESC,id DESC LIMIT 20').bind(WORLD_ID).all<Omit<TickJob,'world_id'|'run_id'|'expected_revision'>>()).results;
  return{revision:row.revision,paused:row.paused===1,pace:row.pace_milli/1000,run,clock:{dueSeconds:Math.floor(accrued(row,this.clock())/1000),lastWallAt:nowIso(row.last_wall_ms),lastTickAt:row.last_tick_at,lastBackgroundTickAt:row.last_background_tick_at,pendingJobId:row.pending_job_id,lastError:row.last_error},background:{writerEnabled:this.backgroundWriterEnabled,serviceTickVerified:row.last_background_tick_at!==null,lastRunAt:row.last_background_tick_at,notice:row.last_background_tick_at?'A service tick was persisted. This does not prove a future schedule remains enabled.':'No unattended service tick has been verified. Browser polling does not advance this world.'},history};
 }
 async get(){const row=await this.row();return{world:row?await this.dto(row):null};}
 async create(seed=1){const existing=await this.row();if(existing)return{world:await this.dto(existing)};
  const id=crypto.randomUUID(),now=this.clock(),state=initializePersistentWorld(seed,id);
  try{await this.store.db.batch([
   this.store.db.prepare('INSERT INTO godmode_runs(id,mode,state_json,created_at) VALUES(?,?,?,?)').bind(id,'rule-policy',JSON.stringify(state),nowIso(now)),
   this.store.db.prepare('INSERT INTO godmode_worlds(id,run_id,last_wall_ms,created_at) VALUES(?,?,?,?)').bind(WORLD_ID,id,now,nowIso(now)),
  ]);}catch(error){if(!await this.row())throw error;}
  return{world:await this.dto(await this.required())};
 }
 async settings(expectedRevision:number,settings:{paused?:boolean;pace?:number}){
  await this.required();const token=await this.lease();
  try{const row=await this.required();if(row.revision!==expectedRevision)throw new ServiceError('REVISION_CONFLICT','World clock settings changed. Reload them first.',409);
   const now=this.clock(),pace=settings.pace===undefined?row.pace_milli:Math.round(settings.pace*1000);if(!Number.isFinite(pace)||pace<10||pace>1000)throw new ServiceError('INVALID_PACE','World pace must be 0.01 to 1 simulation seconds per real second.');
   const result=await this.store.db.prepare('UPDATE godmode_worlds SET paused=?,pace_milli=?,owed_sim_ms=?,last_wall_ms=?,revision=revision+1 WHERE id=? AND revision=? AND lease_token=? AND lease_until>?').bind(settings.paused===undefined?row.paused:Number(settings.paused),pace,accrued(row,now),now,WORLD_ID,row.revision,token,now).run();if(result.meta?.changes!==1)throw new ServiceError('REVISION_CONFLICT','World clock settings changed. Reload them first.',409);
   return{world:await this.dto(await this.required())};
  }finally{await this.release(token);}
 }
 private async pending(row:WorldRow){return row.pending_job_id?this.store.db.prepare('SELECT * FROM godmode_world_tick_jobs WHERE id=?').bind(row.pending_job_id).first<TickJob>():null;}
 async tick(source:TickSource,maxSeconds=60){
  if(!Number.isSafeInteger(maxSeconds)||maxSeconds<1||maxSeconds>60)throw new ServiceError('INVALID_TICK_LIMIT','A world tick may advance 1 to 60 owed simulation seconds.');
  await this.required();const token=await this.lease();
  try{
   let row=await this.required(),job=await this.pending(row);
   if(row.paused)return{world:await this.dto(row)};
   if(!job){const now=this.clock(),owed=accrued(row,now),seconds=Math.min(maxSeconds,Math.floor(owed/1000));if(seconds<1)return{world:await this.dto(row)};
    const run=await this.store.get<WorldState>(row.run_id);if(run.mode!=='rule-policy'||run.state.mode!=='persistent')throw new ServiceError('PERSISTENT_MODE_REQUIRED','The saved world must use the persistent rule-policy engine.',422);
    const id=crypto.randomUUID();
    await this.store.db.batch([
     this.store.db.prepare('INSERT INTO godmode_world_tick_jobs(id,world_id,run_id,expected_revision,tick_before,requested_seconds,status,source,started_at,guard) VALUES(?,?,?,?,?,?,?,?,?,(SELECT CASE WHEN revision=? AND lease_token=? AND lease_until>? AND pending_job_id IS NULL THEN 1 ELSE 0 END FROM godmode_worlds WHERE id=?))').bind(id,WORLD_ID,row.run_id,run.revision,run.state.tick,seconds,'planned',source,nowIso(now),row.revision,token,now,WORLD_ID),
     this.store.db.prepare('UPDATE godmode_worlds SET pending_job_id=?,owed_sim_ms=?,last_wall_ms=?,revision=revision+1,last_error=NULL WHERE id=? AND lease_token=?').bind(id,owed-seconds*1000,now,WORLD_ID,token),
    ]);row=await this.required();job=await this.pending(row);
   }
   if(!job)throw new ServiceError('TICK_JOB_MISSING','The saved clock job could not be recovered.',503);
   const operationId=`world-tick:${job.id}`;
   // A crash after run commit reuses its command receipt instead of stepping twice.
   let run=await this.store.get<WorldState>(job.run_id);
   if(!await this.store.hasCommand(job.run_id,operationId)&&run.revision!==job.expected_revision){await this.store.db.prepare('UPDATE godmode_world_tick_jobs SET expected_revision=?,tick_before=? WHERE id=?').bind(run.revision,run.state.tick,job.id).run();job={...job,expected_revision:run.revision,tick_before:run.state.tick};}
   try{run=await this.coordinator.advance(job.run_id,job.expected_revision,job.requested_seconds,operationId);}catch(error){const code=error instanceof ServiceError?error.code:'TICK_FAILED';await this.store.db.batch([this.store.db.prepare('UPDATE godmode_world_tick_jobs SET error_code=? WHERE id=?').bind(code,job.id),this.store.db.prepare('UPDATE godmode_worlds SET last_error=? WHERE id=? AND lease_token=?').bind(code,WORLD_ID,token)]);throw error;}
   const actual=Math.max(0,Math.min(job.requested_seconds,run.state.tick-job.tick_before)),now=this.clock();
   await this.store.db.batch([
    this.store.db.prepare("UPDATE godmode_world_tick_jobs SET status='completed',actual_seconds=?,completed_at=?,error_code=NULL,guard=(SELECT CASE WHEN lease_token=? AND lease_until>? AND pending_job_id=? THEN 1 ELSE 0 END FROM godmode_worlds WHERE id=?) WHERE id=?").bind(actual,nowIso(now),token,now,job.id,WORLD_ID,job.id),
    this.store.db.prepare('UPDATE godmode_worlds SET pending_job_id=NULL,owed_sim_ms=owed_sim_ms+?,last_tick_at=?,last_background_tick_at=CASE WHEN ? THEN ? ELSE last_background_tick_at END,last_error=NULL,revision=revision+1 WHERE id=? AND lease_token=?').bind((job.requested_seconds-actual)*1000,nowIso(now),job.source==='service'?1:0,nowIso(now),WORLD_ID,token),
   ]);
   if(run.state.tick%300===0)await this.coordinator.checkpointPersistent(job.run_id);
   return{world:await this.dto(await this.required())};
  }finally{await this.release(token);}
 }
 async archives(){const row=await this.required();return{archives:(await this.store.db.prepare('SELECT id,from_tick,to_tick,final_hash,created_at FROM godmode_world_archives WHERE run_id=? ORDER BY to_tick DESC LIMIT 100').bind(row.run_id).all<{id:string;from_tick:number;to_tick:number;final_hash:string;created_at:string}>()).results};}
 async archive(id:string){const row=await this.required();const record=await this.store.db.prepare('SELECT payload_json FROM godmode_world_archives WHERE id=? AND run_id=?').bind(id,row.run_id).first<{payload_json:string}>();if(!record)throw new ServiceError('ARCHIVE_NOT_FOUND','That saved history segment was not found.',404);return{recording:JSON.parse(record.payload_json),provenance:'recorded-rule-policy',modelCalls:0};}
}
