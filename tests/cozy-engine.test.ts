import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  COZY_MAP,advanceCozyWorld,applyNpcPlan,applyRulePatch,checkpointCozyWorld,cozyCapsHash,
  dispatchCozyCommand,exportCozyRecording,festivalAttendanceSpots,findCozyPath,forkBeforeRule,forkCozyWorld,
  getRuleCapabilities,hashCozyWorld,initializeCozyWorld,inFlood,isCozyWalkable,
  previewRulePatch,projectNpcContext,replayCozyRecording,revertRulePatch,rewindCozyWorld,
  validateCozyCommand,validateNpcPlan,validateRulePatch,verifyCozyWorld,
  type CozyCommand,type CozyWorldState,type NpcPlan,type Point,
} from '../lib/cozy';

let sequence=0;
const command=(s:CozyWorldState,value:Omit<CozyCommand,'id'>)=>dispatchCozyCommand(s,{...value,id:`test-${++sequence}`} as CozyCommand);
function walk(s:CozyWorldState,target:Point):CozyWorldState{
  let next=command(s,{type:'move',target} as Omit<CozyCommand,'id'>);
  next=advanceCozyWorld(next,next.player.path.length*4+4);assert.equal(next.player.path.length,0);assert.equal(next.player.x,target.x);assert.equal(next.player.y,target.y);return next;
}
function grow(s:CozyWorldState):CozyWorldState{
  let next=walk(s,s.plots[0].position);
  next=command(next,{type:'plant',plotId:'plot-1'} as Omit<CozyCommand,'id'>);
  next=command(next,{type:'water',plotId:'plot-1'} as Omit<CozyCommand,'id'>);
  next=advanceCozyWorld(next,180);return command(next,{type:'harvest',plotId:'plot-1'} as Omit<CozyCommand,'id'>);
}
function frozenNeighbors(s:CozyWorldState):CozyWorldState{const next=structuredClone(s);for(const n of next.npcs){n.path=[];n.task=null;n.overrideUntil=10000;}return next;}

test('cozy profile is separate, has three existing identities, and every art-aligned interaction target is reachable',()=>{
  const s=initializeCozyWorld(1);
  assert.deepEqual(s.npcs.map(n=>n.id),['ada','mara','wren']);assert.equal(s.player.id,'player');
  assert.equal(COZY_MAP.width,32);assert.equal(COZY_MAP.height,24);
  for(const target of [...COZY_MAP.places,...COZY_MAP.plots])assert(findCozyPath(s,s.player,target.position)!==null,`${target.id} should be reachable`);
  assert.equal(isCozyWalkable(s,2,2),false,'roof/canopy tile is solid');
  assert.equal(isCozyWalkable(s,COZY_MAP.riverX,COZY_MAP.bridgeY),true);
  assert.equal(isCozyWalkable(s,COZY_MAP.riverX,COZY_MAP.bridgeY-1),false);
  assert.deepEqual(verifyCozyWorld(s),[]);
});

test('engine geometry matches the frozen art manifest including clear market and woodpile approaches',()=>{
  const expected=JSON.parse(readFileSync(new URL('../public/assets/cozy/map.json',import.meta.url),'utf8')) as Record<string,unknown>;
  const actual=JSON.parse(JSON.stringify(COZY_MAP)) as Record<string,unknown>;
  // Display names are engine content; every exported geometry/atlas-manifest field must match the artist's manifest.
  const expectedPlaces=expected.places as Record<string,unknown>[];
  (actual.places as Record<string,unknown>[]).forEach((p,index)=>{for(const key of Object.keys(p))if(!(key in expectedPlaces[index]))delete p[key];});
  const actualFlood=actual.floodZone as Record<string,unknown>,expectedFlood=expected.floodZone as Record<string,unknown>;for(const key of Object.keys(actualFlood))if(!(key in expectedFlood))delete actualFlood[key];
  assert.deepEqual(actual,expected);
  const state=initializeCozyWorld(90);assert.deepEqual(COZY_MAP.places.find(p=>p.id==='market')!.position,{x:24,y:15});assert.deepEqual(COZY_MAP.places.find(p=>p.id==='woodpile')!.position,{x:5,y:12});
  assert.equal(isCozyWalkable(state,26,15),false,'the red-roof tip is not a valid market approach');
  for(const target of [...COZY_MAP.places,...COZY_MAP.plots])assert(findCozyPath(state,state.player,target.position)!==null,target.id);
});

