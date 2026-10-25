import type {ActorTask,CozyEvent,CozyWorldState,Memory,Npc,RuleProvenance,SocialResponse} from "../../lib/cozy/contracts";

const conditionCopy:Record<SocialResponse["conditions"][number],string>={"witness-harvest":"Wants to see a harvest","needs-rest":"Needs a rest","needs-food":"Needs a meal",trust:"Not ready to trust the plan","protect-seeds":"Wants seeds protected"};
export const conditionLabel=(condition:SocialResponse["conditions"][number])=>conditionCopy[condition];
/** Player copy comes from typed outcomes; the raw policy calculation stays in inspection. */
export function responseSummary(response:SocialResponse){return response.stance==="join"?"Chose to lend a hand.":response.stance==="conditional"?response.conditions.map(conditionLabel).join(". ")+".":response.conditions.includes("trust")?"Is not ready to make this commitment.":"Chose to sit this plan out.";}
export function needsSummary(npc:Npc){return[npc.needs.energy<30?"Needs a rest":npc.needs.energy>=70?"Well rested":"Taking it steadily",npc.needs.hunger>=70?"Ready for a meal":npc.needs.hunger>=45?"Getting hungry":"Not hungry",npc.needs.social>=65?"Looking for company":npc.needs.social>=35?"Open to company":"Enjoying some quiet"];}
export function relationshipLabel(npc:Pick<Npc,"trust">){return npc.trust>=75?"A trusted neighbor":npc.trust>=50?"Getting to know you":npc.trust>=25?"Still a little cautious":"Keeping some distance";}
export function memorySummary(state:CozyWorldState,memory:Memory){
 const response=state.emergence?.proposals.flatMap(proposal=>Object.values(proposal.responses)).find(value=>value&&memory.sourceIds.includes(value.eventId));
 if((memory.type==="social_response"||memory.type==="npc_dialogue")&&response)return responseSummary(response);
 if(memory.type==="initiative_waited")return"Chose to wait before taking on another plan.";
 if(memory.type.startsWith("institution_")){const event=state.events.find(value=>memory.sourceIds.includes(value.id)&&value.type===memory.type);if(event)return event.type==="institution_task_completed"?contributionLabel(event):eventLabel(event);}
 return memory.text;
}
export const personName=(state:CozyWorldState,id:string)=>id==="player"?"You":state.npcs.find(n=>n.id===id)?.name??"A neighbor";
export const venueName=(id:string)=>id==="square"?"Village square":id==="market"?"Market green":id;
export function provenanceLabel(value:RuleProvenance){return value.mode==="local-qwen"?"Local Qwen idea":value.mode==="meta"?"Meta-assisted idea":value.mode==="fixture"?"Recorded fixture idea":"Manually recorded idea";}
function targetName(state:CozyWorldState,id:string){return state.places.find(p=>p.id===id)?.name??state.npcs.find(n=>n.id===id)?.name??(state.plots.some(p=>p.id===id)?"the wheat field":"the destination");}
export function taskLabel(state:CozyWorldState,npc:Pick<Npc,"task"|"action"|"path"|"inventory">){
 const task:ActorTask=npc.task;if(!task)return npc.path.length?"Taking a familiar walk":/rest/i.test(npc.action)?"Resting":"Taking a quiet moment";
 const target=targetName(state,task.targetId);
 if(task.kind==="personal")return task.personalAction==="rest"?(npc.path.length?"Heading home to rest":"Taking a needed rest"):task.personalAction==="eat"?"Eating owned food":task.personalAction==="seek-meal"?"Looking for a real meal":task.personalAction==="inspect"?"Looking for evidence":task.personalAction==="talk"?(npc.path.length?"Walking over for a conversation":"Having a word with "+target):task.personalAction==="approach"?"Walking over to "+target:task.personalAction==="cooperate"?"Considering a shared contribution":"Taking a deliberate pause";
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
