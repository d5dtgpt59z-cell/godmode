import {observeWorldObjects,worldObjectGoods,verifyWorldObjects,applyWorldObjectCommand,worldObjectPosition} from './world-objects';
import {beforeActivityStep,executeActivityTask,applyActivityProposalInternal,verifyActivities,type ActivityRuntime} from './activities';
import * as v2 from './v2';
import type {CozyWorldState as V2State,CozyCommand as V2Command} from './v2/contracts';
import {beforePersonalStep,afterPersonalStep,choosePersonalFallback,executePersonalTask,applyPersonalDecisionInternal,verifyPersonalMind,type PersonalRuntime} from './personal';
import * as v1 from './v1';
import type {CozyWorldState as V1State} from './v1/contracts';
import {hashValue,canonicalStringify} from '../sim/canonical';
import {COZY_MAP,distance,emptyGoods,festivalAttendanceSpot,inFlood,initializeCozyWorld,isCozyWalkable,newFestival} from './world';
import {COZY_ENGINE_VERSION,COZY_STEP_MS,MAX_ADVANCE_STEPS,NPC_IDS,CozyError,type Actor,type ActorId,type CozyCommand,type CozyEvent,type CozyWorldState,type CozyViolation,type Good,type Npc,type NpcContext,type NpcPlan,type PlaceId,type Point,type RulePatch,type RulePreview,type RuleProvenance,type RuleSet,type SocialProposal,type SocialResponse,type Institution,type InitiativeContext,type InitiativeOpportunity,type SocialInitiativeDecision,COZY_V2_ENGINE_VERSION,COZY_V3_ENGINE_VERSION,COZY_V3_CONTENT_VERSION,type PersonalDecision,type ActivityBlueprint} from './contracts';

const legacy=(s:CozyWorldState)=>s as unknown as V1State;
const GOODS:Good[]=['grain','water','timber','bread'];
const copy=<T>(value:T):T=>structuredClone(value);
function fail(code:string,message:string):never{throw new CozyError(code,message);}
const clamp=(v:number)=>Math.max(0,Math.min(100,v));
const place=(s:CozyWorldState,id:string)=>s.places.find(p=>p.id===id);
const npc=(s:CozyWorldState,id:string)=>s.npcs.find(n=>n.id===id);
const actors=(s:CozyWorldState):Actor[]=>[s.player,...s.npcs];
const pack=(actor:Actor)=>GOODS.reduce((sum,g)=>sum+actor.inventory[g],0);
const nearby=(s:CozyWorldState,p:Point,r=5):ActorId[]=>actors(s).filter(a=>distance(a,p)<=r).map(a=>a.id);
const close=(a:Point,b:Point)=>distance(a,b)<=1.25;
const rounded=(p:Point)=>({x:Math.round(p.x),y:Math.round(p.y)});
const position=(s:CozyWorldState,id:string):Point|null=>place(s,id)?.position??s.plots.find(p=>p.id===id)?.position??npc(s,id)??null;

function emit(s:CozyWorldState,type:string,actorId:ActorId|null,payload:Record<string,unknown>,audience:ActorId[]=[],sourceIds:string[]=[]):CozyEvent{
  const body={id:`${s.branchId}:${++s.eventSeq}`,seq:s.eventSeq,step:s.step,tick:s.tick,type,actorId,audience:[...new Set(audience)].sort(),payload:copy(payload),sourceIds:[...sourceIds],rulesRevision:s.rulesRevision,prevHash:s.eventHead};
  const event={...body,hash:hashValue(body)};s.eventHead=event.hash;s.events.push(event);if(s.events.length>600)s.events.shift();return event;
}
function remember(s:CozyWorldState,event:CozyEvent,text:string){for(const a of actors(s).filter(a=>event.audience.includes(a.id))){a.memories.push({id:`${event.id}/m/${a.id}`,step:s.step,type:event.type,text,sourceIds:[event.id,...event.sourceIds],actorId:event.actorId,...(s.emergence&&event.type==='field_inspected'?{facts:{harvestCount:Number(event.payload.recordedHarvests??0)}}:s.emergence&&typeof event.payload.institutionId==='string'&&Array.isArray(event.payload.knownMemberIds)?{facts:{institutionId:event.payload.institutionId,memberIds:[...event.payload.knownMemberIds] as typeof NPC_IDS[number][]}}:{})});if(a.memories.length>32){const receipt=a.memories.find(m=>m.type==='crop_harvested');a.memories=a.memories.slice(-31);if(receipt&&!a.memories.some(m=>m.id===receipt.id))a.memories.unshift(receipt);}}}
function say(s:CozyWorldState,n:Npc,text:string,sourceIds:string[]=[]){const e=emit(s,'npc_dialogue',n.id,{text},nearby(s,n,3),sourceIds);remember(s,e,`${n.name}: ${text}`);}
function observedFestival(s:CozyWorldState,n:Npc){n.knownFestival=true;n.festivalObservation={id:s.festival.id,venue:s.festival.venue,phase:s.festival.phase,food:s.festival.food,setupDone:s.festival.setupDone,step:s.step};}
function witnessPreparations(s:CozyWorldState){const v=place(s,s.festival.venue)!;for(const n of s.npcs)if(distance(n,v.position)<=4)observedFestival(s,n);}
function eventAtVenue(s:CozyWorldState,type:string,actorId:ActorId,payload:Record<string,unknown>){const v=place(s,s.festival.venue)!;const e=emit(s,type,actorId,{festivalId:s.festival.id,venue:s.festival.venue,...payload},nearby(s,v.position));remember(s,e,String(payload.text??type.replaceAll('_',' ')));witnessPreparations(s);return e;}
function seenId(s:CozyWorldState,id:string){return s.commandIds.includes(id);}
function markId(s:CozyWorldState,id:string){s.commandIds.push(id);if(s.commandIds.length>2048)s.commandIds.shift();}
function stableId(id:unknown):asserts id is string{if(typeof id!=='string'||!id||id.length>120)fail('INVALID_COMMAND','A command needs a stable id of at most120 characters.');}
function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function integer(value:unknown,min:number,max:number):value is number{return typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;}
function exactKeys(value:Record<string,unknown>,allowed:string[]){if(Object.keys(value).some(k=>!allowed.includes(k)))fail('INVALID_COMMAND','Unsupported command field.');}

export function validateCozyCommand(value:unknown):CozyCommand{
  if(!record(value))fail('INVALID_COMMAND','Expected a command object.');stableId(value.id);
  const base=['id','type'];
  switch(value.type){
    case'move':exactKeys(value,[...base,'target']);if(!record(value.target)||!integer(value.target.x,0,31)||!integer(value.target.y,0,23)||Object.keys(value.target).some(k=>!['x','y'].includes(k)))fail('INVALID_COMMAND','Choose an integer tile target.');break;
    case'object-interact':exactKeys(value,[...base,'objectId','action','item','quantity']);if(typeof value.objectId!=='string'||!value.objectId||value.objectId.length>120||!['inspect','collect'].includes(value.action as string)||value.action==='inspect'&&(value.item!==null||value.quantity!==0)||value.action==='collect'&&(value.item!=='water'||!integer(value.quantity,1,12)))fail('INVALID_COMMAND','Choose an exact supported object interaction.');break;
    case'share-idea':exactKeys(value,[...base,'npcId','text']);if(value.npcId!=='wren'||typeof value.text!=='string'||value.text.trim().length<3||value.text.length>500)fail('INVALID_COMMAND','Share a nearby idea with Wren in3..500 characters.');break;
    case'stop':case'festival-reset':exactKeys(value,base);break;
    case'plant':case'water':case'harvest':exactKeys(value,[...base,'plotId']);if(!COZY_MAP.plots.some(p=>p.id===value.plotId))fail('INVALID_COMMAND','Unknown crop plot.');break;
    case'collect':exactKeys(value,[...base,'placeId','item','quantity']);if(!COZY_MAP.places.some(p=>p.id===value.placeId)||!GOODS.includes(value.item as Good)||!integer(value.quantity,1,6))fail('INVALID_COMMAND','Invalid collection target, item or quantity.');break;
    case'gift':exactKeys(value,[...base,'npcId','item','quantity']);if(!NPC_IDS.includes(value.npcId as typeof NPC_IDS[number])||!GOODS.includes(value.item as Good)||!integer(value.quantity,1,3))fail('INVALID_COMMAND','Invalid gift.');break;
    case'talk':case'invite':exactKeys(value,[...base,'npcId']);if(!NPC_IDS.includes(value.npcId as typeof NPC_IDS[number]))fail('INVALID_COMMAND','Unknown villager.');break;
    case'festival':exactKeys(value,[...base,'task','quantity']);if(!['food','setup'].includes(value.task as string)||value.quantity!==undefined&&!integer(value.quantity,1,3))fail('INVALID_COMMAND','Choose a supported festival task.');break;
    default:fail('INVALID_COMMAND','This action is not implemented.');
  }
  return copy(value) as CozyCommand;
}

/** Stable BFS supports real building and temporary flood collisions, unlike a visual-only overlay. */
export function findCozyPath(s:CozyWorldState,from:Point,to:Point,allowFlood=false):Point[]|null{
  const start=rounded(from);if(!isCozyWalkable(s,to.x,to.y,allowFlood))return null;
  const key=(p:Point)=>`${p.x},${p.y}`,queue:Point[]=[start],parents=new Map<string,Point|null>([[key(start),null]]);let end:Point|null=null;
  for(let i=0;i<queue.length;i++){const p=queue[i];if(p.x===to.x&&p.y===to.y){end=p;break;}for(const [dx,dy]of [[0,-1],[-1,0],[1,0],[0,1]]){const n={x:p.x+dx,y:p.y+dy},id=key(n);if(!parents.has(id)&&isCozyWalkable(s,n.x,n.y,allowFlood)){parents.set(id,p);queue.push(n);}}}
  if(!end)return null;const path:Point[]=[];for(let p:Point|null=end;p&&key(p)!==key(start);p=parents.get(key(p))??null)path.push(p);path.reverse();if(distance(from,start)>0)path.unshift(start);return path;
}
function route(s:CozyWorldState,a:Actor,target:Point):boolean{const path=findCozyPath(s,a,target);if(path===null)return false;a.path=path;return true;}
function release(s:CozyWorldState,a:Actor){s.reservations=s.reservations.filter(r=>r.actorId!==a.id);delete s.festival.foodReserved[a.id];if(s.festival.setupOwner===a.id&&!s.festival.setupDone)s.festival.setupOwner=null;}
function finish(s:CozyWorldState,a:Actor){release(s,a);a.task=null;a.path=[];a.action='Enjoying the village';}
function cancel(s:CozyWorldState,a:Actor){if(a.task){emit(s,'task_cancelled',a.id,{kind:a.task.kind,reason:'A new action superseded this task.'},[a.id]);}finish(s,a);}
function advanceMovement(s:CozyWorldState,a:Actor){
  if(!a.path.length)return;const next=a.path[0],egress=s.flood.egress.includes(a.id)&&inFlood(a);
  if(!isCozyWalkable(s,next.x,next.y,egress)){a.path=[];a.action='The path is flooded; finding another way';return;}
  const dx=next.x-a.x,dy=next.y-a.y;if(dx!==0)a.x+=Math.sign(dx)*Math.min(0.25,Math.abs(dx));else if(dy!==0)a.y+=Math.sign(dy)*Math.min(0.25,Math.abs(dy));
  if(a.x===next.x&&a.y===next.y)a.path.shift();if(!inFlood(a))s.flood.egress=s.flood.egress.filter(id=>id!==a.id);
}
function available(s:CozyWorldState,id:PlaceId,item:Good){return place(s,id)!.stock[item]-s.reservations.filter(r=>r.placeId===id&&r.item===item).reduce((n,r)=>n+r.quantity,0);}
function reserve(s:CozyWorldState,a:Actor,id:PlaceId,item:Good,quantity:number){if(available(s,id,item)<quantity)return false;s.reservations.push({actorId:a.id,placeId:id,item,quantity});emit(s,'goods_reserved',a.id,{placeId:id,item,quantity},[a.id]);return true;}
function pickup(s:CozyWorldState,a:Actor,id:PlaceId,item:Good,quantity:number){const p=place(s,id)!;if(p.stock[item]<quantity)return false;p.stock[item]-=quantity;a.inventory[item]+=quantity;s.reservations=s.reservations.filter(r=>r.actorId!==a.id);const e=emit(s,'goods_collected',a.id,{placeId:id,item,quantity},nearby(s,p.position));remember(s,e,`${a.name} collected ${quantity} ${item} at ${p.name}.`);return true;}
function requireClose(a:Point,b:Point){if(!close(a,b))fail('TOO_FAR','Walk next to it first.');}
function spendableGrain(s:CozyWorldState){return Math.max(0,s.player.inventory.grain-s.rules.seedReserve);}

