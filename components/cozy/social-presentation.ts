import type {ActorTask,CozyEvent,CozyWorldState,Npc,RuleProvenance,SocialResponse} from "../../lib/cozy/contracts";

const conditionCopy:Record<SocialResponse["conditions"][number],string>={"witness-harvest":"Wants to see a harvest","needs-rest":"Needs a rest","needs-food":"Needs a meal",trust:"Not ready to trust the plan","protect-seeds":"Wants seeds protected"};
export const conditionLabel=(condition:SocialResponse["conditions"][number])=>conditionCopy[condition];
export const personName=(state:CozyWorldState,id:string)=>id==="player"?"You":state.npcs.find(n=>n.id===id)?.name??"A neighbor";
export const venueName=(id:string)=>id==="square"?"Village square":id==="market"?"Market green":id;
export function provenanceLabel(value:RuleProvenance){return value.mode==="local-qwen"?"Local Qwen idea":value.mode==="meta"?"Meta-assisted idea":value.mode==="fixture"?"Recorded fixture idea":"Manually recorded idea";}
function targetName(state:CozyWorldState,id:string){return state.places.find(p=>p.id===id)?.name??state.npcs.find(n=>n.id===id)?.name??(state.plots.some(p=>p.id===id)?"the wheat field":"the destination");}
export function taskLabel(state:CozyWorldState,npc:Pick<Npc,"task"|"action"|"path"|"inventory">){
 const task:ActorTask=npc.task;if(!task)return npc.path.length?"Taking a familiar walk":/rest/i.test(npc.action)?"Resting":"Taking a quiet moment";
 const target=targetName(state,task.targetId);
 if(task.kind==="communicate")return"Taking a proposal to "+target;
 if(task.kind==="food")return task.phase==="fetch"?"Checking wheat supplies":"Bringing "+(task.quantity??0)+" wheat to "+target;
 if(task.kind==="setup")return task.phase==="fetch"?"Collecting timber":npc.path.length?"Taking timber to "+target:"Preparing "+target;
 if(task.kind==="invite")return"Inviting "+target;
 if(task.kind==="inspect")return"Checking "+target;
 return npc.path.length?"Walking to the gathering":"At the gathering";
}
export function socialNotice(state:CozyWorldState,events:CozyEvent[]):{eventId:string;text:string}|null{
 for(const event of [...events].reverse()){
  if(!event.audience.includes("player"))continue;const name=personName(state,event.actorId??"");let text:string|null=null;
  if(event.type==="social_proposal_created")text=name+" has proposed a shared gathering.";
  else if(event.type==="social_proposal_delivered")text="A shared plan has reached another neighbor.";
  else if(event.type==="social_response"){
   const response=state.emergence?.proposals.flatMap(p=>Object.values(p.responses)).find(r=>r?.eventId===event.id);
   text=response?.stance==="join"?name+" wants to join the shared plan.":response?.stance==="conditional"?name+" has a condition for joining.":response?.stance==="decline"?name+" has declined this plan.":name+" has answered the shared plan.";
  }else if(event.type==="institution_formed")text="The neighbors have formed a shared group.";
  else if(event.type==="institution_task_completed")text=name+" finished a contribution to the group.";
  if(text)return{eventId:event.id,text};
 }
 return null;
}
const eventLabels:Record<string,string>={social_proposal_created:"A neighbor proposed a charter",social_proposal_delivered:"The proposal was delivered in person",social_response:"A neighbor answered independently",institution_formed:"A lasting group formed",institution_member_joined:"A neighbor joined the group",institution_permission_decided:"The owner's permission was recorded",institution_permission_observed:"A neighbor read the posted permission",institution_task_committed:"A real contribution was taken on",institution_task_completed:"A physical contribution was completed",cozy_world_upgraded:"A separate living branch began",initiative_waited:"The neighbor chose to wait",goods_reserved:"Supplies were reserved",goods_collected:"Supplies were collected",festival_food_added:"Wheat reached the gathering",festival_setup_completed:"The gathering place was prepared",festival_arrival:"A neighbor arrived",festival_started:"The gathering began",festival_completed:"The gathering became a shared memory",field_inspected:"The field was inspected",crop_harvested:"Wheat was harvested",rules_applied:"The town rules changed",npc_dialogue:"A neighbor spoke"};
export function eventLabel(event:CozyEvent){return eventLabels[event.type]??event.type.replaceAll("_"," ");}
export function contributionLabel(event:CozyEvent){
 const quantity=typeof event.payload.quantity==="number"?event.payload.quantity:0;
 return event.payload.kind==="food"?`Delivered ${quantity} wheat`:event.payload.kind==="setup"?"Prepared the gathering place":event.payload.kind==="invite"?"Delivered an invitation":eventLabel(event);
}
/** Resolve actual causal references, including memory receipt IDs; never infer from time. */
export function causalReceipts(state:CozyWorldState,sourceIds:string[],limit=12):{events:CozyEvent[];missing:string[]}{
 const queue=[...sourceIds],seen=new Set<string>(),events=new Map<string,CozyEvent>(),missing:string[]=[];
 while(queue.length&&seen.size<80&&events.size<limit){const id=queue.shift()!;if(seen.has(id))continue;seen.add(id);const event=state.events.find(e=>e.id===id);if(event){events.set(id,event);queue.push(...event.sourceIds);continue;}const memory=[state.player,...state.npcs].flatMap(a=>a.memories).find(m=>m.id===id);if(memory)queue.push(...memory.sourceIds);else missing.push(id);}
 return{events:[...events.values()].sort((a,b)=>a.step-b.step||a.seq-b.seq),missing};
}
