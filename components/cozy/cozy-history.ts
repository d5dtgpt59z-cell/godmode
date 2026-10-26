import type {CozyEvent,CozyWorldState} from '@/lib/cozy/contracts';
import {personName} from './social-presentation';

export type ObservedMoment={id:string;step:number;time:string;title:string;detail:string;source:string};
export type MomentEvidence={moments:ObservedMoment[];unavailable:boolean};
const text=(value:unknown)=>typeof value==='string'?value:null;
const positive=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0?value:null;
const good=(value:unknown)=>value==='grain'?'wheat':value==='bread'?'bread':value==='water'?'water':value==='timber'?'timber':null;
const person=(state:CozyWorldState,id:unknown)=>typeof id==='string'?personName(state,id):'A neighbor';
const visible=(event:CozyEvent)=>event.audience.includes('player');

export function momentTime(event:Pick<CozyEvent,'tick'>){
 const minutes=Math.floor(event.tick/60),hour=(8+Math.floor(minutes/60))%24;
 return `Day ${1+Math.floor(event.tick/86400)} · ${hour%12||12}:${String(minutes%60).padStart(2,'0')} ${hour<12?'am':'pm'}`;
}
export function momentSource(event:CozyEvent,imported=false){
 if(imported)return 'Imported record · source unverified';
 const p=event.payload.provenance;
 const mode=p&&typeof p==='object'&&'mode'in p?p.mode:null;
 return mode==='meta'?'Recorded Meta assistance':mode==='local-qwen'?'Recorded local Qwen assistance':mode==='fixture'?'Synthetic test fixture':mode==='manual'?'Your amendment':'Recorded simulation';
}

/** Describe completed, observed records. No text generation or chronological cause inference. */
export function observedMoment(state:CozyWorldState,event:CozyEvent,imported=false):ObservedMoment|null{
 if(!visible(event)||event.step>state.step)return null;
 const p=event.payload,name=person(state,event.actorId),item=good(p.item),quantity=positive(p.quantity);
 let title:string,detail='';
 switch(event.type){
  case 'crop_planted':title='You planted a beginning.';detail='One wheat seed went into the field.';break;
  case 'crop_watered':title='A drink for the wheat.';detail='One water was used. The planted wheat can now grow.';break;
  case 'crop_ripened':title='The wheat is ready.';detail='A watered crop reached its harvest stage.';break;
  case 'crop_harvested':if(!quantity)return null;title='Your harvest came in.';detail=`${quantity} wheat entered your basket.`;break;
  case 'gift_accepted':case 'gift_declined':{
   if(!item||!quantity)return null;const recipient=person(state,p.npcId),accepted=event.type==='gift_accepted';
   title=`${recipient} ${accepted?'accepted':'declined'} your gift.`;
   detail=accepted?`${quantity} ${item} changed hands.`:'The offered supplies stayed in your basket.';break;
  }
  case 'npc_dialogue':if(!text(p.text))return null;title=`${name} said:`;detail=text(p.text)!;break;
  case 'goods_collected':case 'world_object_goods_collected':
   if(!item||!quantity)return null;title=`${name} collected ${quantity} ${item}.`;
   detail=event.type==='world_object_goods_collected'&&typeof p.remaining==='number'?`${p.remaining} ${item} remained in that container.`:'Existing supplies moved into a bag.';break;
  case 'npc_meal_eaten':case 'personal_meal_eaten':case 'activity_goods_consumed':
   if(!item||!quantity)return null;title=`${name} ${item==='bread'||item==='wheat'?'ate':'used'} ${quantity} ${item}.`;detail='Owned supplies were consumed.';break;
  case 'festival_food_added':title=`${name} contributed to the table.`;detail=quantity?`${quantity} wheat reached the gathering.`:'A contribution reached the gathering.';break;
  case 'festival_setup_completed':title='The gathering place is ready.';detail=`${name} finished the physical preparations.`;break;
  case 'festival_started':title='A little celebration began.';detail='Neighbors gathered around the supplies they brought.';break;
  case 'festival_completed':title='The gathering became a memory.';detail='The shared meal and celebration finished.';break;
  case 'rules_applied':case 'rules_reverted':{
   title=event.type==='rules_applied'?'You changed the world’s rules.':'You restored an earlier rule.';
   const patch=p.patch&&typeof p.patch==='object'?p.patch as Record<string,unknown>:{};
   const labels:Record<string,string>={organizer:'who organizes',venue:'the meeting place',foodTarget:'the wheat target',seedReserve:'the seed reserve',flood:'the low-path flood'};
   const changes=Object.keys(patch).flatMap(key=>labels[key]?[labels[key]]:[]);
   detail=changes.length?`Changed ${changes.join(', ')}. Later actions follow these rules.`:'The accepted rule change is recorded.';break;
  }
  case 'flood_started':title='Water covered the low path.';detail='The flooded path is closed to ordinary travel.';break;
  case 'flood_ended':title='The low path is dry again.';detail='The recorded flood ended and the path reopened.';break;
  case 'world_object_introduced':{
   if(!text(p.name))return null;title=`You introduced ${text(p.name)}.`;
   const stock=p.stock&&typeof p.stock==='object'?p.stock as Record<string,unknown>:null;
   detail=stock&&typeof stock.water==='number'&&stock.water>0?`The new object arrived with ${stock.water} finite water.`:'The object entered the world with its registered physical interactions.';break;
  }
  case 'world_object_noticed':case 'world_object_inspected':
   if(!text(p.name))return null;title=`You ${event.type==='world_object_noticed'?'noticed':'inspected'} ${text(p.name)}.`;detail=text(p.description)??'';break;
  case 'player_idea_shared':title='You shared a possibility.';detail='The idea was delivered in person. Its recipient can consider it independently.';break;
  case 'activity_meeting_started':title='The neighbors actually arrived.';detail=text(p.name)?`The willing participants met for ${text(p.name)}.`:'The willing participants reached the meeting place.';break;
  case 'activity_gesture_completed':{
   if(p.consented!==true||!['dance','embrace','kiss'].includes(String(p.gesture)))return null;
   const pair=`${person(state,p.leftId)} and ${person(state,p.rightId)}`;
   title=p.gesture==='kiss'?`${pair} shared a kiss.`:p.gesture==='embrace'?`${pair} shared an embrace.`:`${pair} danced together.`;
   detail='Both chose the interaction and completed its physical time.';break;
  }
  case 'activity_step_outcome':
   if(p.outcome!=='declined'&&p.outcome!=='blocked')return null;
   title=p.outcome==='declined'?'A neighbor chose not to take part.':'A real obstacle stopped a step.';detail=text(p.reason)??'';break;
  case 'activity_program_completed':title=`${text(p.name)??'The gathering'} ended.`;detail='Its recorded outcomes retain individual choices and any unfinished steps.';break;
  case 'activity_program_blocked':title=`${text(p.name)??'The gathering'} could not continue.`;detail=text(p.text)??'';break;
  case 'activity_goods_exchanged':
   if(!item||!quantity)return null;title=`${name} shared ${quantity} ${item} with ${person(state,p.recipientId)}.`;detail='Owned goods transferred between people who physically met.';break;
  case 'social_response':{
   const stance=p.stance;if(!['join','conditional','decline'].includes(String(stance)))return null;
   title=`${name} ${stance==='join'?'chose to join':stance==='conditional'?'set conditions on':'declined'} a shared plan.`;
   detail=text(p.reason)??'';break;
  }
  case 'institution_formed':title=`${text(p.name)??'A shared group'} formed.`;detail='The recorded members independently agreed to a shared purpose.';break;
  default:return null;
 }
 return{id:event.id,step:event.step,time:momentTime(event),title,detail,source:momentSource(event,imported)};
}