export function dispatchCozyCommand(state:CozyWorldState,input:CozyCommand):CozyWorldState{
  if(state.engineVersion===COZY_ENGINE_VERSION)return v1.dispatchCozyCommand(legacy(state),input as unknown as Parameters<typeof v1.dispatchCozyCommand>[1]);
  if(state.engineVersion===COZY_V2_ENGINE_VERSION)return v2.dispatchCozyCommand(state as unknown as V2State,input as unknown as V2Command);
  if(input.type==='share-idea'&&!state.mind)fail('PERSONAL_UPGRADE_REQUIRED','Use a separate personal-world branch to share ideas.');
  const command=validateCozyCommand(input);if(seenId(state,command.id))return state;const s=copy(state),p=s.player;
  if(command.type==='object-interact'){if(!worldObjectPosition(s,command.objectId))fail('UNKNOWN_WORLD_OBJECT','That world object does not exist.');cancel(s,p);applyWorldObjectCommand(s,command,personalRuntime());}
  else if(command.type==='share-idea'){const wren=npc(s,'wren')!;requireClose(p,wren);const event=emit(s,'player_idea_shared','player',{text:command.text,npcId:'wren',attributed:true},['player','wren']);remember(s,event,`You told Wren: ${command.text}`);}
  else if(command.type==='move'){if(!route(s,p,command.target))fail('PATH_BLOCKED','That tile cannot be reached.');if(p.task){release(s,p);p.task=null;}p.action=p.path.length?'Walking':'Here we are';}
  else if(command.type==='stop')cancel(s,p);
  else{
    if(p.task)fail('PLAYER_BUSY','Finish or cancel the current task first.');if(s.flood.egress.includes('player')&&inFlood(p))fail('ESCAPING_FLOOD','Reach dry ground before interacting.');p.path=[];
    if(['plant','water','harvest'].includes(command.type)){
      const c=command as Extract<CozyCommand,{plotId:string}>,plot=s.plots.find(v=>v.id===c.plotId)!;requireClose(p,plot.position);if(s.flood.active&&inFlood(plot.position))fail('PLOT_FLOODED','The plot is under floodwater.');
      if(c.type==='plant'){if(plot.phase!=='empty')fail('PLOT_OCCUPIED','This plot already has a crop.');if(p.inventory.grain<1)fail('NO_SEED','One grain is needed as seed.');p.inventory.grain--;s.ledger.consumed.grain++;plot.phase='planted';plot.plantedAt=s.step;plot.plantedBy='player';const e=emit(s,'crop_planted','player',{plotId:plot.id,seed:1},nearby(s,plot.position));remember(s,e,'You planted one grain seed.');}
      if(c.type==='water'){if(plot.phase!=='planted')fail('NOT_THIRSTY','Plant a seed first; this crop needs one watering.');if(p.inventory.water<1)fail('NO_WATER','Collect water from the well first.');p.inventory.water--;s.ledger.consumed.water++;plot.phase='growing';plot.wateredAt=s.step;plot.readyAt=s.step+180;const e=emit(s,'crop_watered','player',{plotId:plot.id,water:1,readyAt:plot.readyAt},nearby(s,plot.position));remember(s,e,'You watered the wheat.');}
      if(c.type==='harvest'){if(plot.phase!=='ripe')fail('NOT_RIPE','This wheat is not ready to harvest.');if(pack(p)+4>24)fail('PACK_FULL','Make room for four grain first.');p.inventory.grain+=4;s.ledger.produced.grain+=4;p.harvests++;plot.harvestCount++;plot.phase='empty';plot.plantedAt=null;plot.wateredAt=null;plot.readyAt=null;plot.plantedBy=null;const e=emit(s,'crop_harvested','player',{plotId:plot.id,quantity:4,item:'grain'},nearby(s,plot.position));remember(s,e,'You harvested four grain from wheat you grew.');for(const n of s.npcs.filter(n=>e.audience.includes(n.id))){n.harvestsSeen++;say(s,n,n.id==='ada'?'Fresh grain! That could feed our gathering.':n.id==='mara'?'I saw this harvest myself. Those supplies are real.':'Our first harvest deserves company!', [e.id]);}}
    }else if(command.type==='collect'){const target=place(s,command.placeId)!;requireClose(p,target.position);if(available(s,target.id,command.item)<command.quantity)fail('NOT_AVAILABLE','Those goods are unavailable or reserved.');if(pack(p)+command.quantity>24)fail('PACK_FULL','Your pack is full.');pickup(s,p,target.id,command.item,command.quantity);}
    else if(command.type==='gift'){
      const n=npc(s,command.npcId)!;requireClose(p,n);if(p.inventory[command.item]<command.quantity)fail('NOT_OWNED','You can only give goods you actually carry.');if(command.item==='grain'&&spendableGrain(s)<command.quantity)fail('SEED_RESERVED','The seed reserve protects grain for planting.');
      const accepts=n.id!=='mara'||command.item!=='grain'||n.harvestsSeen>0||!!n.fieldVerified;
      const e=emit(s,accepts?'gift_accepted':'gift_declined','player',{npcId:n.id,item:command.item,quantity:command.quantity,accepted:accepts},['player',n.id]);remember(s,e,accepts?`${n.name} accepted your gift.`:`${n.name} wants to see where the grain came from first.`);
      n.lastGiftStep=s.step;if(accepts){p.inventory[command.item]-=command.quantity;n.inventory[command.item]+=command.quantity;p.gifts++;n.giftCount++;const liked=n.id==='ada'&&command.item==='grain'||n.id==='mara'&&command.item==='timber'||n.id==='wren'&&command.item==='bread';n.trust=clamp(n.trust+(liked?5:2));n.affinity=clamp(n.affinity+(liked?8:3));say(s,n,n.id==='ada'?'Thank you. Useful grain makes a lovely gift.':n.id==='mara'?'Practical help. I appreciate that.':'You thought of me! I’ll tell the others.',[e.id]);}
      else{n.reason='I want to inspect the wheat before accepting an unverified harvest gift.';n.task={kind:'inspect',targetId:'plot-1',remainingSteps:5,reason:n.reason,ruleRevision:s.rulesRevision};route(s,n,s.plots[0].position);say(s,n,'Let me see the field first. I like knowing where things came from.',[e.id]);}
    }else if(command.type==='talk'){const n=npc(s,command.npcId)!;requireClose(p,n);say(s,n,n.id==='ada'?'I like turning a little grain into something we can share.':n.id==='mara'?n.harvestsSeen?'I trust the harvest I have seen. Let’s prepare carefully.':'Show me your growing wheat. I like a plan with evidence.':'A village feels warmer when someone brings people together.');}
    else if(command.type==='invite'){const n=npc(s,command.npcId)!;requireClose(p,n);invite(s,'player',n);}
    else if(command.type==='festival'){
      requireClose(p,place(s,s.festival.venue)!.position);if(!['planning','gathering'].includes(s.festival.phase))fail('FESTIVAL_CLOSED','This gathering is already underway or complete.');
      if(command.task==='food'){const quantity=Math.min(command.quantity??1,s.rules.foodTarget-s.festival.food);if(quantity<1)fail('ENOUGH_FOOD','The food target is already met.');if(spendableGrain(s)<quantity)fail('SEED_RESERVED','Keep the protected seed grain in your bag.');p.inventory.grain-=quantity;s.festival.food+=quantity;eventAtVenue(s,'festival_food_added','player',{quantity,text:`You brought ${quantity} grain for the festival.`});}
      else{if(s.festival.setupDone||s.festival.setupOwner)fail('SETUP_TAKEN','The setup is complete or someone is already working on it.');if(p.inventory.timber<1)fail('NO_TIMBER','One timber is needed to prepare the gathering.');s.festival.setupOwner='player';p.task={kind:'setup',targetId:s.festival.venue,remainingSteps:30,reason:'Preparing a welcoming place to gather.',ruleRevision:s.rulesRevision,phase:'work'};p.action='Setting up the festival';emit(s,'setup_started','player',{durationSteps:30},nearby(s,p));}
    }else if(command.type==='festival-reset'){if(s.festival.phase!=='complete')fail('FESTIVAL_NOT_COMPLETE','Finish this gathering before planning another.');s.festival=newFestival(s.festival.id+1,s.rules.venue);for(const n of s.npcs){n.festivalAccepted=false;n.knownFestival=false;delete n.festivalObservation;finish(s,n);}emit(s,'festival_planned','player',{festivalId:s.festival.id,venue:s.festival.venue},['player']);}
  }
  markId(s,command.id);s.operations.push({type:'command',command});emit(s,'player_command','player',{command},['player']);if(s.mind)afterPersonalStep(s,personalRuntime());return s;
}