test('movement is immediate fixed-step intent, without teleportation or unvalidated inventory changes',()=>{
  const s=initializeCozyWorld(2),inventory=structuredClone(s.player.inventory);
  const target=COZY_MAP.places.find(p=>p.id==='well')!.position,moving=command(s,{type:'move',target} as Omit<CozyCommand,'id'>);
  assert.deepEqual({x:moving.player.x,y:moving.player.y},{x:s.player.x,y:s.player.y});
  const first=advanceCozyWorld(moving,1);assert(first.player.x!==s.player.x||first.player.y!==s.player.y,'movement appears after100ms');
  assert.deepEqual(first.player.inventory,inventory);assert.deepEqual(s.player.path,[]);
  assert.throws(()=>command(s,{type:'move',target:{x:2,y:2}} as Omit<CozyCommand,'id'>),/cannot be reached/);
  assert.deepEqual(verifyCozyWorld(first),[]);
});

test('single wheat crop spends one seed and one water, matures by ticks and yields exactly four grain',()=>{
  const initial=initializeCozyWorld(3);let s=walk(initial,initial.plots[0].position);
  s=command(s,{type:'plant',plotId:'plot-1'} as Omit<CozyCommand,'id'>);assert.equal(s.player.inventory.grain,3);
  assert.throws(()=>command(s,{type:'harvest',plotId:'plot-1'} as Omit<CozyCommand,'id'>),/not ready/);
  s=command(s,{type:'water',plotId:'plot-1'} as Omit<CozyCommand,'id'>);s=advanceCozyWorld(s,179);assert.equal(s.plots[0].phase,'growing');s=advanceCozyWorld(s,1);assert.equal(s.plots[0].phase,'ripe');
  const harvest:CozyCommand={id:'harvest-once',type:'harvest',plotId:'plot-1'};s=dispatchCozyCommand(s,harvest);
  assert.equal(s.player.inventory.grain,7);assert.equal(s.ledger.produced.grain,4);assert.equal(s.ledger.consumed.grain,1);assert.equal(s.ledger.consumed.water,1);
  assert.equal(dispatchCozyCommand(s,harvest),s,'duplicate ids are idempotent');
  assert.throws(()=>command(s,{type:'harvest',plotId:'plot-1'} as Omit<CozyCommand,'id'>),/not ready/);
  assert.deepEqual(verifyCozyWorld(s),[]);assert.equal(hashCozyWorld(replayCozyRecording(exportCozyRecording(s))),hashCozyWorld(s));
});

test('adjacency, pack ownership and seed reserve are enforced before state mutation',()=>{
  const initial=initializeCozyWorld(4),hash=hashCozyWorld(initial);
  assert.throws(()=>command(initial,{type:'plant',plotId:'plot-1'} as Omit<CozyCommand,'id'>),/Walk next/);
  assert.equal(hashCozyWorld(initial),hash);
  let s=walk(initial,COZY_MAP.places.find(p=>p.id==='square')!.position);
  s=applyRulePatch(s,{seedReserve:3},0,{mode:'manual'},'reserve-three');
  assert.throws(()=>command(s,{type:'festival',task:'food',quantity:2} as Omit<CozyCommand,'id'>),/protected seed/);
  s=command(s,{type:'festival',task:'food',quantity:1} as Omit<CozyCommand,'id'>);assert.equal(s.player.inventory.grain,3);
  s=walk(s,s.plots[0].position);s=command(s,{type:'plant',plotId:'plot-1'} as Omit<CozyCommand,'id'>);assert.equal(s.player.inventory.grain,2,'planting may use protected seed');
  assert.deepEqual(verifyCozyWorld(s),[]);
});