export function observedHistory(state:CozyWorldState,limit=8,imported=false){
 const count=Number.isFinite(limit)?Math.max(1,Math.min(20,Math.floor(limit))):8;
 const seen=new Set<string>();
 return [...state.events].sort((a,b)=>b.seq-a.seq).flatMap(event=>{
  if(seen.has(event.id))return[];seen.add(event.id);const moment=observedMoment(state,event,imported);return moment?[moment]:[];
 }).slice(0,count);
}

/** Traverse only explicit links visible to the player, including the player's own memory receipts. */
export function observedEvidence(state:CozyWorldState,eventId:string,imported=false):MomentEvidence{
 const origin=state.events.find(event=>event.id===eventId);
 if(!origin||!visible(origin)||origin.step>state.step)return{moments:[],unavailable:false};
 const queue=[...origin.sourceIds],seen=new Set<string>([origin.id]),moments:ObservedMoment[]=[];let unavailable=false;
 while(queue.length&&seen.size<64&&moments.length<6){
  const id=queue.shift()!;if(seen.has(id))continue;seen.add(id);
  const event=state.events.find(value=>value.id===id);
  if(event){
   if(!visible(event)||event.step>origin.step){unavailable=true;continue;}
   const moment=observedMoment(state,event,imported);if(moment)moments.push(moment);
   queue.push(...event.sourceIds);continue;
  }
  const memory=state.player.memories.find(value=>value.id===id);
  if(memory&&memory.step<=origin.step)queue.push(...memory.sourceIds);else unavailable=true;
 }
 if(queue.length)unavailable=true;
 return{moments:moments.sort((a,b)=>a.step-b.step),unavailable};
}