function invite(s:CozyWorldState,source:ActorId,n:Npc){if(s.festival.invitations[n.id])return;s.festival.invitations[n.id]={source,step:s.step};observedFestival(s,n);const e=emit(s,'festival_invitation',source,{npcId:n.id,festivalId:s.festival.id,venue:s.festival.venue},[source,n.id]);remember(s,e,`${source==='player'?'You':source} invited ${n.name} to the gathering.`);}
function announce(s:CozyWorldState){s.festival.announced=true;const e=emit(s,'festival_notice_posted','wren',{festivalId:s.festival.id,venue:s.festival.venue,foodTarget:s.rules.foodTarget,source:'Public gathering request',provenance:'deterministic rule policy'},[...NPC_IDS]);remember(s,e,'The village notice asks for food, a prepared space and invitations. Each villager chooses whether to help.');for(const n of s.npcs)observedFestival(s,n);}
function bid(s:CozyWorldState,n:Npc,kind:'food'|'setup'|'invite',source?:RuleProvenance){const e=emit(s,'festival_bid',n.id,{kind,reason:n.reason,provenance:source??'deterministic rule policy'},[n.id]);remember(s,e,`${n.name} chose to help with ${kind}.`);}
function assignFood(s:CozyWorldState,n:Npc,wanted=3,source?:RuleProvenance):boolean{
  const planned=s.emergence?s.npcs.filter(a=>a.task?.kind==='food').reduce((q,a)=>q+(a.task!.quantity??1),0):Object.values(s.festival.foodReserved).reduce((a,b)=>a+(b??0),0);const remaining=s.rules.foodTarget-s.festival.food-planned;if(remaining<=0)return false;
  const held=Math.min(wanted,remaining,n.inventory.grain);if(s.emergence&&!held&&distance(n,place(s,'bakery')!.position)>2){n.task={kind:'food',targetId:s.festival.venue,remainingSteps:0,reason:'Check real supplies at the bakery before promising grain.',ruleRevision:s.rulesRevision,quantity:Math.min(wanted,remaining),sourceId:'bakery',phase:'fetch'};n.reason=n.task.reason;n.action='Checking possible shared supplies';route(s,n,place(s,'bakery')!.position);return true;}const quantity=held||Math.min(wanted,remaining,Math.max(0,available(s,'bakery','grain')-s.rules.seedReserve));if(quantity<1)return false;
  if(!held&&!reserve(s,n,'bakery','grain',quantity))return false;s.festival.foodReserved[n.id]=quantity;n.reason='I can contribute actual grain to our shared table.';n.task={kind:'food',targetId:s.festival.venue,remainingSteps:0,reason:n.reason,ruleRevision:s.rulesRevision,quantity,sourceId:'bakery',phase:held?'deliver':'fetch'};n.action=held?'Bringing grain to the gathering':'Fetching reserved grain';route(s,n,place(s,held?s.festival.venue:'bakery')!.position);bid(s,n,'food',source);return true;
}
function assignSetup(s:CozyWorldState,n:Npc,source?:RuleProvenance):boolean{
  if(s.festival.setupDone||s.festival.setupOwner)return false;const held=n.inventory.timber>0;if(!held&&(!s.emergence||distance(n,place(s,'woodpile')!.position)<=2)&&!reserve(s,n,'woodpile','timber',1))return false;
  s.festival.setupOwner=n.id;n.reason='A gathering needs a real, prepared place.';n.task={kind:'setup',targetId:s.festival.venue,remainingSteps:30,reason:n.reason,ruleRevision:s.rulesRevision,sourceId:'woodpile',phase:held?'work':'fetch'};n.action='Preparing the gathering';route(s,n,place(s,held?s.festival.venue:'woodpile')!.position);bid(s,n,'setup',source);return true;
}
function assignAttendance(s:CozyWorldState,n:Npc,reason:string){
  const target=festivalAttendanceSpot(s,n.id,s.festival.venue);
  n.task={kind:'attend',targetId:s.festival.venue,remainingSteps:0,reason,ruleRevision:s.rulesRevision,...(target?{attendanceSpot:target}:{})};n.path=[];n.action='Going to the gathering';
  if(!target||!route(s,n,target))n.action='Waiting for a safe gathering route';
}
function chooseNpc(s:CozyWorldState,n:Npc){
  n.lastDecisionStep=s.step;if(n.task?.kind==='activity')return;if(s.mind&&n.id==='wren'){choosePersonalFallback(s,n,personalRuntime());return;}if(n.overrideUntil&&n.overrideUntil>s.step)return;
  if(!n.task&&!n.path.length&&(n.needs.energy<25||n.resting&&n.needs.energy<55)){n.resting=true;n.reason='I need a short rest before taking on more work.';n.action='Resting at home';route(s,n,place(s,n.homeId)!.position);return;}
  if(n.resting&&n.needs.energy>=55)delete n.resting;
  if(!n.task&&!n.path.length&&n.needs.hunger>=85){const item=n.inventory.bread>0?'bread':n.inventory.grain>0?'grain':null;if(item){n.inventory[item]--;s.ledger.consumed[item]++;n.needs.hunger=Math.max(0,n.needs.hunger-65);const e=emit(s,'npc_meal_eaten',n.id,{item,quantity:1},nearby(s,n));remember(s,e,`${n.name} ate a real meal before helping again.`);}else if(distance(n,place(s,'bakery')!.position)<=1&&available(s,'bakery','bread')>0){pickup(s,n,'bakery','bread',1);}else if(distance(n,place(s,'bakery')!.position)<=1&&available(s,'bakery','grain')>s.rules.seedReserve){pickup(s,n,'bakery','grain',1);}else{n.reason='I need food before I can help.';n.action='Looking for a meal';route(s,n,place(s,'bakery')!.position);}return;}
  if(s.emergence){chooseCooperativeNpc(s,n);return;}
  if(n.task||n.path.length)return;if(s.festival.phase==='celebrating'){if(n.knownFestival&&n.trust>=30&&!n.festivalAccepted){n.festivalAccepted=true;n.reason='The preparations are ready, and I would like to join.';emit(s,'festival_commitment',n.id,{accepted:true,reason:n.reason,provenance:'deterministic rule policy'},[n.id]);}if(n.festivalAccepted){assignAttendance(s,n,'Enjoying the gathering I chose to join.');}return;}
  if(s.festival.phase!=='complete'&&n.knownFestival){
    if(s.rules.organizer==='villagers'&&n.trust>=30&&n.needs.energy>=25&&n.needs.hunger<85){if(n.id==='ada'&&n.goals.find(g=>g.id==='help')!.weight>=60&&assignFood(s,n))return;if(n.id==='mara'&&n.goals.find(g=>g.id==='understand')!.weight>=60&&assignSetup(s,n))return;if(n.id==='wren'&&n.goals.find(g=>g.id==='belong')!.weight>=60){const target=s.npcs.find(other=>other.id!==n.id&&!s.festival.invitations[other.id]);if(target){n.reason='I want the others to feel welcome.';n.task={kind:'invite',targetId:target.id,remainingSteps:0,reason:n.reason,ruleRevision:s.rulesRevision};n.action=`Inviting ${target.name}`;route(s,n,rounded(target));bid(s,n,'invite');return;}}}
    if(s.festival.invitations[n.id]||s.rules.organizer==='villagers'){
      if(n.trust<30){n.reason='I am not ready to commit to this gathering.';return;}
      if(n.goals.find(g=>g.id==='belong')!.weight+n.needs.social>=110||(n.festivalObservation?.food??0)>=s.rules.foodTarget&&n.festivalObservation?.setupDone){n.festivalAccepted=true;n.reason=n.id==='wren'?'I enjoy bringing people together.':'I saw that the preparations are ready.';assignAttendance(s,n,n.reason);emit(s,'festival_commitment',n.id,{accepted:true,reason:n.reason,provenance:'deterministic rule policy'},[n.id]);return;}
      n.task={kind:'inspect',targetId:s.festival.venue,remainingSteps:5,reason:'Check the preparations myself before joining.',ruleRevision:s.rulesRevision};n.action='Checking the festival preparations';route(s,n,place(s,s.festival.venue)!.position);return;
    }
  }
  const hour=(8+s.tick/3600)%24;const target=hour>=20||hour<6?place(s,n.homeId)!.position:n.id==='mara'?{x:s.plots[0].position.x,y:s.plots[0].position.y+1}:n.id==='wren'?place(s,'square')!.position:place(s,'bakery')!.position;
  n.action=hour>=20||hour<6?'Heading home':'Enjoying a familiar walk';route(s,n,target);
}
function executeTask(s:CozyWorldState,a:Actor){
  const task=a.task;if(!task)return;if(task.kind==='activity'){executeActivityTask(s,a,activityRuntime());return;}if(task.kind==='personal'){executePersonalTask(s,a,personalRuntime());return;}
  if(a.id!=='player'&&s.rules.organizer==='player'&&['food','setup','invite'].includes(task.kind)){finish(s,a);return;}
  if(s.flood.egress.includes(a.id))return;
  if(task.kind==='communicate'){executeCommunication(s,a,task);return;}
  if(task.institutionId&&(!s.emergence?.institutions.some(g=>g.id===task.institutionId&&g.permission==='approved'&&g.members.includes(a.id as typeof NPC_IDS[number]))||s.rules.organizer!=='villagers')){finish(s,a);return;}
  if(task.kind==='invite'){
    const target=npc(s,task.targetId);if(!target){finish(s,a);return;}if(!close(a,target)){if(s.emergence)seekPerson(s,a,task,target);else if(s.step%10===0||!a.path.length)route(s,a,rounded(target));return;}invite(s,a.id,target);completedInstitutionTask(s,a,'invite',1);finish(s,a);return;
  }
  const target=task.kind==='attend'&&a.id!=='player'?festivalAttendanceSpot(s,a.id,s.festival.venue):position(s,task.phase==='fetch'?task.sourceId!:task.targetId);
  if(!target){if(task.kind==='attend'){a.path=[];a.action='Waiting for a safe gathering spot';return;}finish(s,a);return;}
  if(task.kind==='attend'){
    const changed=!task.attendanceSpot||distance(task.attendanceSpot,target)!==0;task.attendanceSpot={...target};
    const oldTarget=a.path.at(-1);if(changed||oldTarget&&distance(oldTarget,target)!==0){a.path=[];if(!route(s,a,target)){a.action='Waiting for a safe gathering route';return;}}
    if(distance(a,target)!==0){if(!a.path.length&&!route(s,a,target))a.action='Waiting for a safe gathering route';return;}
  }
  if(!close(a,target)){if(!a.path.length)route(s,a,target);return;}if(a.path.length)return;
  if(task.phase==='fetch'){
    const item=task.kind==='setup'?'timber':'grain';let quantity=task.quantity??1;
    if(item==='grain'){const others=s.reservations.filter(r=>r.actorId!==a.id&&r.placeId===task.sourceId&&r.item==='grain').reduce((n,r)=>n+r.quantity,0);quantity=Math.min(quantity,Math.max(0,place(s,task.sourceId!)!.stock.grain-others-s.rules.seedReserve));if(quantity<1){finish(s,a);return;}if(quantity!==task.quantity){task.quantity=quantity;s.festival.foodReserved[a.id]=quantity;emit(s,'reservation_revalidated',a.id,{quantity,rule:'seedReserve',rulesRevision:s.rulesRevision},[a.id]);}}
    if(s.emergence&&!s.reservations.some(r=>r.actorId===a.id&&r.placeId===task.sourceId&&r.item===item)&&!reserve(s,a,task.sourceId!,item,quantity)){finish(s,a);return;}
    if(!pickup(s,a,task.sourceId!,item,quantity)){finish(s,a);return;}task.phase=task.kind==='setup'?'work':'deliver';route(s,a,place(s,s.festival.venue)!.position);return;
  }
  if(task.kind==='food'){const quantity=Math.min(task.quantity??1,a.inventory.grain,Math.max(0,s.rules.foodTarget-s.festival.food));if(quantity>0){a.inventory.grain-=quantity;s.festival.food+=quantity;eventAtVenue(s,'festival_food_added',a.id,{quantity,text:`${a.name} brought ${quantity} grain.`});completedInstitutionTask(s,a,'food',quantity);}finish(s,a);return;}
  if(task.kind==='setup'){
    a.action='Setting up the gathering';if(--task.remainingSteps>0)return;if(a.inventory.timber<1){finish(s,a);return;}a.inventory.timber--;s.ledger.consumed.timber++;s.festival.setupDone=true;s.festival.setupOwner=null;eventAtVenue(s,'festival_setup_completed',a.id,{timber:1,text:`${a.name} prepared the gathering place.`});completedInstitutionTask(s,a,'setup',1);finish(s,a);return;
  }
  if(task.kind==='inspect'){
    if(--task.remainingSteps>0)return;if(NPC_IDS.includes(a.id as typeof NPC_IDS[number])){const n=a as Npc;if(task.targetId.startsWith('plot')){const plot=s.plots.find(p=>p.id===task.targetId)!;n.fieldVerified=plot.phase!=='empty'||plot.harvestCount>0;const e=emit(s,'field_inspected',n.id,{plotId:task.targetId,phase:plot.phase,recordedHarvests:plot.harvestCount},[n.id]);remember(s,e,'I inspected the tended field and its recorded harvests.');}else if(task.targetId===s.festival.venue){observedFestival(s,n);const e=emit(s,'festival_inspected',n.id,{food:s.festival.food,setupDone:s.festival.setupDone},[n.id]);remember(s,e,'I checked the gathering’s actual preparations.');}else{const inspected=place(s,task.targetId);if(inspected){const e=emit(s,'place_inspected',n.id,{placeId:inspected.id,stock:copy(inspected.stock)},[n.id]);remember(s,e,`${inspected.name} holds ${inspected.stock.grain} grain, ${inspected.stock.water} water, ${inspected.stock.timber} timber and ${inspected.stock.bread} bread.`);}}}finish(s,a);return;
  }
  if(task.kind==='attend'){a.action=s.festival.phase==='celebrating'?'Enjoying the festival':'Waiting at the gathering';if(a.id!=='player'&&!s.festival.participants.includes(a.id as typeof NPC_IDS[number])){s.festival.participants.push(a.id as typeof NPC_IDS[number]);eventAtVenue(s,'festival_arrival',a.id,{text:`${a.name} arrived of their own accord.`,position:{x:a.x,y:a.y},attendanceSpot:task.attendanceSpot??null});}if(s.festival.phase==='complete')finish(s,a);}
}