test('the same grain gift has distinct villager reactions and Mara changes her next action',()=>{
  let s=frozenNeighbors(initializeCozyWorld(5));for(const n of s.npcs){n.x=s.player.x;n.y=s.player.y;}
  const before=s.player.inventory.grain;s=command(s,{type:'gift',npcId:'mara',item:'grain',quantity:1} as Omit<CozyCommand,'id'>);
  assert.equal(s.player.inventory.grain,before);assert.equal(s.npcs[1].task?.kind,'inspect');assert(s.events.some(e=>e.type==='gift_declined'));
  s=command(s,{type:'gift',npcId:'ada',item:'grain',quantity:1} as Omit<CozyCommand,'id'>);assert.equal(s.npcs[0].affinity,48);assert.equal(s.npcs[0].trust,55);
  s=command(s,{type:'gift',npcId:'wren',item:'grain',quantity:1} as Omit<CozyCommand,'id'>);assert.equal(s.npcs[2].affinity,43);assert.equal(s.npcs[2].trust,52);
  assert.equal(s.player.gifts,2);assert.deepEqual(verifyCozyWorld(s),[]);
});

test('harvest witnesses receive three distinct actual reactions and source receipts',()=>{
  let s=frozenNeighbors(initializeCozyWorld(6));for(const n of s.npcs){n.x=s.plots[0].position.x;n.y=s.plots[0].position.y;}
  s=grow(s);assert(s.npcs.every(n=>n.harvestsSeen===1));
  const dialogue=s.events.filter(e=>e.type==='npc_dialogue').map(e=>e.payload.text);assert.equal(new Set(dialogue).size,3);
  for(const n of s.npcs){const receipt=n.memories.find(m=>m.type==='crop_harvested');assert(receipt);assert(receipt.id.endsWith(`/m/${n.id}`));}
  assert.deepEqual(verifyCozyWorld(s),[]);
});

test('manual festival requires physical food, actual setup work and independent invitations/arrivals',()=>{
  let s=walk(initializeCozyWorld(7),COZY_MAP.places.find(p=>p.id==='square')!.position);
  s=command(s,{type:'festival',task:'food',quantity:3} as Omit<CozyCommand,'id'>);
  s=command(s,{type:'festival',task:'setup'} as Omit<CozyCommand,'id'>);assert.equal(s.festival.setupDone,false);s=advanceCozyWorld(s,30);assert.equal(s.festival.setupDone,true);
  for(const id of ['ada','mara','wren']as const){const target=s.npcs.find(n=>n.id===id)!;s=walk(s,{x:Math.round(target.x),y:Math.round(target.y)});if(Math.abs(s.player.x-target.x)+Math.abs(s.player.y-target.y)>1.25){const again=s.npcs.find(n=>n.id===id)!;s=walk(s,{x:Math.round(again.x),y:Math.round(again.y)});}s=command(s,{type:'invite',npcId:id} as Omit<CozyCommand,'id'>);}
  s=advanceCozyWorld(s,900);assert.equal(s.festival.phase,'complete');assert(s.festival.participants.length>=2);
  assert.equal(s.ledger.consumed.timber,1);assert.equal(s.ledger.consumed.grain,3);assert.deepEqual(verifyCozyWorld(s),[]);
});

test('villagers independently bid for food, setup and invitations, physically complete them and all can attend',()=>{
  let s=applyRulePatch(initializeCozyWorld(8),{organizer:'villagers'},0,{mode:'manual'},'organize');s=advanceCozyWorld(s,1000);
  const bids=s.events.filter(e=>e.type==='festival_bid');assert(bids.some(e=>e.actorId==='ada'&&e.payload.kind==='food'));assert(bids.some(e=>e.actorId==='mara'&&e.payload.kind==='setup'));assert(bids.some(e=>e.actorId==='wren'&&e.payload.kind==='invite'));
  assert.equal(s.festival.phase,'complete');assert.equal(s.festival.participants.length,3);assert.equal(s.ledger.consumed.grain,3);assert.equal(s.ledger.consumed.timber,1);
  assert.equal(s.npcs.every(n=>n.memories.some(m=>m.type==='festival_completed')),true);assert.deepEqual(verifyCozyWorld(s),[]);
});

