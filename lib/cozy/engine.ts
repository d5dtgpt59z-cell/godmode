import {hashValue,canonicalStringify} from '../sim/canonical';
import {COZY_MAP,distance,emptyGoods,festivalAttendanceSpot,inFlood,initializeCozyWorld,isCozyWalkable,newFestival} from './world';
import {COZY_ENGINE_VERSION,COZY_CONTENT_VERSION,COZY_STEP_MS,MAX_ADVANCE_STEPS,NPC_IDS,CozyError,type Actor,type ActorId,type CozyCommand,type CozyEvent,type CozyWorldState,type CozyViolation,type Good,type Npc,type NpcContext,type NpcPlan,type PlaceId,type Point,type RulePatch,type RulePreview,type RuleProvenance,type RuleSet} from './contracts';

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
function remember(s:CozyWorldState,event:CozyEvent,text:string){for(const a of actors(s).filter(a=>event.audience.includes(a.id))){a.memories.push({id:`${event.id}/m/${a.id}`,step:s.step,type:event.type,text,sourceIds:[event.id,...event.sourceIds],actorId:event.actorId});if(a.memories.length>32){const receipt=a.memories.find(m=>m.type==='crop_harvested');a.memories=a.memories.slice(-31);if(receipt&&!a.memories.some(m=>m.id===receipt.id))a.memories.unshift(receipt);}}}
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
  const command=validateCozyCommand(input);if(seenId(state,command.id))return state;const s=copy(state),p=s.player;
  if(command.type==='move'){if(!route(s,p,command.target))fail('PATH_BLOCKED','That tile cannot be reached.');if(p.task){release(s,p);p.task=null;}p.action=p.path.length?'Walking':'Here we are';}
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
  markId(s,command.id);s.operations.push({type:'command',command});emit(s,'player_command','player',{command},['player']);return s;
}