function floodStart(s:CozyWorldState){
  s.flood={active:true,startedAt:s.step,expiresAt:s.step+s.rules.flood.durationSteps,ruleRevision:s.rulesRevision,egress:[]};const e=emit(s,'flood_started',null,{zone:'low-path',expiresAt:s.flood.expiresAt,ruleRevision:s.rulesRevision},actors(s).map(a=>a.id));remember(s,e,'The low field path is flooded. Everyone must use a dry route.');
  for(const a of actors(s)){if(inFlood(a)){s.flood.egress.push(a.id);const dry:Point[]=[];for(let y=1;y<23;y++)for(let x=1;x<31;x++)if(isCozyWalkable(s,x,y))dry.push({x,y});dry.sort((x,y)=>distance(a,x)-distance(a,y)||x.y-y.y||x.x-y.x);for(const target of dry){const path=findCozyPath(s,a,target,true);if(path){a.path=path;break;}}a.action='Leaving the flooded path safely';}else if(a.path.some(inFlood)){const target=a.path.at(-1)!;a.path=findCozyPath(s,a,target)??[];}}
}
function floodEnd(s:CozyWorldState,reason:string){s.flood.active=false;s.flood.egress=[];s.flood.expiresAt=null;const e=emit(s,'flood_ended',null,{zone:'low-path',reason},actors(s).map(a=>a.id));remember(s,e,'The low field path is dry and walkable again.');}
function singleStep(s:CozyWorldState){
  s.step++;s.tick=s.step*COZY_STEP_MS/1000;s.day=1+Math.floor((s.tick+8*3600)/86400);
  if(s.flood.active&&s.flood.expiresAt!==null&&s.step>=s.flood.expiresAt)floodEnd(s,'The bounded flood duration elapsed.');
  if(s.step%100===0)for(const n of s.npcs){n.needs.hunger=clamp(n.needs.hunger+1);n.needs.energy=clamp(n.needs.energy-(n.path.length||n.task?1:0));n.needs.social=clamp(n.needs.social+(s.npcs.some(other=>other.id!==n.id&&distance(n,other)<=4)?-2:1));if(distance(n,place(s,n.homeId)!.position)<=1&&!n.path.length&&!n.task)n.needs.energy=clamp(n.needs.energy+5);}
  if(s.step%600===0){const well=place(s,'well')!;if(well.stock.water<12){well.stock.water++;s.ledger.environment.water++;emit(s,'catchment_replenished',null,{placeId:'well',water:1,source:'modeled rainwater catchment',stockCap:12},nearby(s,well.position));}}
  for(const plot of s.plots)if(plot.phase==='growing'&&plot.readyAt!==null&&s.step>=plot.readyAt){plot.phase='ripe';const e=emit(s,'crop_ripened',null,{plotId:plot.id},nearby(s,plot.position));remember(s,e,'The watered wheat is ready to harvest.');}
  if(!s.emergence&&s.rules.organizer==='villagers'&&!s.festival.announced&&s.festival.phase==='planning')announce(s);
  if(s.emergence&&s.step%20===0)updateCooperation(s);
  for(const n of s.npcs)if(n.overrideUntil!==undefined&&s.step>=n.overrideUntil){delete n.overrideUntil;finish(s,n);emit(s,'npc_plan_expired',n.id,{provenance:'deterministic fallback',reason:'The bounded external plan duration elapsed.'},[n.id]);}
  if(s.mind)beforePersonalStep(s,personalRuntime());
  if(s.activities)beforeActivityStep(s,activityRuntime());
  for(const a of actors(s))advanceMovement(s,a);
  if(s.worldObjects?.length)observeWorldObjects(s,personalRuntime());
  witnessPreparations(s);
  for(const a of actors(s))executeTask(s,a);
  if(s.step%20===0)for(const n of s.npcs)chooseNpc(s,n);
  if(['planning','gathering'].includes(s.festival.phase)&&s.festival.food>=s.rules.foodTarget&&s.festival.setupDone){s.festival.phase='gathering';if(s.festival.participants.length>=2){s.festival.phase='celebrating';s.festival.startedAt=s.step;const quantity=s.festival.food;s.festival.food=0;s.ledger.consumed.grain+=quantity;eventAtVenue(s,'festival_started','wren',{quantity,participants:[...s.festival.participants],text:'The villagers gathered around food they really brought.'});}}
  if(s.festival.phase==='celebrating'&&s.festival.startedAt!==null&&s.step-s.festival.startedAt>=100){s.festival.phase='complete';s.festival.completedAt=s.step;eventAtVenue(s,'festival_completed','wren',{participants:[...s.festival.participants],text:'A small festival became a shared memory.'});for(const n of s.npcs)if(s.festival.participants.includes(n.id)){n.affinity=clamp(n.affinity+3);n.trust=clamp(n.trust+1);n.needs.social=0;n.needs.hunger=Math.max(0,n.needs.hunger-35);finish(s,n);}}
  if(s.mind)afterPersonalStep(s,personalRuntime());
}
export function advanceCozyWorld(state:CozyWorldState,steps:number):CozyWorldState{if(state.engineVersion===COZY_ENGINE_VERSION)return v1.advanceCozyWorld(legacy(state),steps);if(state.engineVersion===COZY_V2_ENGINE_VERSION)return v2.advanceCozyWorld(state as unknown as V2State,steps);if(!integer(steps,0,MAX_ADVANCE_STEPS))fail('INVALID_ADVANCE',`Advance0..${MAX_ADVANCE_STEPS} fixed100ms steps.`);const s=copy(state);for(let i=0;i<steps;i++)singleStep(s);s.operations.push({type:'advance',steps});return s;}

export function getRuleCapabilities(){return{schemaVersion:1,fields:{organizer:{type:'enum',values:['player','villagers']},venue:{type:'enum',values:['square','market']},foodTarget:{type:'integer',minimum:2,maximum:6},seedReserve:{type:'integer',minimum:0,maximum:3},flood:{enabled:{type:'boolean'},zone:{type:'enum',values:['low-path']},durationSteps:{type:'integer',minimum:100,maximum:1200}}},semantics:{seedReserve:'Keeps this many grain in the shared bakery from NPC festival collection, and in the player bag from gifts/donations. Planting may use player seeds; NPC-owned gifts remain usable.',venue:'A prepared or announced festival keeps its venue; a changed venue applies to the next festival.',revert:'Prospective rule restoration. Historical undo requires rewind and fork.',flood:'Blocks movement in the authored low-path zone; existing occupants get safe egress. Fixed-step TTL.'}};}
export const cozyCapsHash=()=>hashValue(getRuleCapabilities());
export function validateRulePatch(value:unknown):RulePatch{
  if(!record(value)||Object.keys(value).length===0)fail('INVALID_RULE','Propose at least one implemented rule field.');if(Object.keys(value).some(k=>!['organizer','venue','foodTarget','seedReserve','flood'].includes(k)))fail('UNSUPPORTED_RULE','That rule capability is not implemented.');
  if(value.organizer!==undefined&&!['player','villagers'].includes(value.organizer as string)||value.venue!==undefined&&!['square','market'].includes(value.venue as string)||value.foodTarget!==undefined&&!integer(value.foodTarget,2,6)||value.seedReserve!==undefined&&!integer(value.seedReserve,0,3))fail('INVALID_RULE','A rule value is outside its supported bounds.');
  if(value.flood!==undefined){if(!record(value.flood)||!Object.keys(value.flood).length||Object.keys(value.flood).some(k=>!['enabled','zone','durationSteps'].includes(k))||value.flood.enabled!==undefined&&typeof value.flood.enabled!=='boolean'||value.flood.zone!==undefined&&value.flood.zone!=='low-path'||value.flood.durationSteps!==undefined&&!integer(value.flood.durationSteps,100,1200))fail('INVALID_RULE','Unsupported flood zone, duration or value.');}
  return copy(value) as RulePatch;
}
export function previewRulePatch(s:CozyWorldState,input:RulePatch):RulePreview{
  let patch:RulePatch={};const errors:string[]=[];try{patch=validateRulePatch(input);}catch(e){errors.push((e as Error).message);}
  const next={...copy(s.rules),...patch,flood:{...s.rules.flood,...patch.flood}},changes:RulePreview['changes']=[];
  for(const field of ['organizer','venue','foodTarget','seedReserve'] as const)if(next[field]!==s.rules[field])changes.push({field,from:s.rules[field],to:next[field]});for(const field of ['enabled','zone','durationSteps']as const)if(next.flood[field]!==s.rules.flood[field])changes.push({field:`flood.${field}`,from:s.rules.flood[field],to:next.flood[field]});
  const warnings:string[]=[];if(next.venue!==s.rules.venue&&(s.festival.announced||s.festival.food||s.festival.setupOwner||s.festival.setupDone))warnings.push('Current preparations stay at their actual venue; the new venue applies to the next festival.');if(next.seedReserve>s.player.inventory.grain)warnings.push('Your current grain is below the reserve; gifts and donations will wait, while planting stays allowed.');if(next.flood.enabled)warnings.push('The low path will block both you and villagers. Existing occupants may leave safely; routes can change.');
  return{valid:errors.length===0,errors,expectedRulesRevision:s.rulesRevision,previous:copy(s.rules),next,changes,warnings,capsHash:cozyCapsHash()};
}
function provenance(input:RuleProvenance):RuleProvenance{if(!input||!['manual','meta','fixture','local-qwen'].includes(input.mode)||input.model!==undefined&&(typeof input.model!=='string'||input.model.length>100)||input.sourceText!==undefined&&(typeof input.sourceText!=='string'||input.sourceText.length>2000))fail('INVALID_PROVENANCE','Invalid rule provenance.');return copy(input);}
function setRules(s:CozyWorldState,next:RuleSet,patch:RulePatch,kind:'apply'|'revert',source:RuleProvenance){
  const previous=copy(s.rules);s.rules=copy(next);s.rulesRevision++;s.ruleHistory.push({revision:s.rulesRevision,step:s.step,operationIndex:s.operations.length,originStep:s.origin.checkpointState?(JSON.parse(s.origin.checkpointState) as CozyWorldState).step:0,originHash:hashValue(s.origin),previous,next:copy(next),patch:copy(patch),provenance:source,kind});if(s.ruleHistory.length>64)s.ruleHistory.shift();
  if(!s.festival.announced&&s.festival.food===0&&!s.festival.setupDone&&!s.festival.setupOwner)s.festival.venue=next.venue;
  if(next.organizer==='player'&&previous.organizer==='villagers')for(const n of s.npcs)if(n.task&&['food','setup','invite'].includes(n.task.kind))finish(s,n);
  emit(s,kind==='apply'?'rules_applied':'rules_reverted',null,{previous,next:copy(next),patch:copy(patch),provenance:source},['player']);
  if(next.flood.enabled&&(!previous.flood.enabled||next.flood.durationSteps!==previous.flood.durationSteps||patch.flood?.enabled===true&&!s.flood.active))floodStart(s);else if(!next.flood.enabled&&s.flood.active)floodEnd(s,'The active flood rule was disabled.');
}
export function applyRulePatch(state:CozyWorldState,input:RulePatch,expectedRulesRevision:number,source:RuleProvenance={mode:'manual'},id=`rule-${state.rulesRevision+1}`):CozyWorldState{
  if(state.engineVersion===COZY_ENGINE_VERSION)return v1.applyRulePatch(legacy(state),input,expectedRulesRevision,source,id);
  if(state.engineVersion===COZY_V2_ENGINE_VERSION)return v2.applyRulePatch(state as unknown as V2State,input,expectedRulesRevision,source,id);
  stableId(id);if(seenId(state,id))return state;if(expectedRulesRevision!==state.rulesRevision)fail('STALE_RULES','The world rules changed. Preview the proposal again.');const patch=validateRulePatch(input),preview=previewRulePatch(state,patch);if(!preview.valid)fail('INVALID_RULE',preview.errors.join(' '));const s=copy(state),prov=provenance(source);setRules(s,preview.next,patch,'apply',prov);markId(s,id);s.operations.push({type:'rules',id,patch,expectedRulesRevision,provenance:prov});return s;
}
export function revertRulePatch(state:CozyWorldState,expectedRulesRevision:number,source:RuleProvenance={mode:'manual'},id=`revert-${state.rulesRevision+1}`):CozyWorldState{
  if(state.engineVersion===COZY_ENGINE_VERSION)return v1.revertRulePatch(legacy(state),expectedRulesRevision,source,id);
  if(state.engineVersion===COZY_V2_ENGINE_VERSION)return v2.revertRulePatch(state as unknown as V2State,expectedRulesRevision,source,id);
  stableId(id);if(seenId(state,id))return state;if(expectedRulesRevision!==state.rulesRevision)fail('STALE_RULES','The world rules changed. Refresh before reverting.');const previous=state.ruleHistory.at(-1)?.previous;if(!previous)fail('NO_PREVIOUS_RULE','There is no earlier rule version to restore.');const s=copy(state),prov=provenance(source);setRules(s,previous,previous,'revert',prov);markId(s,id);s.operations.push({type:'revert',id,expectedRulesRevision,provenance:prov});return s;
}