for(const venue of ['square','market'] as const)test(`${venue} festival attendees occupy three distinct real ground positions through celebration and replay`,()=>{
  let s=applyRulePatch(initializeCozyWorld(60,`spacing-${venue}`),{organizer:'villagers',venue},0,{mode:'manual'},'spacing-rule');
  let gathered:CozyWorldState|null=null;
  for(let count=0;count<2000&&s.festival.phase!=='complete';count++){s=advanceCozyWorld(s,1);if(s.festival.phase==='celebrating'&&s.festival.participants.length===3)gathered=s;}
  assert.equal(s.festival.phase,'complete');assert(gathered,'all three must physically join while the festival is running');
  const slots=festivalAttendanceSpots(gathered,venue),center=gathered.places.find(p=>p.id===venue)!.position;
  const expected=venue==='square'?[{x:12,y:17},{x:14,y:17},{x:16,y:17}]:[{x:23,y:14},{x:23,y:16},{x:23,y:18}];
  assert.deepEqual(gathered.npcs.map(n=>({x:n.x,y:n.y})),expected);
  assert.equal(new Set(gathered.npcs.map(n=>`${n.x},${n.y}`)).size,3);
  for(const n of gathered.npcs){assert.deepEqual({x:n.x,y:n.y},slots[n.id]);assert.equal(isCozyWalkable(gathered,n.x,n.y),true);assert(Math.abs(n.x-center.x)+Math.abs(n.y-center.y)<=4);assert.deepEqual(n.task?.attendanceSpot,slots[n.id]);}
  assert.equal(gathered.ledger.consumed.grain,3);assert.equal(gathered.ledger.consumed.timber,1);assert.deepEqual(verifyCozyWorld(gathered),[]);
  const replayed=replayCozyRecording(exportCozyRecording(gathered));assert.equal(hashCozyWorld(replayed),hashCozyWorld(gathered));assert.deepEqual(replayed.npcs.map(n=>({x:n.x,y:n.y})),expected);
  assert(gathered.events.filter(e=>e.type==='festival_arrival').every(e=>e.payload.position&&e.payload.attendanceSpot));
});

test('bounded flooding preserves safe, distinct attendance targets and physical routes',()=>{
  let s=applyRulePatch(initializeCozyWorld(61,'spacing-flood'),{organizer:'villagers',flood:{enabled:true,durationSteps:1200}},0);
  for(let count=0;count<1000&&!(s.festival.phase==='celebrating'&&s.festival.participants.length===3);count++)s=advanceCozyWorld(s,1);
  assert.equal(s.festival.phase,'celebrating');assert.equal(s.flood.active,true);assert.equal(s.festival.participants.length,3);
  assert.equal(new Set(s.npcs.map(n=>`${n.x},${n.y}`)).size,3);for(const n of s.npcs){assert.equal(isCozyWalkable(s,n.x,n.y),true);assert.equal(inFlood(n),false);assert.deepEqual(n.task?.attendanceSpot,{x:n.x,y:n.y});}
  assert.deepEqual(verifyCozyWorld(s),[]);assert.equal(hashCozyWorld(replayCozyRecording(exportCozyRecording(s))),hashCozyWorld(s));
});

test('trust and needs affect future help rather than merely decorating dialogue',()=>{
  let s=initializeCozyWorld(9);s.npcs[0].trust=20;s.npcs[1].needs.energy=10;
  s=applyRulePatch(s,{organizer:'villagers'},0);s=advanceCozyWorld(s,100);
  assert(!s.events.some(e=>e.type==='festival_bid'&&e.actorId==='ada'),'low trust declines help');
  assert(!s.events.some(e=>e.type==='festival_bid'&&e.actorId==='mara'),'tired Mara rests before volunteering');
  assert(s.npcs[1].reason.includes('rest'));assert.equal(s.npcs[0].goals.length,3);assert.notDeepEqual(s.npcs[0].goals,s.npcs[2].goals);
});

test('shared seed reserve constrains autonomous food collection, leaving the task honestly unfinished',()=>{
  let s=applyRulePatch(initializeCozyWorld(10),{organizer:'villagers',foodTarget:6,seedReserve:3},0);s=advanceCozyWorld(s,1000);
  assert.equal(s.places.find(p=>p.id==='bakery')!.stock.grain,3);assert.equal(s.festival.food,4);assert.notEqual(s.festival.phase,'complete');assert.deepEqual(verifyCozyWorld(s),[]);
});