function invite(s:CozyWorldState,source:ActorId,n:Npc){if(s.festival.invitations[n.id])return;s.festival.invitations[n.id]={source,step:s.step};observedFestival(s,n);const e=emit(s,'festival_invitation',source,{npcId:n.id,festivalId:s.festival.id,venue:s.festival.venue},[source,n.id]);remember(s,e,`${source==='player'?'You':source} invited ${n.name} to the gathering.`);}
function announce(s:CozyWorldState){s.festival.announced=true;const e=emit(s,'festival_notice_posted','wren',{festivalId:s.festival.id,venue:s.festival.venue,foodTarget:s.rules.foodTarget,source:'Public gathering request',provenance:'deterministic rule policy'},[...NPC_IDS]);remember(s,e,'The village notice asks for food, a prepared space and invitations. Each villager chooses whether to help.');for(const n of s.npcs)observedFestival(s,n);}
function bid(s:CozyWorldState,n:Npc,kind:'food'|'setup'|'invite',source?:RuleProvenance){const e=emit(s,'festival_bid',n.id,{kind,reason:n.reason,provenance:source??'deterministic rule policy'},[n.id]);remember(s,e,`${n.name} chose to help with ${kind}.`);}
function assignFood(s:CozyWorldState,n:Npc,wanted=3,source?:RuleProvenance):boolean{
  const remaining=s.rules.foodTarget-s.festival.food-Object.values(s.festival.foodReserved).reduce((a,b)=>a+(b??0),0);if(remaining<=0)return false;
  const held=Math.min(wanted,remaining,n.inventory.grain),quantity=held||Math.min(wanted,remaining,Math.max(0,available(s,'bakery','grain')-s.rules.seedReserve));if(quantity<1)return false;
  if(!held&&!reserve(s,n,'bakery','grain',quantity))return false;s.festival.foodReserved[n.id]=quantity;n.reason='I can contribute actual grain to our shared table.';n.task={kind:'food',targetId:s.festival.venue,remainingSteps:0,reason:n.reason,ruleRevision:s.rulesRevision,quantity,sourceId:'bakery',phase:held?'deliver':'fetch'};n.action=held?'Bringing grain to the gathering':'Fetching reserved grain';route(s,n,place(s,held?s.festival.venue:'bakery')!.position);bid(s,n,'food',source);return true;
}
function assignSetup(s:CozyWorldState,n:Npc,source?:RuleProvenance):boolean{
  if(s.festival.setupDone||s.festival.setupOwner)return false;const held=n.inventory.timber>0;if(!held&&!reserve(s,n,'woodpile','timber',1))return false;
  s.festival.setupOwner=n.id;n.reason='A gathering needs a real, prepared place.';n.task={kind:'setup',targetId:s.festival.venue,remainingSteps:30,reason:n.reason,ruleRevision:s.rulesRevision,sourceId:'woodpile',phase:held?'work':'fetch'};n.action='Preparing the gathering';route(s,n,place(s,held?s.festival.venue:'woodpile')!.position);bid(s,n,'setup',source);return true;
}
function assignAttendance(s:CozyWorldState,n:Npc,reason:string){
  const target=festivalAttendanceSpot(s,n.id,s.festival.venue);
  n.task={kind:'attend',targetId:s.festival.venue,remainingSteps:0,reason,ruleRevision:s.rulesRevision,...(target?{attendanceSpot:target}:{})};n.path=[];n.action='Going to the gathering';
  if(!target||!route(s,n,target))n.action='Waiting for a safe gathering route';
}
function chooseNpc(s:CozyWorldState,n:Npc){
  n.lastDecisionStep=s.step;if(n.overrideUntil&&n.overrideUntil>s.step)return;
  if(!n.task&&!n.path.length&&(n.needs.energy<25||n.resting&&n.needs.energy<55)){n.resting=true;n.reason='I need a short rest before taking on more work.';n.action='Resting at home';route(s,n,place(s,n.homeId)!.position);return;}
  if(n.resting&&n.needs.energy>=55)delete n.resting;
  if(!n.task&&!n.path.length&&n.needs.hunger>=85){const item=n.inventory.bread>0?'bread':n.inventory.grain>0?'grain':null;if(item){n.inventory[item]--;s.ledger.consumed[item]++;n.needs.hunger=Math.max(0,n.needs.hunger-65);const e=emit(s,'npc_meal_eaten',n.id,{item,quantity:1},nearby(s,n));remember(s,e,`${n.name} ate a real meal before helping again.`);}else if(distance(n,place(s,'bakery')!.position)<=1&&available(s,'bakery','bread')>0){pickup(s,n,'bakery','bread',1);}else if(distance(n,place(s,'bakery')!.position)<=1&&available(s,'bakery','grain')>s.rules.seedReserve){pickup(s,n,'bakery','grain',1);}else{n.reason='I need food before I can help.';n.action='Looking for a meal';route(s,n,place(s,'bakery')!.position);}return;}
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
  const task=a.task;if(!task)return;
  if(a.id!=='player'&&s.rules.organizer==='player'&&['food','setup','invite'].includes(task.kind)){finish(s,a);return;}
  if(s.flood.egress.includes(a.id))return;
  if(task.kind==='invite'){
    const target=npc(s,task.targetId);if(!target){finish(s,a);return;}if(!close(a,target)){if(s.step%10===0||!a.path.length)route(s,a,rounded(target));return;}invite(s,a.id,target);finish(s,a);return;
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
    if(!pickup(s,a,task.sourceId!,item,quantity)){finish(s,a);return;}task.phase=task.kind==='setup'?'work':'deliver';route(s,a,place(s,s.festival.venue)!.position);return;
  }
  if(task.kind==='food'){const quantity=Math.min(task.quantity??1,a.inventory.grain,Math.max(0,s.rules.foodTarget-s.festival.food));if(quantity>0){a.inventory.grain-=quantity;s.festival.food+=quantity;eventAtVenue(s,'festival_food_added',a.id,{quantity,text:`${a.name} brought ${quantity} grain.`});}finish(s,a);return;}
  if(task.kind==='setup'){
    a.action='Setting up the gathering';if(--task.remainingSteps>0)return;if(a.inventory.timber<1){finish(s,a);return;}a.inventory.timber--;s.ledger.consumed.timber++;s.festival.setupDone=true;s.festival.setupOwner=null;eventAtVenue(s,'festival_setup_completed',a.id,{timber:1,text:`${a.name} prepared the gathering place.`});finish(s,a);return;
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
  if(s.rules.organizer==='villagers'&&!s.festival.announced&&s.festival.phase==='planning')announce(s);
  for(const n of s.npcs)if(n.overrideUntil!==undefined&&s.step>=n.overrideUntil){delete n.overrideUntil;finish(s,n);emit(s,'npc_plan_expired',n.id,{provenance:'deterministic fallback',reason:'The bounded external plan duration elapsed.'},[n.id]);}
  for(const a of actors(s))advanceMovement(s,a);
  witnessPreparations(s);
  for(const a of actors(s))executeTask(s,a);
  if(s.step%20===0)for(const n of s.npcs)chooseNpc(s,n);
  if(['planning','gathering'].includes(s.festival.phase)&&s.festival.food>=s.rules.foodTarget&&s.festival.setupDone){s.festival.phase='gathering';if(s.festival.participants.length>=2){s.festival.phase='celebrating';s.festival.startedAt=s.step;const quantity=s.festival.food;s.festival.food=0;s.ledger.consumed.grain+=quantity;eventAtVenue(s,'festival_started','wren',{quantity,participants:[...s.festival.participants],text:'The villagers gathered around food they really brought.'});}}
  if(s.festival.phase==='celebrating'&&s.festival.startedAt!==null&&s.step-s.festival.startedAt>=100){s.festival.phase='complete';s.festival.completedAt=s.step;eventAtVenue(s,'festival_completed','wren',{participants:[...s.festival.participants],text:'A small festival became a shared memory.'});for(const n of s.npcs)if(s.festival.participants.includes(n.id)){n.affinity=clamp(n.affinity+3);n.trust=clamp(n.trust+1);n.needs.social=0;n.needs.hunger=Math.max(0,n.needs.hunger-35);finish(s,n);}}
}
export function advanceCozyWorld(state:CozyWorldState,steps:number):CozyWorldState{if(!integer(steps,0,MAX_ADVANCE_STEPS))fail('INVALID_ADVANCE',`Advance0..${MAX_ADVANCE_STEPS} fixed100ms steps.`);const s=copy(state);for(let i=0;i<steps;i++)singleStep(s);s.operations.push({type:'advance',steps});return s;}

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
  stableId(id);if(seenId(state,id))return state;if(expectedRulesRevision!==state.rulesRevision)fail('STALE_RULES','The world rules changed. Preview the proposal again.');const patch=validateRulePatch(input),preview=previewRulePatch(state,patch);if(!preview.valid)fail('INVALID_RULE',preview.errors.join(' '));const s=copy(state),prov=provenance(source);setRules(s,preview.next,patch,'apply',prov);markId(s,id);s.operations.push({type:'rules',id,patch,expectedRulesRevision,provenance:prov});return s;
}
export function revertRulePatch(state:CozyWorldState,expectedRulesRevision:number,source:RuleProvenance={mode:'manual'},id=`revert-${state.rulesRevision+1}`):CozyWorldState{
  stableId(id);if(seenId(state,id))return state;if(expectedRulesRevision!==state.rulesRevision)fail('STALE_RULES','The world rules changed. Refresh before reverting.');const previous=state.ruleHistory.at(-1)?.previous;if(!previous)fail('NO_PREVIOUS_RULE','There is no earlier rule version to restore.');const s=copy(state),prov=provenance(source);setRules(s,previous,previous,'revert',prov);markId(s,id);s.operations.push({type:'revert',id,expectedRulesRevision,provenance:prov});return s;
}