export function projectNpcContext(s:CozyWorldState,id:typeof NPC_IDS[number]):NpcContext{
  if(s.engineVersion===COZY_ENGINE_VERSION)return v1.projectNpcContext(legacy(s),id);
  if(s.engineVersion===COZY_V2_ENGINE_VERSION)return v2.projectNpcContext(s as unknown as V2State,id);
  const n=npc(s,id);if(!n)fail('UNKNOWN_NPC','Unknown villager.');const observation=n.festivalObservation;
  return{step:s.step,npc:{id:n.id,name:n.name,traits:[...n.traits],inventory:copy(n.inventory),trust:n.trust,affinity:n.affinity,position:{x:n.x,y:n.y},needs:copy(n.needs),goals:copy(n.goals)},memories:copy(n.memories.slice(-12)),nearbyActors:actors(s).filter(a=>a.id!==id&&distance(a,n)<=5).map(a=>({id:a.id,position:{x:a.x,y:a.y}})),places:s.places.map(p=>({id:p.id,name:p.name,position:{...p.position},stock:distance(n,p.position)<=2?copy(p.stock):null})),festival:observation?{id:observation.id,venue:observation.venue,phase:observation.phase,food:observation.food,setupDone:observation.setupDone}:null,rules:copy(s.rules),rulesRevision:s.rulesRevision};
}
export function validateNpcPlan(value:unknown,context:NpcContext):NpcPlan{
  if(!record(value)||Object.keys(value).some(k=>!['npcId','action','targetId','quantity','durationSteps','reason','speech','evidenceIds'].includes(k))||value.npcId!==context.npc.id||!['bring-food','set-up','invite','attend','inspect','return-home','wait'].includes(value.action as string)||!integer(value.quantity,0,3)||!integer(value.durationSteps,20,600)||typeof value.reason!=='string'||value.reason.length>180||typeof value.speech!=='string'||value.speech.length>180||!Array.isArray(value.evidenceIds)||value.evidenceIds.length>6||value.evidenceIds.some(id=>!context.memories.some(m=>m.id===id)))fail('INVALID_NPC_PLAN','The plan is outside this villager’s bounded context.');
  const targets=new Set([...context.places.map(p=>p.id),...context.nearbyActors.map(a=>a.id),...COZY_MAP.plots.map(p=>p.id)]);if(value.targetId!==null&&!targets.has(value.targetId as PlaceId))fail('INVALID_NPC_PLAN','Unknown or unseen target.');if(['bring-food','set-up','attend'].includes(value.action as string)&&!context.festival)fail('UNKNOWN_FESTIVAL','This villager has not received a festival request.');if(['bring-food','set-up','invite'].includes(value.action as string)&&context.rules.organizer!=='villagers')fail('RULE_FORBIDS_PLAN','The player is organizing this gathering.');
  if(value.action==='bring-food'&&!integer(value.quantity,1,3)||value.action==='set-up'&&value.quantity!==1||!['bring-food','set-up'].includes(value.action as string)&&value.quantity!==0)fail('INVALID_NPC_PLAN','This action has an invalid material quantity.');
  if(['bring-food','set-up','attend'].includes(value.action as string)&&value.targetId!==null&&value.targetId!==context.festival?.venue)fail('INVALID_NPC_PLAN','A festival task must target the actual known venue.');
  if(value.action==='inspect'&&!context.places.some(p=>p.id===value.targetId)&&!COZY_MAP.plots.some(p=>p.id===value.targetId))fail('INVALID_NPC_PLAN','Inspect a public place or known crop plot.');
  if(value.action==='return-home'&&value.targetId!==null&&value.targetId!==`${context.npc.id}-home`||value.action==='wait'&&value.targetId!==null)fail('INVALID_NPC_PLAN','This action has an invalid target.');
  return copy(value) as NpcPlan;
}
export function applyNpcPlan(state:CozyWorldState,input:NpcPlan,source:RuleProvenance,id=`npc-plan-${state.nextId}`):CozyWorldState{
  if(state.engineVersion===COZY_ENGINE_VERSION)return v1.applyNpcPlan(legacy(state),input,source,id);
  if(state.engineVersion===COZY_V2_ENGINE_VERSION)return v2.applyNpcPlan(state as unknown as V2State,input,source,id);
  stableId(id);if(seenId(state,id))return state;const plan=validateNpcPlan(input,projectNpcContext(state,input.npcId)),s=copy(state),n=npc(s,plan.npcId)!,prov=provenance(source);cancel(s,n);n.overrideUntil=s.step+plan.durationSteps;n.lastDecisionStep=s.step;n.reason=plan.reason;
  if(plan.action==='bring-food'){if(!assignFood(s,n,plan.quantity,prov))fail('NO_USEFUL_TASK','No available grain contribution is needed.');}
  else if(plan.action==='set-up'){if(!assignSetup(s,n,prov))fail('NO_USEFUL_TASK','The setup is already assigned or lacks materials.');}
  else if(plan.action==='invite'){const target=npc(s,plan.targetId??'');if(!target||target.id===n.id)fail('INVALID_NPC_PLAN','Choose another visible villager.');n.task={kind:'invite',targetId:target.id,remainingSteps:0,reason:plan.reason,ruleRevision:s.rulesRevision};route(s,n,rounded(target));}
  else if(plan.action==='attend'){n.festivalAccepted=true;assignAttendance(s,n,plan.reason);}
  else if(plan.action==='inspect'){const target=position(s,plan.targetId??'');if(!target)fail('INVALID_NPC_PLAN','Unknown inspection target.');n.task={kind:'inspect',targetId:plan.targetId!,remainingSteps:5,reason:plan.reason,ruleRevision:s.rulesRevision};route(s,n,target);}
  else if(plan.action==='return-home')route(s,n,place(s,n.homeId)!.position);
  n.reason=plan.reason;if(n.task)n.task.reason=plan.reason;n.action=plan.action.replaceAll('-',' ');if(plan.speech)say(s,n,plan.speech,plan.evidenceIds);emit(s,'npc_plan_applied',n.id,{plan,provenance:prov},[n.id],plan.evidenceIds);markId(s,id);s.nextId++;s.operations.push({type:'npc-plan',id,plan,provenance:prov});return s;
}

export function hashCozyWorld(s:CozyWorldState):string{if(s.engineVersion===COZY_ENGINE_VERSION)return v1.hashCozyWorld(legacy(s));if(s.engineVersion===COZY_V2_ENGINE_VERSION)return v2.hashCozyWorld(s as unknown as V2State);const value={...s} as Partial<CozyWorldState>;delete value.operations;delete value.origin;delete value.events;return hashValue(value);}
export const projectCozyWorld=(s:CozyWorldState)=>copy(s);
export function verifyCozyWorld(s:CozyWorldState):CozyViolation[]{
  if(s.engineVersion===COZY_ENGINE_VERSION)return v1.verifyCozyWorld(legacy(s));
  if(s.engineVersion===COZY_V2_ENGINE_VERSION)return v2.verifyCozyWorld(s as unknown as V2State);
  const errors:CozyViolation[]=[],bad=(code:string,message:string)=>errors.push({code,message});if(s.engineVersion!==COZY_V3_ENGINE_VERSION||s.contentVersion!==COZY_V3_CONTENT_VERSION||!s.emergence||!s.mind||s.version!==1)bad('version','Unsupported cozy version');if(!integer(s.step,0,Number.MAX_SAFE_INTEGER)||s.tick!==s.step/10)bad('clock','Invalid fixed-step clock');if(s.npcs.length!==3||NPC_IDS.some(id=>!npc(s,id))||new Set(s.npcs.map(n=>n.id)).size!==3)bad('census','Three stable cozy villagers are required');
  for(const item of GOODS){let actual=actors(s).reduce((n,a)=>n+a.inventory[item],0)+s.places.reduce((n,p)=>n+p.stock[item],0)+worldObjectGoods(s)[item];if(item==='grain')actual+=s.festival.food;const expected=s.ledger.initial[item]+s.ledger.environment[item]+s.ledger.produced[item]-s.ledger.consumed[item]-s.ledger.waste[item];if(actual!==expected)bad('conservation',`${item}: expected${expected}, held${actual}`);}
  for(const a of actors(s)){if(!Number.isInteger(a.x*4)||!Number.isInteger(a.y*4)||!isCozyWalkable(s,Math.round(a.x),Math.round(a.y),true))bad('position',`${a.id} left solid walkable geometry`);if(GOODS.some(g=>!integer(a.inventory[g],0,10000)))bad('inventory',`${a.id} has an invalid inventory`);if(a.memories.length>32||a.memories.some(m=>!m.id.endsWith(`/m/${a.id}`)||m.step>s.step))bad('memory','Invalid private memory');}
  for(const n of s.npcs)if(Object.values(n.needs).some(v=>!integer(v,0,100))||n.goals.length!==3||n.goals.some(g=>!integer(g.weight,0,100)))bad('needs','Invalid bounded villager needs or goals');
  for(const p of s.places)if(GOODS.some(g=>!integer(p.stock[g],0,10000)))bad('stock','Invalid place stock');for(const p of s.plots){if(p.harvestCount<0||p.phase==='growing'&&(p.readyAt===null||p.wateredAt===null))bad('crop','Invalid crop phase');}
  if(s.ledger.produced.grain!==s.plots.reduce((n,p)=>n+p.harvestCount*4,0))bad('harvest','Harvest output does not match completed crops');
  for(const p of s.places)for(const g of GOODS)if(s.reservations.filter(r=>r.placeId===p.id&&r.item===g).reduce((n,r)=>n+r.quantity,0)>p.stock[g])bad('reservation','A source is over-reserved');
  for(let i=0;i<s.events.length;i++){const event=s.events[i],body={...event} as Partial<CozyEvent>;delete body.hash;if(hashValue(body)!==event.hash||i>0&&event.prevHash!==s.events[i-1].hash)bad('event_hash','Invalid retained event chain');}if(s.events.length&&s.events.at(-1)!.hash!==s.eventHead)bad('event_head','Event head mismatch');
  if(!previewRulePatch(s,s.rules).valid)bad('rules','Invalid active rule set');if(s.festival.food<0||s.festival.food>6||new Set(s.festival.participants).size!==s.festival.participants.length)bad('festival','Invalid festival accounting');if(s.emergence)verifyEmergence(s,bad);if(s.mind)verifyPersonalMind(s,bad);if(s.activities)verifyActivities(s,bad);if(s.worldObjects)verifyWorldObjects(s,bad);return errors;
}

