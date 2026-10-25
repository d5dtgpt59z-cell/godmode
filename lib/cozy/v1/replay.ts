import {hashValue} from '../../sim/canonical';
import {COZY_CONTENT_VERSION,COZY_ENGINE_VERSION,CozyError,type CozyRecording,type CozyWorldState} from './contracts';
import {initializeCozyWorld} from './world';
import {advanceCozyWorld,applyNpcPlan,applyRulePatch,canonicalStringify,dispatchCozyCommand,hashCozyWorld,revertRulePatch,verifyCozyWorld} from './engine';

const copy=<T>(v:T):T=>structuredClone(v);
export function exportCozyRecording(s:CozyWorldState):CozyRecording{return{format:'godmode-cozy',version:1,engineVersion:COZY_ENGINE_VERSION,contentVersion:COZY_CONTENT_VERSION,origin:copy(s.origin),operations:copy(s.operations),finalStep:s.step,finalHash:hashCozyWorld(s),eventHead:s.eventHead};}
function originState(recording:CozyRecording):CozyWorldState{
  if(recording.origin.checkpointState){const state=JSON.parse(recording.origin.checkpointState) as CozyWorldState;if(verifyCozyWorld(state).length)throw new CozyError('INVALID_CHECKPOINT','This cozy checkpoint violates the engine contract.');state.operations=[];state.origin=copy(recording.origin);return state;}
  return initializeCozyWorld(recording.origin.seed,recording.origin.branchId);
}
export function replayCozyRecording(recording:CozyRecording,options:{untilStep?:number;untilOperation?:number;verify?:boolean}={}):CozyWorldState{
  if(!recording||recording.format!=='godmode-cozy'||recording.version!==1||recording.engineVersion!==COZY_ENGINE_VERSION||recording.contentVersion!==COZY_CONTENT_VERSION||!Array.isArray(recording.operations)||!Number.isSafeInteger(recording.finalStep)||recording.finalStep<0)throw new CozyError('INVALID_RECORDING','Unsupported cozy recording.');
  const until=options.untilStep??recording.finalStep;if(!Number.isSafeInteger(until)||until<0||until>recording.finalStep)throw new CozyError('INVALID_REWIND','Choose a recorded fixed step.');let state=originState(recording);
  if(options.untilOperation!==undefined&&(!Number.isSafeInteger(options.untilOperation)||options.untilOperation<0||options.untilOperation>recording.operations.length||options.untilStep!==undefined))throw new CozyError('INVALID_REWIND','Choose one valid operation prefix or one logical step.');
  if(until<state.step)throw new CozyError('ARCHIVED_HISTORY','This step belongs to a parent or earlier archive.');
  for(const op of recording.operations.slice(0,options.untilOperation??recording.operations.length)){
    if(op.type==='advance'){const amount=Math.min(op.steps,until-state.step);state=advanceCozyWorld(state,amount);if(amount<op.steps)break;}
    else if(state.step>until)break;
    else if(op.type==='command')state=dispatchCozyCommand(state,op.command);
    else if(op.type==='rules')state=applyRulePatch(state,op.patch,op.expectedRulesRevision,op.provenance,op.id);
    else if(op.type==='revert')state=revertRulePatch(state,op.expectedRulesRevision,op.provenance,op.id);
    else if(op.type==='npc-plan')state=applyNpcPlan(state,op.plan,op.provenance,op.id);
    else throw new CozyError('INVALID_RECORDING','Unknown cozy operation.');
  }
  if(options.untilStep===undefined&&options.untilOperation===undefined&&options.verify!==false&&(state.step!==recording.finalStep||hashCozyWorld(state)!==recording.finalHash||state.eventHead!==recording.eventHead||verifyCozyWorld(state).length))throw new CozyError('REPLAY_MISMATCH','The cozy recording did not reconstruct its exact state and event chain.');
  return state;
}
export function rewindCozyWorld(state:CozyWorldState,step:number):CozyWorldState{return replayCozyRecording(exportCozyRecording(state),{untilStep:step});}
function forkEvent(s:CozyWorldState,type:string,payload:Record<string,unknown>){const body={id:`${s.branchId}:${++s.eventSeq}`,seq:s.eventSeq,step:s.step,tick:s.tick,type,actorId:null,audience:[],payload,rulesRevision:s.rulesRevision,sourceIds:[],prevHash:s.eventHead};const event={...body,hash:hashValue(body)};s.eventHead=event.hash;s.events.push(event);if(s.events.length>600)s.events.shift();}
export const cozyOriginHash=(state:CozyWorldState)=>hashValue(state.origin);
export function forkCozyWorld(state:CozyWorldState,branchId:string,step?:number,operationIndex?:number,expectedOriginHash?:string):CozyWorldState{
  if(!branchId||branchId===state.branchId||branchId.length>80)throw new CozyError('INVALID_BRANCH','Choose a new branch identity.');if(expectedOriginHash!==undefined&&expectedOriginHash!==cozyOriginHash(state))throw new CozyError('ARCHIVED_HISTORY','This operation prefix belongs to a different history segment.');if(step!==undefined&&operationIndex!==undefined)throw new CozyError('INVALID_REWIND','Choose a step or an operation prefix.');const parent=operationIndex!==undefined?replayCozyRecording(exportCozyRecording(state),{untilOperation:operationIndex}):step===undefined?state:rewindCozyWorld(state,step),s=copy(parent),parentHash=hashCozyWorld(parent);s.branchId=branchId;s.operations=[];
  forkEvent(s,'cozy_branch_forked',{parentBranchId:parent.branchId,parentHash,atStep:s.step});
  const origin={seed:s.seed,branchId,parentBranchId:parent.branchId,parentHash};s.origin=origin;const base=copy(s);base.operations=[];base.origin=origin;s.origin={...origin,checkpointState:canonicalStringify(base)};return s;
}
export function forkBeforeRule(state:CozyWorldState,branchId:string,revision:number):CozyWorldState{const entry=state.ruleHistory.find(r=>r.revision===revision);if(!entry)throw new CozyError('UNKNOWN_RULE_VERSION','That rule change is outside retained history.');return forkCozyWorld(state,branchId,undefined,entry.operationIndex,entry.originHash);}
export function checkpointCozyWorld(state:CozyWorldState):{state:CozyWorldState;archive:CozyRecording}{
  const archive=exportCozyRecording(state),s=copy(state);s.operations=[];forkEvent(s,'cozy_history_checkpointed',{priorArchiveHash:archive.finalHash,priorEventHash:archive.eventHead,atStep:s.step});
  const origin={seed:s.seed,branchId:s.branchId,parentHash:archive.finalHash};s.origin=origin;const base=copy(s);base.origin=origin;base.operations=[];s.origin={...origin,checkpointState:canonicalStringify(base)};return{state:s,archive};
}
export function compareCozyWorlds(original:CozyWorldState,current:CozyWorldState){const start=(s:CozyWorldState)=>s.origin.checkpointState?(JSON.parse(s.origin.checkpointState) as CozyWorldState).step:0,step=Math.min(original.step,current.step);if(step<Math.max(start(original),start(current)))throw new CozyError('NO_COMMON_HISTORY','These history segments do not overlap.');const a=rewindCozyWorld(original,step),b=rewindCozyWorld(current,step);return{step,original:{hash:hashCozyWorld(a),harvests:a.player.harvests,gifts:a.player.gifts,festival:a.festival.phase,rulesRevision:a.rulesRevision},current:{hash:hashCozyWorld(b),harvests:b.player.harvests,gifts:b.player.gifts,festival:b.festival.phase,rulesRevision:b.rulesRevision},notice:'Descriptive comparison at the same logical step; no causal attribution is implied.'};}
