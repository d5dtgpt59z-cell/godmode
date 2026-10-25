import {initializeWorld,advanceWorld,getDueDecisionRequests,applyDecision,applyIntervention,chooseRuleDecision,projectObserver,exportRecording,replayRecording,rewindWorld,forkWorld,verifyWorld,hashState,checkpointPersistentWorld} from '../sim';
import type {WorldState,DecisionTicket,DecisionProposal,Recording,Intervention} from '../sim/contracts';
import {SqlStore,validProjectBudget,type RunMode,type RunHead} from './store';
import {decisionSchema,ModelDecisionError,requestDecision,type MetaOptions,type ModelResult} from './meta-adapter';
import {ServiceError} from './errors';
import {MAX_HISTORY_TICK} from './limits';

export type RunDTO=RunHead<WorldState>&{historyStartTick:number;view:ReturnType<typeof projectObserver>;playback:boolean;provenance:{mode:RunMode;label:string;localPrototype:true;eligibility:'unconfirmed';modelCallsThisRequest:number}};
export class Coordinator{
 constructor(public store:SqlStore,private meta:MetaOptions={}){}
 private historyStart(state:WorldState){if(!state.origin.checkpointState)return 0;try{const tick=(JSON.parse(state.origin.checkpointState) as {tick:unknown}).tick;if(typeof tick==='number'&&Number.isSafeInteger(tick)&&tick>=0&&tick<=state.tick)return tick;}catch{}throw new ServiceError('INVALID_HISTORY','The saved history checkpoint could not be read.',422);}
 private availableMoment(state:WorldState,tick:number){if(!Number.isSafeInteger(tick)||tick<0||tick>MAX_HISTORY_TICK||state.mode!=='persistent'&&tick>21600)throw new ServiceError('INVALID_HISTORY_TICK','Choose a valid whole-second moment in this recording.',422);if(tick<this.historyStart(state))throw new ServiceError('ARCHIVED_HISTORY','This moment belongs to an earlier archive. Choose a moment in the current history segment or open that archive.',422);}
 dto(head:RunHead<WorldState>,playback=false,modelCalls=0):RunDTO{return{...head,historyStartTick:this.historyStart(head.state),view:projectObserver(head.state),playback,provenance:{mode:head.mode,label:playback?'Recorded playback':head.mode==='live'?(head.state.agents.some(a=>a.decisions.fallback>0)?'Hybrid · requested Meta + recorded fallbacks':head.state.agents.some(a=>a.decisions.meta>0)?'Live Meta reasoning':'Live Meta requested · awaiting committed decisions'):head.mode==='fixture'?'Fixture · authored test behavior':head.mode==='recorded'?'Imported recording · no new inference':'Rule-policy baseline · no AI inference',localPrototype:true,eligibility:'unconfirmed',modelCallsThisRequest:modelCalls}};}
 async get(id:string){return this.dto(await this.store.get<WorldState>(id));}
 liveAvailable(){return this.meta.enabled===true&&!!this.meta.apiKey?.trim()&&validProjectBudget(this.meta.projectBudgetMicroUsd);}
 async create(seed:number,mode:RunMode='rule-policy'){
  if(mode==='live'&&!this.liveAvailable())throw new ServiceError('META_NOT_CONFIGURED','Meta is not connected. The rule-policy baseline is available.',503);
  if(!['rule-policy','live','fixture'].includes(mode))throw new ServiceError('INVALID_MODE','Choose rule-policy or live mode.');
  if(mode==='live')await this.store.configureProjectBudget(this.meta.projectBudgetMicroUsd!);
  const id=crypto.randomUUID();return this.dto(await this.store.create(id,mode,initializeWorld(seed,id)));
 }
 private writable(head:RunHead){if(head.mode==='recorded')throw new ServiceError('READ_ONLY_RECORDING','Recorded playback is read-only. Fork a settled moment to continue.',409);}
 private async mutate(id:string,expected:number,kind:string,work:(head:RunHead<WorldState>)=>Promise<{state:WorldState;payload:unknown;calls?:number}>,commandId?:string){
  const token=await this.store.lease(id);
  try{const head=await this.store.get<WorldState>(id);if(commandId&&await this.store.hasCommand(id,commandId))return this.dto(head);
   if(head.revision!==expected)throw new ServiceError('REVISION_CONFLICT','The town changed. Reload and try again.',409);this.writable(head);
   const {state,payload,calls}=await work(head);const problems=verifyWorld(state);if(problems.length)throw new ServiceError('INVARIANT_FAILURE','The simulation rejected this operation to preserve its rules.',422);
   const audit={request:payload,operations:state.operations.slice(head.state.operations.length),derivedEvents:state.events.filter(event=>event.seq>head.state.eventSeq)};
   const next=await this.store.append(id,expected,token,state,kind,audit,hashState(state),commandId);return this.dto(next,false,calls??0);
  }finally{await this.store.release(id,token);}
 }
 async command(id:string,expected:number,commandId:string,command:Intervention){return this.mutate(id,expected,'command',async head=>({state:applyIntervention(head.state,{...command,id:commandId}),payload:{command:{...command,id:commandId}}}),commandId);}
 private async resolveLive(id:string,ticket:DecisionTicket):Promise<{ticket:DecisionTicket;proposal:DecisionProposal;provenance:'meta'|'fallback';failure:string|null;jobId?:string;calls:number}>{
  const fallback=(failure:string,jobId?:string)=>({ticket,proposal:chooseRuleDecision(ticket.context),provenance:'fallback' as const,failure,jobId,calls:0});
  let job=await this.store.ticketJob(id,ticket.id);
  if(job?.status==='completed'&&job.result_json){const result=JSON.parse(job.result_json) as ModelResult;return{ticket,proposal:result.proposal,provenance:'meta',failure:null,jobId:job.id,calls:0};}
  if(job&&['failed','unknown','applied'].includes(job.status))return fallback(job.error_code??'RECOVERED_TERMINAL',job.id);
  if(job?.status==='dispatched'){
   if(Date.now()-(job.dispatched_at??0)<65000)throw new ServiceError('DECISION_PENDING','A previously dispatched decision is still pending. Wait before advancing.',409);
   await this.store.finish(job.id,null,'DISPATCH_OUTCOME_UNKNOWN');return fallback('DISPATCH_OUTCOME_UNKNOWN',job.id);
  }
  let generationSent=false;
  try{
   job??=await this.store.reserve(id,ticket.id,('triggerKind' in ticket&&ticket.triggerKind==='event'));
   const result=await requestDecision(ticket.context,{...this.meta,beforeRequest:async kind=>{await this.store.beforeRequest(job!.id,kind);if(kind==='generation')generationSent=true;}});
   await this.store.finish(job.id,result);
   return{ticket,proposal:result.proposal,provenance:'meta',failure:null,jobId:job.id,calls:1};
  }catch(error){if(error instanceof ServiceError&&error.code==='DECISION_PENDING')throw error;const code=error instanceof ServiceError?error.code:'MODEL_FAILURE';if(job)await this.store.finish(job.id,null,code,error instanceof ModelDecisionError?error.audit:undefined);return{...fallback(code,job?.id),calls:generationSent?1:0};}
 }
 async advance(id:string,expected:number,seconds:number,operationId?:string){
  const appliedJobs:string[]=[];
  const response=await this.mutate(id,expected,'advance',async head=>{
   let state=head.state,calls=0;
   if(head.mode==='live'){
    if(!this.liveAvailable())throw new ServiceError('META_NOT_CONFIGURED','Live Meta reasoning is disabled. Export this run or fork a rule-policy baseline.',503);
    await this.store.configureProjectBudget(this.meta.projectBudgetMicroUsd!);
    const due=getDueDecisionRequests(state).slice(0,6);
    // Promise completion order never decides simulation ordering.
    const completed=await Promise.allSettled(due.map(ticket=>this.resolveLive(id,ticket)));
    const rejected=completed.find(result=>result.status==='rejected');if(rejected?.status==='rejected')throw rejected.reason;
    for(const entry of completed){if(entry.status!=='fulfilled')continue;const result=entry.value;state=applyDecision(state,result.ticket.id,result.proposal,result.provenance,result.failure);calls+=result.calls;if(result.jobId)appliedJobs.push(result.jobId);}
    state=advanceWorld(state,seconds);
   }else state=advanceWorld(state,seconds,{rulePolicy:true});
   return{state,payload:{seconds,rulePolicy:head.mode!=='live'},calls};
  },operationId);
  for(const job of appliedJobs)await this.store.markApplied(job);
  return response;
 }
 async rewind(id:string,expected:number,tick:number){const head=await this.store.get<WorldState>(id);if(head.revision!==expected)throw new ServiceError('REVISION_CONFLICT','The town changed. Reload and try again.',409);this.availableMoment(head.state,tick);if(tick>head.state.tick)throw new ServiceError('FUTURE_REWIND','Choose a time already recorded.');let state:WorldState;try{state=rewindWorld(head.state,tick);}catch{throw new ServiceError('REWIND_UNAVAILABLE','This recorded moment could not be reconstructed.',422);}return this.dto({...head,state},true);}
 async checkpointPersistent(id:string){const token=await this.store.lease(id);try{const head=await this.store.get<WorldState>(id);if(head.mode!=='rule-policy'||head.state.mode!=='persistent')throw new ServiceError('PERSISTENT_MODE_REQUIRED','Only a saved rule-policy world can be archived.',422);
  const fromTick=head.state.origin.checkpointState?(JSON.parse(head.state.origin.checkpointState) as {tick:number}).tick:0;
  const bytes=new TextEncoder().encode(JSON.stringify(head.state)).length;
  if(head.state.blocked||head.state.tick%300!==0||head.state.settledTick!==head.state.tick||head.state.tick-fromTick<21600&&head.state.operations.length<1000&&bytes<1_650_000)return this.dto(head);
  const{state,archive}=checkpointPersistentWorld(head.state),payload=JSON.stringify(archive);if(new TextEncoder().encode(payload).length>1_800_000)throw new ServiceError('ARCHIVE_LIMIT','This history segment exceeds its durable archive limit.',413);
  const statement=this.store.db.prepare('INSERT INTO godmode_world_archives(id,run_id,from_tick,to_tick,final_hash,payload_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,fromTick,head.state.tick,archive.finalHash,payload,new Date().toISOString());
  return this.dto(await this.store.append(id,head.revision,token,state,'history-checkpoint',{archiveHash:archive.finalHash,derivedEvents:state.events.filter(event=>event.seq>head.state.eventSeq)},hashState(state),undefined,[statement]));
 }finally{await this.store.release(id,token);}}
 async fork(id:string,expected:number,tick?:number){
  const parent=await this.store.get<WorldState>(id);if(parent.revision!==expected)throw new ServiceError('REVISION_CONFLICT','The town changed. Reload and try again.',409);
  this.availableMoment(parent.state,tick??parent.state.tick);
  if(tick!==undefined&&tick>parent.state.tick)throw new ServiceError('FUTURE_FORK','Choose a recorded moment.');
  let point:WorldState;try{point=tick===undefined?parent.state:rewindWorld(parent.state,tick);}catch{throw new ServiceError('FORK_UNAVAILABLE','This recorded moment could not be reconstructed.',422);}
  if(point.tick%300!==0||getDueDecisionRequests(point).some(ticket=>ticket.effectiveTick<=point.tick))throw new ServiceError('UNSETTLED_FORK','Fork from a settled five-minute boundary.',422);
  const branch=crypto.randomUUID();const mode=parent.mode==='live'?'live':'rule-policy';if(mode==='live'&&!this.liveAvailable())throw new ServiceError('META_NOT_CONFIGURED','Live continuation requires a configured Meta account.',503);
  return this.dto(await this.store.create(branch,mode,forkWorld(point,branch),id));
 }
 async export(id:string){const head=await this.store.get<WorldState>(id);const jobs=await this.store.jobs(id);const imported=await this.store.importedAudits(id);return{format:'godmode-run',version:1,sourceMode:head.mode,recording:exportRecording(head.state),providerAuditProvenance:'locally-recorded',providerAudit:jobs.map(job=>({attemptId:job.id,ticketId:job.ticket_id,status:job.status,reservedMicroUsd:job.reserved_micro,actualMicroUsd:job.actual_micro,errorCode:job.error_code,result:job.result_json?JSON.parse(job.result_json):null})),importedProviderAudit:{provenance:'unverified-import',records:imported},budget:head.budget,notice:'Local prototype created 2026-10-25. Hackathon eligibility unconfirmed. Imported provider records are claims, not fresh inference.'};}
 private recording(value:unknown):Recording{
  const candidate=(value&&typeof value==='object'&&'recording'in value?value.recording:value) as Recording;
  if(!candidate||candidate.version!==1||!Array.isArray(candidate.operations)||candidate.operations.length>2000||!Number.isSafeInteger(candidate.finalTick)||candidate.finalTick<0||candidate.finalTick>(candidate.origin?.mode==='persistent'?MAX_HISTORY_TICK:21600)||typeof candidate.origin?.branchId!=='string'||typeof candidate.origin?.seed!=='number'||!Number.isSafeInteger(candidate.origin.seed)||typeof candidate.finalHash!=='string')throw new ServiceError('INVALID_RECORDING','This recording is malformed or exceeds its limits.',422);
  let requested=0;
  for(const operation of candidate.operations){
   if(operation.type==='advance'){if(!Number.isSafeInteger(operation.seconds)||operation.seconds<0||operation.seconds>21600||typeof operation.rulePolicy!=='boolean')throw new ServiceError('INVALID_RECORDING','The recording contains an invalid time step.',422);requested+=operation.seconds;}
   else if(operation.type==='decision'){if(!decisionSchema.safeParse(operation.proposal).success||!['rule','meta','fallback'].includes(operation.provenance)||typeof operation.ticketId!=='string')throw new ServiceError('INVALID_RECORDING','The recording contains an invalid decision.',422);}
   else if(operation.type==='intervention'){if(!['rain','resourceDrop','message'].includes(operation.command?.type)||typeof operation.command.id!=='string')throw new ServiceError('INVALID_RECORDING','The recording contains an invalid intervention.',422);}
   else throw new ServiceError('INVALID_RECORDING','The recording contains an unknown operation.',422);
  }
  if(requested>64800||candidate.origin.checkpointState&&candidate.origin.checkpointState.length>1800000)throw new ServiceError('REPLAY_LIMIT','This recording exceeds the replay work limit.',413);
  return candidate;
 }
 async import(value:unknown){const recording=this.recording(value);let state:WorldState;try{state=replayRecording(recording);}catch{throw new ServiceError('INVALID_RECORDING','This recording failed version or replay verification.',422);}
  let audits:unknown[]=[];
  if(value&&typeof value==='object'){
   const envelope=value as {providerAudit?:unknown;importedProviderAudit?:{records?:unknown}};
   for(const candidates of [envelope.providerAudit,envelope.importedProviderAudit?.records]){if(candidates===undefined)continue;if(!Array.isArray(candidates))throw new ServiceError('INVALID_AUDIT','Imported provider audit must be an array.',422);audits.push(...candidates);}
   if(audits.length>500||audits.some(record=>!record||typeof record!=='object'||Array.isArray(record)))throw new ServiceError('AUDIT_LIMIT','Imported provider audit exceeds its limits.',413);
  }
  const id=crypto.randomUUID();return this.dto(await this.store.create(id,'recorded',state,null,audits));}
 async replay(value:unknown){const recording=this.recording(value);try{const state=replayRecording(recording);return{verified:true,finalHash:hashState(state),state,view:projectObserver(state),playback:true,modelCalls:0};}catch{throw new ServiceError('INVALID_RECORDING','Replay did not reproduce the recorded state.',422);}}
}