export {initializeCozyWorld,emptyGoods,canonicalStringify};

/** Social state exists only after the explicit version-two upgrade. No model runs in ticks. */
const social=(s:CozyWorldState)=>{if(![COZY_V2_ENGINE_VERSION,COZY_V3_ENGINE_VERSION].includes(s.engineVersion as typeof COZY_V2_ENGINE_VERSION)||!s.emergence)fail('UPGRADE_REQUIRED','Create an explicit cooperative-world fork first.');return s.emergence;};
const goal=(n:Npc,id:'help'|'belong'|'understand')=>n.goals.find(g=>g.id===id)?.weight??0;
const socialHistory=(s:CozyWorldState,event:CozyEvent,g?:Institution)=>{const h=social(s).history;h.push(event.id);if(h.length>64)h.shift();if(g){g.history.push(event.id);if(g.history.length>32)g.history.shift();}};
function socialIntent(s:CozyWorldState,n:Npc){return hashValue({revision:social(s).actors[n.id].intentRevision,task:n.task?{kind:n.task.kind,targetId:n.task.targetId,phase:n.task.phase??null,proposalId:n.task.proposalId??null,institutionId:n.task.institutionId??null}:null,overrideUntil:n.overrideUntil??null});}
function relevantEvidence(n:Npc){const rows=n.memories.filter(m=>['crop_harvested','field_inspected','gift_accepted','social_proposal_delivered','social_proposal_created','social_response','institution_formed','institution_member_joined'].includes(m.type));return [...new Map([...rows.slice(-5),...n.memories.slice(-3)].map(m=>[m.id,m])).values()].slice(-8);}
export function projectInitiativeContext(s:CozyWorldState,id:typeof NPC_IDS[number]):InitiativeContext{
 if(s.engineVersion===COZY_V2_ENGINE_VERSION)return v2.projectInitiativeContext(s as unknown as V2State,id);
 const e=social(s),n=npc(s,id);if(!n)fail('UNKNOWN_NPC','Unknown villager.');const actor=e.actors[id],intentHash=socialIntent(s,n),known=e.proposals.filter(p=>!!p.deliveries[id]).slice(-3);
 const observed=n.festivalObservation?{id:n.festivalObservation.id,venue:n.festivalObservation.venue,phase:n.festivalObservation.phase,food:n.festivalObservation.food,setupDone:n.festivalObservation.setupDone}:null;
 const observations=relevantEvidence(n).map(m=>({...copy(m),text:m.text.slice(0,220)}));
 const triggerKey=`initiative:${id}:${hashValue({intentHash,observations:observations.map(m=>m.id),known:known.map(p=>[p.id,p.responses[id]?.stance??null]),last:actor.lastInitiativeStep}).slice(0,24)}`;
 const busy=!!n.task||!!n.overrideUntil&&n.overrideUntil>s.step;
 const context:InitiativeContext={version:1,npcId:id,step:s.step,triggerKey,intentHash,npc:{name:n.name,traits:[...n.traits],needs:copy(n.needs),goals:copy(n.goals),trust:n.trust,affinity:n.affinity,inventory:copy(n.inventory)},observations,nearbyActors:actors(s).filter(a=>a.id!==id&&distance(a,n)<=5).map(a=>({id:a.id,position:{x:a.x,y:a.y}})),neighbors:s.npcs.filter(other=>other.id!==id).map(other=>({id:other.id,name:other.name,homeId:other.homeId})),observedPlaces:s.places.map(p=>({id:p.id,position:{...p.position},stock:distance(n,p.position)<=2?copy(p.stock):null})),observedFestival:observed,knownProposals:known.map(p=>({id:p.id,authorId:p.authorId,name:p.name,purpose:p.purpose,charter:copy(p.charter),ownResponse:copy(p.responses[id]??null),heardEventId:p.deliveries[id]!.eventId})),institutions:e.institutions.filter(g=>g.members.includes(id)).slice(-2).map(g=>({id:g.id,name:g.name,members:knownPeers(s,g,n),permission:actor.knownPermissions[g.id]?.permission??'pending',status:actor.knownPermissions[g.id]?.permission==='approved'?(observed?.phase==='complete'?'resting':'active'):'waiting-permission'})),capability:{kind:'shared-gathering',venues:observed?[observed.venue]:[],grainTarget:{min:2,max:6},seedFloor:{min:0,max:3}},eligibility:{canPropose:!busy&&!!observed&&e.proposals.length<8&&!e.proposals.some(p=>p.authorId===id&&p.status==='awaiting-responses')&&!e.institutions.some(g=>g.members.includes(id)&&g.status!=='resting'),canShare:!busy&&known.some(p=>p.authorId===id&&NPC_IDS.some(other=>!p.deliveries[other])),nextEligibleStep:actor.lastInitiativeStep+300}};
 while(new TextEncoder().encode(JSON.stringify(context)).length>7800&&context.observations.length)context.observations.shift();
 if(new TextEncoder().encode(JSON.stringify(context)).length>8000)fail('CONTEXT_LIMIT','This initiative context exceeded its bounded projection.');return copy(context);
}
export function selectInitiativeOpportunity(s:CozyWorldState,options:{excludeNpcIds?:typeof NPC_IDS[number][]}={}):InitiativeOpportunity|null{
 if(s.engineVersion===COZY_V2_ENGINE_VERSION)return v2.selectInitiativeOpportunity(s as unknown as V2State,options);
 if(!s.emergence)return null;const candidates=s.npcs.filter(n=>!options.excludeNpcIds?.includes(n.id)&&s.step>=s.emergence!.actors[n.id].lastInitiativeStep+300&&!n.task&&!(n.overrideUntil&&n.overrideUntil>s.step)).sort((a,b)=>s.emergence!.actors[a.id].lastInitiativeStep-s.emergence!.actors[b.id].lastInitiativeStep||NPC_IDS.indexOf(a.id)-NPC_IDS.indexOf(b.id));
 const opportunities=candidates.map(n=>{const context=projectInitiativeContext(s,n.id);return{npcId:n.id,triggerKey:context.triggerKey,intentHash:context.intentHash,context};});opportunities.sort((a,b)=>Number(b.context.eligibility.canShare)*3+Number(b.context.eligibility.canPropose)*2-(Number(a.context.eligibility.canShare)*3+Number(a.context.eligibility.canPropose)*2)||s.emergence!.actors[a.npcId].lastInitiativeStep-s.emergence!.actors[b.npcId].lastInitiativeStep||NPC_IDS.indexOf(a.npcId)-NPC_IDS.indexOf(b.npcId));return opportunities[0]??null;
}
export function validateSocialInitiative(value:unknown,context:InitiativeContext):SocialInitiativeDecision{
 const fields=['npcId','triggerKey','intentHash','action','proposalId','targetId','name','purpose','charter','reason','evidenceIds'];
 if(!record(value)||Object.keys(value).length!==fields.length||Object.keys(value).some(k=>!fields.includes(k))||value.npcId!==context.npcId||value.triggerKey!==context.triggerKey||value.intentHash!==context.intentHash||!['propose','share','wait','inspect'].includes(value.action as string)||typeof value.reason!=='string'||!value.reason.trim()||value.reason.length>180||!Array.isArray(value.evidenceIds)||value.evidenceIds.length>6||new Set(value.evidenceIds).size!==value.evidenceIds.length||value.evidenceIds.some(id=>typeof id!=='string'||!context.observations.some(m=>m.id===id)))fail('INVALID_INITIATIVE','The initiative is outside this villager’s frozen, received context.');
 const d=value as unknown as SocialInitiativeDecision;
 if(d.action==='propose'){
  if(!context.eligibility.canPropose||d.proposalId!==null||!NPC_IDS.includes(d.targetId as typeof NPC_IDS[number])||d.targetId===d.npcId||typeof d.name!=='string'||d.name.trim().length<3||d.name.length>48||typeof d.purpose!=='string'||d.purpose.trim().length<3||d.purpose.length>180||!record(d.charter)||Object.keys(d.charter).sort().join(',')!=='grainTarget,seedFloor,venue'||!context.capability.venues.includes(d.charter.venue)||!integer(d.charter.grainTarget,2,6)||!integer(d.charter.seedFloor,0,3))fail('INVALID_CHARTER','A charter must name one observed gathering venue and finite supported practices.');
 }else{
  if(d.name!==null||d.purpose!==null||d.charter!==null)fail('INVALID_INITIATIVE','Only a new charter may contain a name, purpose or charter.');
  if(d.action==='share'){const p=context.knownProposals.find(p=>p.id===d.proposalId);if(!context.eligibility.canShare||!p||p.authorId!==d.npcId||!NPC_IDS.includes(d.targetId as typeof NPC_IDS[number])||d.targetId===d.npcId)fail('UNHEARD_PROPOSAL','Only the author can carry a received charter to another known neighbor.');}
  else if(d.action==='inspect'){if(d.proposalId!==null||typeof d.targetId!=='string'||!context.observedPlaces.some(p=>p.id===d.targetId)&&!COZY_MAP.plots.some(p=>p.id===d.targetId))fail('INVALID_INITIATIVE','Inspect one existing known place or plot.');}
  else if(d.proposalId!==null||d.targetId!==null)fail('INVALID_INITIATIVE','Waiting has no target or proposal.');
 }
 return copy(d);
}
function evaluateResponse(s:CozyWorldState,p:SocialProposal,n:Npc):Omit<SocialResponse,'eventId'|'decidedStep'|'provenance'>{
 const heard=p.deliveries[n.id];if(!heard)fail('UNHEARD_PROPOSAL','No social response is possible before delivery.');const conditions:SocialResponse['conditions']=[],proof=n.memories.filter(m=>m.type==='crop_harvested'||m.type==='field_inspected'&&(m.facts?.harvestCount??0)>0),evidence=[heard.eventId,...proof.slice(-2).map(m=>m.id)];
 const score=Math.round(goal(n,'help')*.45+goal(n,'belong')*.35+n.trust*.2-p.charter.grainTarget*4);
 if(n.trust<25)return{stance:'decline',conditions:['trust'],reason:'I do not yet trust this shared commitment enough to promise work.',evidenceIds:evidence};
 if(n.needs.hunger>=85)conditions.push('needs-food');if(n.needs.energy<25)conditions.push('needs-rest');
 if(goal(n,'understand')>=75&&!proof.length)conditions.push('witness-harvest');
 if(goal(n,'understand')>=75&&p.charter.seedFloor<1)conditions.push('protect-seeds');
 if(conditions.length)return{stance:'conditional',conditions,reason:conditions.includes('witness-harvest')?'I want to inspect or witness a real harvest before committing.':conditions.includes('protect-seeds')?'This proposal must protect the seed grain before I will join.':'I need to meet my own food or rest needs before taking on shared work.',evidenceIds:evidence};
 if(score<35)return{stance:'decline',conditions:[],reason:'The requested contribution costs more than this commitment currently means to me.',evidenceIds:evidence};
 return{stance:'join',conditions:[],reason:`This fits my goals and available effort (commitment score ${score}); I choose to help.`,evidenceIds:evidence};
}
function recordResponse(s:CozyWorldState,p:SocialProposal,n:Npc){
 const value=evaluateResponse(s,p,n),old=p.responses[n.id];if(old&&old.stance===value.stance&&old.conditions.join()===value.conditions.join()&&old.evidenceIds.join()===value.evidenceIds.join())return;
 const event=emit(s,'social_response',n.id,{proposalId:p.id,...value,policy:'deterministic-policy',inputs:{needs:copy(n.needs),goals:copy(n.goals),trust:n.trust}},nearby(s,n,3),value.evidenceIds);p.responses[n.id]={...value,decidedStep:s.step,eventId:event.id,provenance:'deterministic-policy'};n.reason=value.reason;remember(s,event,`${n.name} ${value.stance==='join'?'chose to join':value.stance==='conditional'?'set conditions on':'declined'} ${p.name}: ${value.reason}`);socialHistory(s,event);
}
function deliverProposal(s:CozyWorldState,p:SocialProposal,from:ActorId,n:Npc){
 if(p.deliveries[n.id])return;const carrier=npc(s,from),knownMemberIds=NPC_IDS.filter(id=>p.responses[id]?.stance==='join'&&(id===from||carrier?.memories.some(m=>m.type==='social_response'&&m.actorId===id&&m.text.includes('chose to join'))));const event=emit(s,'social_proposal_delivered',from,{proposalId:p.id,npcId:n.id,name:p.name,purpose:p.purpose,charter:copy(p.charter),text:`${p.name}: ${p.purpose}`},[from,n.id],p.sourceIds);p.deliveries[n.id]={step:s.step,eventId:event.id,sourceId:from,knownMemberIds};const actor=social(s).actors[n.id];actor.heardProposalIds.push(p.id);actor.heardProposalIds=actor.heardProposalIds.slice(-8);remember(s,event,`${n.name} received ${p.authorId}’s proposal “${p.name}”: ${p.purpose}`);socialHistory(s,event);recordResponse(s,p,n);
}
function formation(s:CozyWorldState,p:SocialProposal){
 const e=social(s),willing=NPC_IDS.filter(id=>p.responses[id]?.stance==='join');if(willing.length<2)return;
 let g=e.institutions.find(g=>g.id===p.institutionId);
 if(!g){if(e.institutions.length>=3)return;const same=s.rules.organizer==='villagers'&&s.rules.foodTarget===p.charter.grainTarget&&s.rules.seedReserve===p.charter.seedFloor&&s.festival.venue===p.charter.venue;
  g={id:`institution-${s.nextId++}`,proposalId:p.id,name:p.name,purpose:p.purpose,founderId:p.authorId,leaderId:willing.includes(p.authorId)?p.authorId:willing[0],members:[...willing],formedStep:s.step,status:same?'active':'waiting-permission',permission:same?'approved':'pending',practices:[{kind:'contribute-grain',resource:'grain',quantity:p.charter.grainTarget},{kind:'prepare-venue',resource:'timber',quantity:1},{kind:'invite-neighbor',resource:null,quantity:1}],resourceAccount:{kind:'festival',festivalId:s.festival.id,venue:p.charter.venue,grainTarget:p.charter.grainTarget,seedFloor:p.charter.seedFloor},history:[]};e.institutions.push(g);p.institutionId=g.id;p.status='formed';const event=emit(s,'institution_formed',p.authorId,{institutionId:g.id,proposalId:p.id,name:g.name,members:[...g.members],knownMemberIds:[...g.members],permission:g.permission,capability:'shared-gathering'},nearby(s,npc(s,p.authorId)!,5),willing.map(id=>p.responses[id]!.eventId));remember(s,event,`${g.name} formed because ${willing.map(id=>npc(s,id)!.name).join(' and ')} independently agreed.`);socialHistory(s,event,g);
 }else for(const id of willing)if(!g.members.includes(id)){g.members.push(id);const event=emit(s,'institution_member_joined',id,{institutionId:g.id,proposalId:p.id,members:[...g.members],knownMemberIds:[id,...(p.deliveries[id]?.knownMemberIds??[])]},nearby(s,npc(s,id)!,3),[p.responses[id]!.eventId]);remember(s,event,`${npc(s,id)!.name} joined ${g.name} after meeting their conditions.`);socialHistory(s,event,g);}
}
function assignCommunication(s:CozyWorldState,n:Npc,p:SocialProposal,targetId:typeof NPC_IDS[number]){
 n.task={kind:'communicate',targetId,proposalId:p.id,remainingSteps:0,reason:`Carry ${p.name} to ${npc(s,targetId)!.name} in person.`,ruleRevision:s.rulesRevision,searchIndex:0,expiresAt:s.step+1200};n.action='Carrying a proposal to a neighbor';n.path=[];seekPerson(s,n,n.task,npc(s,targetId)!);
}
/** Search public places when a recipient is out of sight; never route to a hidden live position. */
function seekPerson(s:CozyWorldState,a:Actor,task:NonNullable<Actor['task']>,target:Npc){
 if(distance(a,target)<=5){const last=a.path.at(-1),where=rounded(target);if(s.step%10===0||!last||distance(last,where)!==0)route(s,a,where);return;}
 if(a.path.length)return;const waypoints=[place(s,target.homeId)!.position,place(s,'square')!.position,place(s,'bakery')!.position,...s.plots.map(p=>p.position)];let index=task.searchIndex??0;if(close(a,waypoints[index%waypoints.length]))index++;task.searchIndex=index;route(s,a,waypoints[index%waypoints.length]);
}
function executeCommunication(s:CozyWorldState,a:Actor,task:NonNullable<Actor['task']>){
 const p=social(s).proposals.find(p=>p.id===task.proposalId),target=npc(s,task.targetId);if(!p||!target||a.id!==p.authorId||p.deliveries[target.id]){finish(s,a);return;}
 if(task.expiresAt!==undefined&&s.step>=task.expiresAt){const event=emit(s,'social_delivery_unfinished',a.id,{proposalId:p.id,targetId:target.id,reason:'The bounded search ended without a conversation.'},[a.id]);socialHistory(s,event);finish(s,a);return;}
 if(close(a,target)){deliverProposal(s,p,a.id,target);formation(s,p);const response=p.responses[target.id]!;say(s,target,s.mind&&response.stance==='join'?'I can help with that.':s.mind&&response.stance==='decline'?'I am not ready to take that on.':response.reason,[response.eventId]);finish(s,a);return;}seekPerson(s,a,task,target);
}
function knownPeers(s:CozyWorldState,g:Institution,n:Npc):typeof NPC_IDS[number][]{const p=social(s).proposals.find(p=>p.id===g.proposalId),ids=new Set<typeof NPC_IDS[number]>([n.id,...(p?.deliveries[n.id]?.knownMemberIds??[])]);for(const m of n.memories){if(m.facts?.institutionId===g.id)for(const id of m.facts.memberIds??[])ids.add(id);if(m.type==='social_response'&&m.actorId!=='player'&&m.actorId&&m.text.includes('chose to join'))ids.add(m.actorId);}return NPC_IDS.filter(id=>ids.has(id)&&g.members.includes(id));}
function commitInstitutionTask(s:CozyWorldState,n:Npc,g:Institution){if(!n.task)return;n.task.institutionId=g.id;const event=emit(s,'institution_task_committed',n.id,{institutionId:g.id,proposalId:g.proposalId,kind:n.task.kind,quantity:n.task.quantity??1,reason:n.task.reason},[n.id],[social(s).proposals.find(p=>p.id===g.proposalId)!.responses[n.id]!.eventId]);remember(s,event,`${n.name} chose ${n.task.kind} work for ${g.name}.`);socialHistory(s,event,g);}
function completedInstitutionTask(s:CozyWorldState,a:Actor,kind:string,quantity:number){const g=s.emergence?.institutions.find(g=>g.id===a.task?.institutionId);if(!g)return;const event=emit(s,'institution_task_completed',a.id,{institutionId:g.id,kind,quantity,festivalId:s.festival.id,physical:true},nearby(s,a));remember(s,event,`${a.name} completed real ${kind} work for ${g.name}.`);socialHistory(s,event,g);}
function chooseCooperativeNpc(s:CozyWorldState,n:Npc){
 if(n.task||n.path.length)return;const e=social(s);
 const own=e.proposals.find(p=>p.authorId===n.id&&NPC_IDS.some(id=>!p.deliveries[id]));if(own){const recipient=NPC_IDS.filter(id=>!own.deliveries[id]).sort((a,b)=>distance(n,place(s,npc(s,a)!.homeId)!.position)-distance(n,place(s,npc(s,b)!.homeId)!.position)||NPC_IDS.indexOf(a)-NPC_IDS.indexOf(b))[0];if(recipient){assignCommunication(s,n,own,recipient);return;}}
 const conditional=e.proposals.find(p=>p.responses[n.id]?.stance==='conditional'&&p.responses[n.id]!.conditions.includes('witness-harvest'));const lastInspection=n.memories.filter(m=>m.type==='field_inspected').at(-1);if(conditional&&(!lastInspection||s.step-lastInspection.step>=300||n.memories.some(m=>['crop_harvested','crop_planted','crop_ripened'].includes(m.type)&&m.step>lastInspection.step))){const target=s.plots.find(p=>p.harvestCount>0&&distance(n,p.position)<=5)??s.plots[0];n.task={kind:'inspect',targetId:target.id,remainingSteps:5,reason:'Look for actual harvest evidence before deciding.',ruleRevision:s.rulesRevision};n.action='Checking the growing field';route(s,n,target.position);return;}
 const membership=e.institutions.find(g=>g.members.includes(n.id));if(membership&&e.actors[n.id].knownPermissions[membership.id]?.permission!=='approved'){n.action='Checking the posted association charter';n.reason='I need to see whether the shared practices have permission.';route(s,n,place(s,membership.resourceAccount.venue)!.position);return;}
 const group=e.institutions.find(g=>g.members.includes(n.id)&&e.actors[n.id].knownPermissions[g.id]?.permission==='approved'&&g.permission==='approved'&&s.rules.organizer==='villagers'&&g.status!=='waiting-permission');
 if(group&&s.festival.phase!=='complete'){
  const foodOpen=s.rules.foodTarget>s.festival.food+s.npcs.filter(o=>o.task?.kind==='food').reduce((sum,o)=>sum+(o.task!.quantity??1),0),target=s.npcs.find(o=>o.id!==n.id&&knownPeers(s,group,n).includes(o.id)&&!s.festival.invitations[o.id]);
  const options=[{kind:'food',score:goal(n,'help')+n.inventory.grain*8,ready:foodOpen,assign:()=>assignFood(s,n)},{kind:'setup',score:goal(n,'understand')+n.inventory.timber*8,ready:!s.festival.setupDone&&!s.festival.setupOwner,assign:()=>assignSetup(s,n)},{kind:'invite',score:goal(n,'belong')+n.needs.social/2,ready:!!target,assign:()=>{if(!target)return false;n.task={kind:'invite',targetId:target.id,remainingSteps:0,reason:'I want another member to hear the invitation in person.',ruleRevision:s.rulesRevision,searchIndex:0};n.action='Inviting a fellow member';seekPerson(s,n,n.task,target);return true;}}].filter(o=>o.ready).sort((a,b)=>b.score-a.score||a.kind.localeCompare(b.kind));
  for(const option of options)if(option.assign()){commitInstitutionTask(s,n,group);return;}
  if(n.festivalObservation?.setupDone&&(n.festivalObservation.food>=s.rules.foodTarget||s.festival.phase==='celebrating')){n.festivalAccepted=true;assignAttendance(s,n,'I chose this association and saw the preparations.');return;}
  n.task={kind:'inspect',targetId:s.festival.venue,remainingSteps:5,reason:'Check what our shared work actually accomplished.',ruleRevision:s.rulesRevision};n.action='Checking our gathering place';route(s,n,place(s,s.festival.venue)!.position);return;
 }
 const hour=(8+s.tick/3600)%24;const preference=[...n.goals].sort((a,b)=>b.weight-a.weight||a.id.localeCompare(b.id))[0]?.id;
 const target=hour>=20||hour<6?place(s,n.homeId)!.position:preference==='understand'?{x:s.plots[0].position.x,y:s.plots[0].position.y+1}:preference==='belong'?place(s,'square')!.position:place(s,'bakery')!.position;n.action=hour>=20||hour<6?'Heading home':'Following a familiar routine';route(s,n,target);
}
function updateCooperation(s:CozyWorldState){
 const e=social(s);for(const p of e.proposals){for(const id of NPC_IDS)if(p.deliveries[id]&&p.responses[id]?.stance==='conditional')recordResponse(s,p,npc(s,id)!);formation(s,p);if(!p.institutionId&&NPC_IDS.every(id=>!!p.deliveries[id])&&NPC_IDS.every(id=>p.responses[id]?.stance==='decline'))p.status='declined';}
 for(const g of e.institutions){const notice=g.history.map(id=>s.events.find(event=>event.id===id)).filter((event):event is CozyEvent=>!!event&&event.type==='institution_permission_decided').at(-1);if(notice)for(const member of g.members){const n=npc(s,member)!,known=e.actors[member].knownPermissions[g.id];if(distance(n,place(s,g.resourceAccount.venue)!.position)<=4&&known?.eventId!==notice.id){const event=emit(s,'institution_permission_observed',member,{institutionId:g.id,permission:g.permission,noticeId:notice.id},[member],[notice.id]);remember(s,event,`I read the posted permission for ${g.name}: ${g.permission}.`);e.actors[member].knownPermissions[g.id]={permission:g.permission,eventId:notice.id,step:s.step};socialHistory(s,event,g);}}g.resourceAccount.festivalId=s.festival.id;const compatible=s.rules.organizer==='villagers'&&s.rules.foodTarget===g.resourceAccount.grainTarget&&s.rules.seedReserve===g.resourceAccount.seedFloor&&s.festival.venue===g.resourceAccount.venue;
  if(g.permission!=='approved'||!compatible){g.status='waiting-permission';continue;}if(s.festival.phase==='complete'){g.status='resting';continue;}
  const grain=s.festival.food+Math.max(0,place(s,'bakery')!.stock.grain-s.rules.seedReserve)+s.npcs.filter(n=>g.members.includes(n.id)).reduce((q,n)=>q+n.inventory.grain,0),timber=place(s,'woodpile')!.stock.timber+s.npcs.filter(n=>g.members.includes(n.id)).reduce((q,n)=>q+n.inventory.timber,0);g.status=grain<s.rules.foodTarget||!s.festival.setupDone&&timber<1?'waiting-resources':'active';
 }
}
export function applySocialInitiative(state:CozyWorldState,input:SocialInitiativeDecision,source:RuleProvenance,id:string):CozyWorldState{
 if(state.engineVersion===COZY_V2_ENGINE_VERSION)return v2.applySocialInitiative(state as unknown as V2State,input,source,id);
 social(state);stableId(id);if(seenId(state,id))return state;const n=npc(state,input?.npcId);if(!n)fail('UNKNOWN_NPC','Unknown initiative author.');if(input.intentHash!==socialIntent(state,n))fail('INITIATIVE_STALE','This actor has accepted a different intent; the frozen initiative cannot replace it.');
 const context=projectInitiativeContext(state,n.id);context.triggerKey=input.triggerKey;context.intentHash=input.intentHash;context.observations=copy(n.memories);const decision=validateSocialInitiative(input,context);if(state.step<context.eligibility.nextEligibleStep)fail('INITIATIVE_COOLDOWN','This villager needs time before another initiative.');const s=copy(state),actor=npc(s,n.id)!,e=social(s),meta=e.actors[n.id],prov=provenance(source);meta.lastInitiativeStep=s.step;meta.initiativeCount++;meta.intentRevision++;
 if(decision.action==='propose'){
  if(e.proposals.length>=8)fail('PROPOSAL_LIMIT','This bounded experiment retains at most eight charters.');const p:SocialProposal={id:`proposal-${s.nextId++}`,kind:'cooperative-charter',capability:'shared-gathering',authorId:n.id,name:decision.name!.trim(),purpose:decision.purpose!.trim(),charter:copy(decision.charter!),createdStep:s.step,revision:1,status:'awaiting-responses',deliveries:{},responses:{},institutionId:null,provenance:prov,sourceIds:[...decision.evidenceIds]};e.proposals.push(p);const event=emit(s,'social_proposal_created',n.id,{proposalId:p.id,name:p.name,purpose:p.purpose,charter:p.charter,capability:p.capability,provenance:prov,reason:decision.reason},[n.id],decision.evidenceIds);remember(s,event,`I proposed ${p.name}: ${p.purpose}`);socialHistory(s,event);p.sourceIds=[event.id,...p.sourceIds];deliverProposal(s,p,n.id,actor);cancel(s,actor);assignCommunication(s,actor,p,decision.targetId as typeof NPC_IDS[number]);
 }else if(decision.action==='share'){const p=e.proposals.find(p=>p.id===decision.proposalId)!;if(p.deliveries[decision.targetId as typeof NPC_IDS[number]])fail('ALREADY_HEARD','That neighbor already received this charter.');cancel(s,actor);assignCommunication(s,actor,p,decision.targetId as typeof NPC_IDS[number]);}
 else if(decision.action==='inspect'){cancel(s,actor);actor.task={kind:'inspect',targetId:decision.targetId!,remainingSteps:5,reason:decision.reason,ruleRevision:s.rulesRevision};actor.action='Looking for evidence';route(s,actor,position(s,decision.targetId!)!);}
 else{const event=emit(s,'initiative_waited',n.id,{reason:decision.reason,provenance:prov},[n.id],decision.evidenceIds);remember(s,event,`I chose to wait: ${decision.reason}`);socialHistory(s,event);}
 markId(s,id);s.operations.push({type:'social-initiative',id,decision,provenance:prov});return s;
}
export function previewSocialProposalPermission(s:CozyWorldState,proposalId:string):RulePreview{
 const e=social(s),p=e.proposals.find(p=>p.id===proposalId);if(!p||!p.institutionId)fail('NO_INSTITUTION','At least two independent members must agree before owner permission is requested.');return previewRulePatch(s,{organizer:'villagers',venue:p.charter.venue,foodTarget:p.charter.grainTarget,seedReserve:p.charter.seedFloor});
}
export function decideSocialProposal(state:CozyWorldState,proposalId:string,decision:'approve'|'decline',id:string):CozyWorldState{
 if(state.engineVersion===COZY_V2_ENGINE_VERSION)return v2.decideSocialProposal(state as unknown as V2State,proposalId,decision,id);
 social(state);stableId(id);if(seenId(state,id))return state;if(!['approve','decline'].includes(decision))fail('INVALID_PERMISSION','Choose approve or decline.');const preview=previewSocialProposalPermission(state,proposalId);if(!preview.valid)fail('INVALID_PERMISSION',preview.errors.join(' '));const s=copy(state),p=social(s).proposals.find(p=>p.id===proposalId)!,g=social(s).institutions.find(g=>g.id===p.institutionId)!;
 if(decision==='approve'){setRules(s,preview.next,{organizer:'villagers',venue:p.charter.venue,foodTarget:p.charter.grainTarget,seedReserve:p.charter.seedFloor},'apply',{mode:'manual',sourceText:`Owner approved the finite practices of ${g.name}.`});g.permission='approved';g.status='active';}
 else{g.permission='declined';g.status='waiting-permission';}
 const event=emit(s,'institution_permission_decided','player',{proposalId:p.id,institutionId:g.id,decision,actualRuleChanges:decision==='approve'?preview.changes:[],text:decision==='approve'?`You approved ${g.name}'s shared practices.`:`You declined permission. ${g.name} remains an association without authority to spend shared supplies.`},[...new Set<ActorId>(['player',...nearby(s,place(s,g.resourceAccount.venue)!.position,4)])],[...g.history.slice(-1)]);for(const member of g.members)if(event.audience.includes(member))social(s).actors[member].knownPermissions[g.id]={permission:g.permission,eventId:event.id,step:s.step};remember(s,event,String(event.payload.text));socialHistory(s,event,g);markId(s,id);s.operations.push({type:'social-owner-decision',id,proposalId,decision});return s;
}
function verifyEmergence(s:CozyWorldState,bad:(code:string,message:string)=>void){
 const e=s.emergence!;if(e.version!==1||e.proposals.length>8||e.institutions.length>3||e.history.length>64)bad('social_bounds','Invalid bounded social state');const proposals=new Set(e.proposals.map(p=>p.id)),groups=new Set(e.institutions.map(g=>g.id));if(proposals.size!==e.proposals.length||groups.size!==e.institutions.length)bad('social_ids','Social identities must be unique');
 for(const id of NPC_IDS){const a=e.actors[id];if(!a||!integer(a.initiativeCount,0,10000)||!integer(a.intentRevision,0,10000)||a.lastInitiativeStep>s.step||a.heardProposalIds.length>8||a.heardProposalIds.some(p=>!proposals.has(p)))bad('social_actor','Invalid actor initiative state');}
 for(const p of e.proposals){if(p.kind!=='cooperative-charter'||p.capability!=='shared-gathering'||!NPC_IDS.includes(p.authorId)||!integer(p.charter.grainTarget,2,6)||!integer(p.charter.seedFloor,0,3)||!['square','market'].includes(p.charter.venue)||p.createdStep>s.step||p.name.length>48||p.purpose.length>180||p.institutionId&&!groups.has(p.institutionId))bad('social_proposal','Invalid cooperative charter');for(const id of NPC_IDS){const delivery=p.deliveries[id],response=p.responses[id];if(response&&!delivery||delivery&&delivery.step>s.step||response&&(response.decidedStep<delivery!.step||response.decidedStep>s.step||response.evidenceIds.length>6||!response.evidenceIds.includes(delivery!.eventId)))bad('social_knowledge','A response must follow actual received evidence');}}
 for(const g of e.institutions){const p=e.proposals.find(p=>p.id===g.proposalId);if(!p||g.members.length<2||new Set(g.members).size!==g.members.length||g.members.some(id=>!NPC_IDS.includes(id)||p.responses[id]?.stance!=='join')||!g.members.includes(g.leaderId)||g.resourceAccount.kind!=='festival'||g.history.length>32||g.formedStep>s.step)bad('institution','Invalid persisted association');}
}

function personalRuntime():PersonalRuntime{return{emit,remember,route,cancel,pickup,chooseCooperativeNpc};}
export function applyPersonalDecision(state:CozyWorldState,decision:PersonalDecision,source:RuleProvenance,id:string):CozyWorldState{const result=applyPersonalDecisionInternal(state,decision,source,id,personalRuntime());return decision.action==='compose'&&decision.program?applyActivityProposalInternal(result,decision.program,source,id+':activity',activityRuntime(),false):result;}
function activityRuntime():ActivityRuntime{return{emit,remember,route,cancel,pickup};}
export function applyActivityProposal(state:CozyWorldState,program:ActivityBlueprint,source:RuleProvenance,id:string):CozyWorldState{return applyActivityProposalInternal(state,program,source,id,activityRuntime());}