export function projectNpcContext(s:CozyWorldState,id:typeof NPC_IDS[number]):NpcContext{
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
  stableId(id);if(seenId(state,id))return state;const plan=validateNpcPlan(input,projectNpcContext(state,input.npcId)),s=copy(state),n=npc(s,plan.npcId)!,prov=provenance(source);cancel(s,n);n.overrideUntil=s.step+plan.durationSteps;n.lastDecisionStep=s.step;n.reason=plan.reason;
  if(plan.action==='bring-food'){if(!assignFood(s,n,plan.quantity,prov))fail('NO_USEFUL_TASK','No available grain contribution is needed.');}
  else if(plan.action==='set-up'){if(!assignSetup(s,n,prov))fail('NO_USEFUL_TASK','The setup is already assigned or lacks materials.');}
  else if(plan.action==='invite'){const target=npc(s,plan.targetId??'');if(!target||target.id===n.id)fail('INVALID_NPC_PLAN','Choose another visible villager.');n.task={kind:'invite',targetId:target.id,remainingSteps:0,reason:plan.reason,ruleRevision:s.rulesRevision};route(s,n,rounded(target));}
  else if(plan.action==='attend'){n.festivalAccepted=true;assignAttendance(s,n,plan.reason);}
  else if(plan.action==='inspect'){const target=position(s,plan.targetId??'');if(!target)fail('INVALID_NPC_PLAN','Unknown inspection target.');n.task={kind:'inspect',targetId:plan.targetId!,remainingSteps:5,reason:plan.reason,ruleRevision:s.rulesRevision};route(s,n,target);}
  else if(plan.action==='return-home')route(s,n,place(s,n.homeId)!.position);
  n.reason=plan.reason;if(n.task)n.task.reason=plan.reason;n.action=plan.action.replaceAll('-',' ');if(plan.speech)say(s,n,plan.speech,plan.evidenceIds);emit(s,'npc_plan_applied',n.id,{plan,provenance:prov},[n.id],plan.evidenceIds);markId(s,id);s.nextId++;s.operations.push({type:'npc-plan',id,plan,provenance:prov});return s;
}