test('rule catalog advertises only implemented bounded fields and stale rules fail without consuming a walking revision',()=>{
  const initial=initializeCozyWorld(11),caps=getRuleCapabilities();assert(caps.fields.organizer);assert(cozyCapsHash());
  assert.throws(()=>validateRulePatch({teleportEveryone:true}),/not implemented/);assert.throws(()=>validateRulePatch({foodTarget:999}),/bounds/);
  assert.throws(()=>validateCozyCommand({id:'bad',type:'eval',code:'arbitrary'}),/not implemented/);
  const preview=previewRulePatch(initial,{venue:'market',foodTarget:4});assert(preview.valid);assert.equal(preview.changes.length,2);assert.equal(initial.rules.venue,'square');
  let s=advanceCozyWorld(initial,3);s=applyRulePatch(s,{venue:'market'},0,{mode:'manual'},'edit');assert.equal(s.festival.venue,'market');
  assert.throws(()=>applyRulePatch(s,{foodTarget:4},0),/changed/);assert.equal(s.rulesRevision,1);
  s=revertRulePatch(s,1,{mode:'manual'},'restore');assert.equal(s.rules.venue,'square');assert.equal(s.rulesRevision,2);assert.deepEqual(verifyCozyWorld(s),[]);
});

test('flood changes both movement and plans, safely releases occupants, expires and can be prospectively reverted',()=>{
  let s=walk(initializeCozyWorld(12),COZY_MAP.floodZone.cells[0]);const target={...COZY_MAP.floodZone.cells[0]};
  s=applyRulePatch(s,{flood:{enabled:true,durationSteps:100}},0);assert.equal(s.flood.active,true);assert(s.flood.egress.includes('player'));
  assert.equal(isCozyWalkable(s,target.x,target.y),false);assert.throws(()=>command(s,{type:'move',target} as Omit<CozyCommand,'id'>),/cannot be reached/);
  s=advanceCozyWorld(s,20);assert.equal(inFlood(s.player),false,'existing occupant exits rather than teleporting');assert.deepEqual(verifyCozyWorld(s),[]);
  const inventory=structuredClone(s.player.inventory);s=revertRulePatch(s,1);assert.equal(s.flood.active,false);assert.deepEqual(s.player.inventory,inventory);
  s=applyRulePatch(s,{flood:{enabled:true,durationSteps:100}},2);s=advanceCozyWorld(s,100);assert.equal(s.flood.active,false);assert(s.events.some(e=>e.type==='flood_ended'));
});

test('optional NPC plans use private evidence, actual tasks, explicit provenance and bounded expiration',()=>{
  let s=initializeCozyWorld(13);const context=projectNpcContext(s,'ada');assert.equal(context.places.find(p=>p.id==='well')!.stock,null);assert.equal(context.nearbyActors.some(a=>a.id==='player'),false);assert(context.npc.needs);assert.equal(context.npc.goals.length,3);
  const plan:NpcPlan={npcId:'ada',action:'wait',targetId:null,quantity:0,durationSteps:20,reason:'Take a brief quiet moment.',speech:'A little pause.',evidenceIds:[]};
  assert.throws(()=>validateNpcPlan({...plan,evidenceIds:['private-other-memory']},context),/context/);
  s=applyNpcPlan(s,plan,{mode:'fixture',model:'synthetic-test-only'},'npc-fixture');assert(s.events.some(e=>e.type==='npc_plan_applied'&&(e.payload.provenance as {mode:string}).mode==='fixture'));
  s=advanceCozyWorld(s,20);assert(s.events.some(e=>e.type==='npc_plan_expired'));assert.equal(s.npcs[0].overrideUntil,undefined);assert.deepEqual(verifyCozyWorld(s),[]);
});

test('inspecting an unrelated place cannot reveal unseen festival preparations',()=>{
  let s=initializeCozyWorld(23);const plan:NpcPlan={npcId:'ada',action:'inspect',targetId:'bakery',quantity:0,durationSteps:100,reason:'Check my nearby store.',speech:'',evidenceIds:[]};
  s=applyNpcPlan(s,plan,{mode:'fixture'},'inspect-bakery');s=advanceCozyWorld(s,6);
  assert(s.npcs[0].memories.some(m=>m.type==='place_inspected'));assert.equal(projectNpcContext(s,'ada').festival,null);assert.equal(s.npcs[0].knownFestival,false);
  assert.deepEqual(verifyCozyWorld(s),[]);
});

test('a changed seed rule revalidates already reserved future food collection',()=>{
  let s=applyRulePatch(initializeCozyWorld(24),{organizer:'villagers',foodTarget:6,seedReserve:0},0);s=advanceCozyWorld(s,20);
  assert(s.reservations.some(r=>r.actorId==='ada'));
  s=applyRulePatch(s,{seedReserve:3},1);s=advanceCozyWorld(s,900);
  assert.equal(s.places.find(p=>p.id==='bakery')!.stock.grain,3);assert.equal(s.festival.food,4);assert.deepEqual(verifyCozyWorld(s),[]);
});

