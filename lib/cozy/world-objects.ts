import {hashValue} from '../sim/canonical';
import {CozyError,COZY_V3_ENGINE_VERSION,type Actor,type ActorId,type CozyEvent,type CozyWorldState,type Good,type Goods,type NpcId,type RuleProvenance} from './contracts';
import {COZY_MAP,distance,emptyGoods,isCozyWalkable} from './world';
import type {WorldObject,WorldObjectProposal,WorldObjectPreview,WorldObjectCommand} from './world-object-contracts';
export type WorldObjectRuntime={emit:(s:CozyWorldState,type:string,actor:ActorId|null,payload:Record<string,unknown>,audience?:ActorId[],sources?:string[])=>CozyEvent;remember:(s:CozyWorldState,event:CozyEvent,text:string)=>void};
const copy=<T>(x:T):T=>structuredClone(x);
const fail=(code:string,message:string):never=>{throw new CozyError(code,message);};
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
export const WORLD_ASSETS={
 'luminous-mushroom':{frame:'object.luminous-mushroom',name:'A luminous mushroom',affordances:['observe'],maxWater:0},
 'rain-catcher':{frame:'object.rain-catcher',name:'A rain catcher',affordances:['observe','collect-water'],maxWater:12},
 'garden-bench':{frame:'object.garden-bench',name:'A garden bench',affordances:['observe','rest'],maxWater:0},
} as const;
const objects=(s:CozyWorldState)=>s.worldObjects??[];
function requireV3(s:CozyWorldState){if(s.engineVersion!==COZY_V3_ENGINE_VERSION)fail('WORLD_OBJECT_UPGRADE_REQUIRED','Use a separate evolving-world branch first.');}
export function getWorldObjectCapabilities(s?:CozyWorldState){return{version:1,kind:'world-object',maxObjects:8,assets:WORLD_ASSETS,placement:'One authored walkable tile; objects do not silently rewrite terrain or collision.',legalPositions:s?COZY_MAP.walkableRows.flatMap((row,y)=>[...row].flatMap((cell,x)=>cell==='.'&&isCozyWalkable(s,x,y)&&!objects(s).some(o=>distance(o.position,{x,y})<2)?[{x,y}]:[])):undefined,semantics:'Artwork is a generated asset. Metadata creates an actual finite world entity. Only nearby residents receive a discovery; no automatic global knowledge. Water is an explicit outside allocation recorded in the conservation ledger.'};}
export function validateWorldObjectProposal(value:unknown):WorldObjectProposal{
 if(!record(value)||Object.keys(value).sort().join(',')!=='assetId,description,kind,name,position,water'||value.kind!=='world-object'||!Object.hasOwn(WORLD_ASSETS,String(value.assetId))||typeof value.name!=='string'||value.name.trim().length<3||value.name.length>64||typeof value.description!=='string'||value.description.trim().length<3||value.description.length>180||!record(value.position)||Object.keys(value.position).sort().join(',')!=='x,y'||!Number.isInteger(value.position.x)||!Number.isInteger(value.position.y)||!Number.isInteger(value.water))fail('INVALID_WORLD_OBJECT','Use one registered visual asset and a bounded semantic world-object proposal.');
 const p=value as unknown as WorldObjectProposal;
 if(p.water<0||p.water>WORLD_ASSETS[p.assetId].maxWater)fail('INVALID_WORLD_OBJECT_STOCK','Only a rain catcher can introduce0..12 finite water.');
 return copy({...p,name:p.name.trim(),description:p.description.trim()});
}
export function previewWorldObjectProposal(s:CozyWorldState,value:unknown):WorldObjectPreview{
 const p=validateWorldObjectProposal(value),errors:string[]=[];
 if(s.engineVersion!==COZY_V3_ENGINE_VERSION)errors.push('A separate evolving-world branch is required.');
 if(objects(s).length>=8)errors.push('This bounded world already retains eight introduced objects.');
 if(!isCozyWalkable(s,p.position.x,p.position.y))errors.push('Place this on an authored, currently dry walkable tile.');
 if(objects(s).some(o=>distance(o.position,p.position)<2))errors.push('Leave one tile between introduced objects.');
 const resources=emptyGoods();resources.water=p.water;
 return{kind:'world-object',valid:!errors.length,errors,proposal:p,effects:[`Introduce ${p.name} at ${p.position.x},${p.position.y}.`,'Record one persistent entity with its generated sprite and semantic description.','Nearby residents may discover it; distant residents are not told automatically.',...(p.water?[`Allocate ${p.water} finite water from this explicit world amendment.`]:[])],affordances:[...WORLD_ASSETS[p.assetId].affordances],externalResources:resources};
}
export function applyWorldObjectProposal(state:CozyWorldState,value:unknown,source:RuleProvenance,id:string,runtime?:WorldObjectRuntime):CozyWorldState{
 requireV3(state);if(typeof id!=='string'||!id||id.length>120)fail('INVALID_WORLD_OBJECT_ID','Use a stable world amendment ID.');if(state.commandIds.includes(id))return state;
 const preview=previewWorldObjectProposal(state,value);if(!preview.valid)fail('INVALID_WORLD_OBJECT_PLACEMENT',preview.errors.join(' '));
 if(!source||!['manual','fixture','local-qwen','meta'].includes(source.mode))fail('INVALID_PROVENANCE','Record the source of the world amendment.');
 const s=copy(state),p=preview.proposal,stock=emptyGoods();stock.water=p.water;
 const object:WorldObject={id:`world-object-${s.nextId++}`,assetId:p.assetId,name:p.name,description:p.description,position:copy(p.position),stock,introducedStep:s.step,sourceEventId:'',provenance:copy(source),noticedBy:{}};
 s.worldObjects??=[];s.worldObjects.push(object);s.ledger.environment.water+=p.water;
 const event=emit(s,runtime,'world_object_introduced','player',{objectId:object.id,assetId:p.assetId,name:p.name,description:p.description,position:p.position,stock,provenance:source,visualSource:'imagegen asset; semantic properties are registered separately'},['player']);object.sourceEventId=event.id;
 remember(s,runtime,event,`You introduced ${object.name}.`);observeWorldObjects(s,runtime);
 s.commandIds.push(id);if(s.commandIds.length>2048)s.commandIds.shift();s.operations.push({type:'world-object',id,proposal:p,provenance:copy(source)});return s;
}
function emit(s:CozyWorldState,runtime:WorldObjectRuntime|undefined,type:string,actor:ActorId|null,payload:Record<string,unknown>,audience:ActorId[],sources:string[]=[]):CozyEvent{
 if(runtime)return runtime.emit(s,type,actor,payload,audience,sources);
 const body={id:`${s.branchId}:${++s.eventSeq}`,seq:s.eventSeq,step:s.step,tick:s.tick,type,actorId:actor,audience:[...audience],payload:copy(payload),sourceIds:[...sources],rulesRevision:s.rulesRevision,prevHash:s.eventHead};const e={...body,hash:hashValue(body)};s.eventHead=e.hash;s.events.push(e);if(s.events.length>600)s.events.shift();return e;
}
function remember(s:CozyWorldState,runtime:WorldObjectRuntime|undefined,e:CozyEvent,text:string){if(runtime){runtime.remember(s,e,text);return;}for(const a of [s.player,...s.npcs].filter(a=>e.audience.includes(a.id))){a.memories.push({id:`${e.id}/m/${a.id}`,step:s.step,type:e.type,text,sourceIds:[e.id,...e.sourceIds],actorId:e.actorId});if(a.memories.length>32)a.memories.shift();}}
export function observeWorldObjects(s:CozyWorldState,runtime?:WorldObjectRuntime){if(!s.worldObjects?.length)return;for(const object of s.worldObjects)for(const a of [s.player,...s.npcs])if(!object.noticedBy[a.id]&&distance(a,object.position)<=4){const e=emit(s,runtime,'world_object_noticed',a.id,{objectId:object.id,name:object.name,description:object.description,position:copy(object.position),assetId:object.assetId,stock:copy(object.stock),affordances:[...WORLD_ASSETS[object.assetId].affordances]},[a.id],[object.sourceEventId]);object.noticedBy[a.id]={step:s.step,eventId:e.id,stock:copy(object.stock)};remember(s,runtime,e,`I noticed ${object.name}: ${object.description}`);}}
export function getKnownWorldObjects(s:CozyWorldState,id:NpcId|ActorId){return objects(s).filter(o=>!!o.noticedBy[id]).map(o=>({id:o.id,name:o.name,description:o.description,position:copy(o.position),assetId:o.assetId,affordances:[...WORLD_ASSETS[o.assetId].affordances],observedStock:copy(o.noticedBy[id]!.stock),evidenceId:`${o.noticedBy[id]!.eventId}/m/${id}`,observedStep:o.noticedBy[id]!.step}));}
export function worldObjectPosition(s:CozyWorldState,id:string){const o=objects(s).find(o=>o.id===id);return o?copy(o.position):null;}
export function inspectWorldObject(s:CozyWorldState,a:Actor,id:string,runtime:WorldObjectRuntime){const o=objects(s).find(o=>o.id===id);if(!o)return null;if(distance(a,o.position)>1.25)fail('WORLD_OBJECT_TOO_FAR','Reach this object before inspecting it.');const e=emit(s,runtime,'world_object_inspected',a.id,{objectId:o.id,name:o.name,description:o.description,stock:copy(o.stock),affordances:[...WORLD_ASSETS[o.assetId].affordances]},[a.id],[o.sourceEventId]);o.noticedBy[a.id]={step:s.step,eventId:e.id,stock:copy(o.stock)};remember(s,runtime,e,`I inspected ${o.name}: ${o.description}`);return e;}
export function collectWorldObject(s:CozyWorldState,a:Actor,id:string,item:Good,quantity:number,runtime:WorldObjectRuntime){const o=objects(s).find(o=>o.id===id);if(!o)return null;if(distance(a,o.position)>1.25)fail('WORLD_OBJECT_TOO_FAR','Reach the object before collecting its finite contents.');if(o.assetId!=='rain-catcher'||item!=='water'||!Number.isInteger(quantity)||quantity<1||quantity>12||o.stock[item]<quantity)fail('WORLD_OBJECT_UNAVAILABLE','This object does not contain that supported finite resource.');if(Object.values(a.inventory).reduce((x,y)=>x+y,0)+quantity>24)fail('PACK_FULL','Make room in your bag first.');o.stock[item]-=quantity;a.inventory[item]+=quantity;const e=emit(s,runtime,'world_object_goods_collected',a.id,{objectId:o.id,item,quantity,remaining:o.stock[item]},[a.id],[o.sourceEventId]);remember(s,runtime,e,`I collected ${quantity} ${item} from ${o.name}.`);o.noticedBy[a.id]={step:s.step,eventId:e.id,stock:copy(o.stock)};return e;}
export function worldObjectGoods(s:CozyWorldState):Goods{const goods=emptyGoods();for(const o of objects(s))for(const item of Object.keys(goods) as Good[])goods[item]+=o.stock[item];return goods;}
export function applyWorldObjectCommand(s:CozyWorldState,command:WorldObjectCommand,runtime:WorldObjectRuntime){requireV3(s);if(command.action==='inspect')inspectWorldObject(s,s.player,command.objectId,runtime);else collectWorldObject(s,s.player,command.objectId,'water',command.quantity,runtime);}
export function verifyWorldObjects(s:CozyWorldState,bad:(code:string,message:string)=>void){const list=objects(s);if(list.length>8||new Set(list.map(o=>o.id)).size!==list.length)bad('world_objects','World object bounds or identities are invalid.');for(const o of list){if(!Object.hasOwn(WORLD_ASSETS,o.assetId)||o.introducedStep>s.step||!o.sourceEventId||Object.values(o.stock).some(q=>!Number.isSafeInteger(q)||q<0)||o.stock.water>WORLD_ASSETS[o.assetId]?.maxWater||o.stock.grain||o.stock.bread||o.stock.timber)bad('world_object','Invalid introduced object or finite resource account.');}}