export function hashCozyWorld(s:CozyWorldState):string{const value={...s} as Partial<CozyWorldState>;delete value.operations;delete value.origin;delete value.events;return hashValue(value);}
export const projectCozyWorld=(s:CozyWorldState)=>copy(s);
export function verifyCozyWorld(s:CozyWorldState):CozyViolation[]{
  const errors:CozyViolation[]=[],bad=(code:string,message:string)=>errors.push({code,message});if(s.engineVersion!==COZY_ENGINE_VERSION||s.contentVersion!==COZY_CONTENT_VERSION||s.version!==1)bad('version','Unsupported cozy version');if(!integer(s.step,0,Number.MAX_SAFE_INTEGER)||s.tick!==s.step/10)bad('clock','Invalid fixed-step clock');if(s.npcs.length!==3||NPC_IDS.some(id=>!npc(s,id))||new Set(s.npcs.map(n=>n.id)).size!==3)bad('census','Three stable cozy villagers are required');
  for(const item of GOODS){let actual=actors(s).reduce((n,a)=>n+a.inventory[item],0)+s.places.reduce((n,p)=>n+p.stock[item],0);if(item==='grain')actual+=s.festival.food;const expected=s.ledger.initial[item]+s.ledger.environment[item]+s.ledger.produced[item]-s.ledger.consumed[item]-s.ledger.waste[item];if(actual!==expected)bad('conservation',`${item}: expected${expected}, held${actual}`);}
  for(const a of actors(s)){if(!Number.isInteger(a.x*4)||!Number.isInteger(a.y*4)||!isCozyWalkable(s,Math.round(a.x),Math.round(a.y),true))bad('position',`${a.id} left solid walkable geometry`);if(GOODS.some(g=>!integer(a.inventory[g],0,10000)))bad('inventory',`${a.id} has an invalid inventory`);if(a.memories.length>32||a.memories.some(m=>!m.id.endsWith(`/m/${a.id}`)||m.step>s.step))bad('memory','Invalid private memory');}
  for(const n of s.npcs)if(Object.values(n.needs).some(v=>!integer(v,0,100))||n.goals.length!==3||n.goals.some(g=>!integer(g.weight,0,100)))bad('needs','Invalid bounded villager needs or goals');
  for(const p of s.places)if(GOODS.some(g=>!integer(p.stock[g],0,10000)))bad('stock','Invalid place stock');for(const p of s.plots){if(p.harvestCount<0||p.phase==='growing'&&(p.readyAt===null||p.wateredAt===null))bad('crop','Invalid crop phase');}
  if(s.ledger.produced.grain!==s.plots.reduce((n,p)=>n+p.harvestCount*4,0))bad('harvest','Harvest output does not match completed crops');
  for(const p of s.places)for(const g of GOODS)if(s.reservations.filter(r=>r.placeId===p.id&&r.item===g).reduce((n,r)=>n+r.quantity,0)>p.stock[g])bad('reservation','A source is over-reserved');
  for(let i=0;i<s.events.length;i++){const event=s.events[i],body={...event} as Partial<CozyEvent>;delete body.hash;if(hashValue(body)!==event.hash||i>0&&event.prevHash!==s.events[i-1].hash)bad('event_hash','Invalid retained event chain');}if(s.events.length&&s.events.at(-1)!.hash!==s.eventHead)bad('event_head','Event head mismatch');
  if(!previewRulePatch(s,s.rules).valid)bad('rules','Invalid active rule set');if(s.festival.food<0||s.festival.food>6||new Set(s.festival.participants).size!==s.festival.participants.length)bad('festival','Invalid festival accounting');return errors;
}

export {initializeCozyWorld,emptyGoods,canonicalStringify};