test('an external food plan honors its requested quantity and records its actual provenance',()=>{
  let s=applyRulePatch(initializeCozyWorld(25),{organizer:'villagers'},0);s=advanceCozyWorld(s,1);
  const context=projectNpcContext(s,'ada'),plan:NpcPlan={npcId:'ada',action:'bring-food',targetId:'square',quantity:1,durationSteps:600,reason:'I will bring one grain.',speech:'One contribution from me.',evidenceIds:context.memories.slice(-1).map(m=>m.id)};
  s=applyNpcPlan(s,plan,{mode:'fixture',model:'synthetic'},'one-grain');assert.equal(s.festival.foodReserved.ada,1);
  const bid=s.events.findLast(e=>e.type==='festival_bid'&&e.actorId==='ada')!;assert.equal((bid.payload.provenance as {mode:string}).mode,'fixture');
  s=advanceCozyWorld(s,180);assert.equal(s.festival.food,1);assert.deepEqual(verifyCozyWorld(s),[]);
});

test('fixed-step batching, complete recordings and fork continuation are exactly deterministic',()=>{
  let a=applyRulePatch(initializeCozyWorld(14),{organizer:'villagers'},0),b=a;
  a=advanceCozyWorld(a,800);for(let i=0;i<800;i++)b=advanceCozyWorld(b,1);
  assert.equal(hashCozyWorld(a),hashCozyWorld(b));assert.equal(a.eventHead,b.eventHead);
  assert.equal(hashCozyWorld(replayCozyRecording(exportCozyRecording(a))),hashCozyWorld(a));
  const parentHash=hashCozyWorld(a),past=rewindCozyWorld(a,100);let fork=forkCozyWorld(past,'another-way');fork=applyRulePatch(fork,{foodTarget:5},fork.rulesRevision);fork=advanceCozyWorld(fork,500);
  assert.equal(hashCozyWorld(a),parentHash);assert.equal(hashCozyWorld(replayCozyRecording(exportCozyRecording(fork))),hashCozyWorld(fork));assert.deepEqual(verifyCozyWorld(fork),[]);
});

test('exact rule undo preserves prior same-step actions and rejects an old segment index',()=>{
  let s=command(initializeCozyWorld(15),{type:'move',target:COZY_MAP.places.find(p=>p.id==='well')!.position} as Omit<CozyCommand,'id'>);
  s=applyRulePatch(s,{foodTarget:4},0,{mode:'manual'},'same-step-first');const beforeSecond=hashCozyWorld(s);
  s=applyRulePatch(s,{seedReserve:2},1,{mode:'manual'},'same-step-second');const prefix=s.ruleHistory[1].operationIndex;
  const earlier=replayCozyRecording(exportCozyRecording(s),{untilOperation:prefix});assert.equal(hashCozyWorld(earlier),beforeSecond);assert(earlier.player.path.length>0);assert.equal(earlier.rules.foodTarget,4);assert.equal(earlier.rules.seedReserve,1);
  const fork=forkBeforeRule(s,'exact-undo',2);assert.equal(fork.origin.parentHash,beforeSecond);assert(fork.player.path.length>0);
  s=checkpointCozyWorld(s).state;assert.throws(()=>forkBeforeRule(s,'wrong-segment',2),/different history segment/);
});

test('archival rollover keeps complete prior recording and exact continuation, and tampering is detected',()=>{
  let s=grow(initializeCozyWorld(16));const original=hashCozyWorld(s),{state,archive}=checkpointCozyWorld(s);
  assert.equal(hashCozyWorld(replayCozyRecording(archive)),original);s=advanceCozyWorld(state,30);
  assert.equal(hashCozyWorld(replayCozyRecording(exportCozyRecording(s))),hashCozyWorld(s));
  const bad=structuredClone(exportCozyRecording(s));bad.finalHash='0'.repeat(64);assert.throws(()=>replayCozyRecording(bad),/exact state/);
  assert.deepEqual(verifyCozyWorld(s),[]);assert(JSON.stringify(s).length<1_800_000);
});
