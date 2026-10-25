import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeCozyWorld,upgradePersonalCozyWorld,advanceCozyWorld,applyActivityProposal,previewActivityProposal,validateActivityProposal,getActivityCapabilities,applyPersonalDecision,projectPersonalContext,hashCozyWorld,verifyCozyWorld,exportCozyRecording,replayCozyRecording,checkpointCozyWorld,forkCozyWorld,applyWorldObjectProposal,getKnownWorldObjects,dispatchCozyCommand,type ActivityBlueprint,type ActivityStep,type CozyWorldState,type PersonalDecision,type CozyCommand} from '../lib/cozy';
const source={mode:'fixture' as const,model:'synthetic-activity-contract'};
let seq=0;
const step=(action:ActivityStep['action'],changes:Partial<ActivityStep>={}):ActivityStep=>({action,actorId:null,targetId:null,item:null,quantity:null,gesture:null,text:null,durationSteps:20,...changes});
const blueprint=(steps:ActivityStep[]=[step('gesture',{gesture:'kiss'})]):ActivityBlueprint=>({name:'An afternoon of affection',purpose:'Invite every neighbor to meet and choose their own interactions.',organizerId:'wren',participants:['ada','mara','wren'],venue:'square',steps});
function fresh(custom?:(s:CozyWorldState)=>void){const s=initializeCozyWorld(137,'activity-parent');custom?.(s);return upgradePersonalCozyWorld(s,'activity-world');}
function apply(s:CozyWorldState,program=blueprint()){return applyActivityProposal(s,program,source,`program-${++seq}`);}
function run(s:CozyWorldState,max=4000){for(let i=0;i<max/25&&!['completed','blocked'].includes(s.activities!.programs[0].status);i++)s=advanceCozyWorld(s,25);assert(['completed','blocked'].includes(s.activities!.programs[0].status));return s;}
function exact(s:CozyWorldState){assert.deepEqual(verifyCozyWorld(s),[]);const replay=replayCozyRecording(exportCozyRecording(s));assert.equal(hashCozyWorld(replay),hashCozyWorld(s));assert.equal(replay.eventHead,s.eventHead);}

test('declarative activity preview is nonmutating and advertises implemented primitives rather than arbitrary code',()=>{
 const s=fresh(),hash=hashCozyWorld(s),preview=previewActivityProposal(s,blueprint());assert(preview.valid);assert.equal(hashCozyWorld(s),hash);assert(preview.effects.requiresIndividualConsent);assert.equal(getActivityCapabilities(s).version,'cozy-activities-1');assert(getActivityCapabilities(s).actions.includes('exchange'));assert.throws(()=>validateActivityProposal(s,{...blueprint(),script:'everyone.kiss()'}),/bounded activity/);assert.throws(()=>validateActivityProposal(s,blueprint([step('gesture',{gesture:'teleport' as 'kiss'})])),/unsupported/);assert.equal(previewActivityProposal(initializeCozyWorld(),blueprint()).valid,false);assert.equal(s.activities,undefined);
});

test('all-neighbor affection request performs actual invitations, meeting, timed consensual kissing and individual refusals',()=>{
 let s=apply(fresh());assert.deepEqual(Object.keys(s.activities!.programs[0].responses),['wren']);const food=JSON.stringify(s.festival),initialSocial=s.npcs.find(n=>n.id==='wren')!.needs.social;s=run(s);const p=s.activities!.programs[0];assert.equal(p.status,'completed');assert.equal(Object.keys(p.responses).length,3);assert(p.participants.every(id=>p.responses[id]?.status==='accepted'));assert.equal(s.events.filter(e=>e.type==='activity_invitation_delivered').length,2);
 for(const e of s.events.filter(e=>e.type==='activity_invitation_delivered')){const a=e.payload.positionHost as {x:number;y:number},b=e.payload.positionRecipient as {x:number;y:number};assert(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)<=1.25);}
 const kisses=s.events.filter(e=>e.type==='activity_gesture_completed');assert.equal(kisses.length,1);assert.equal(kisses[0].payload.gesture,'kiss');assert.equal(kisses[0].payload.consented,true);const a=kisses[0].payload.positionLeft as {x:number;y:number},b=kisses[0].payload.positionRight as {x:number;y:number};assert(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)<=1.25);const started=s.events.find(e=>e.type==='activity_gesture_started')!;assert(kisses[0].step-started.step>=19);assert.equal(p.outcomes.filter(o=>o.outcome==='declined').length,2);assert(p.outcomes.some(o=>o.reason.startsWith('Mara:')));assert(s.npcs.find(n=>n.id==='wren')!.needs.social<initialSocial);assert(s.activities!.relationships['wren>ada'].lastInteractionStep!==null);assert(s.mind!.relationships.ada.basis==='observed');assert.equal(JSON.stringify(s.festival),food);assert.equal(s.ledger.consumed.grain,0);exact(s);
});

test('gesture choices follow individual preferences and needs rather than an identity-specific kissing cutscene',()=>{
 let s=apply(fresh(old=>{for(const n of old.npcs)for(const goal of n.goals)goal.weight=goal.id==='belong'?100:0;}));s=run(s);assert.equal(s.events.filter(e=>e.type==='activity_gesture_completed'&&e.payload.gesture==='kiss').length,3);exact(s);
 let tired=apply(fresh(old=>{old.npcs.find(n=>n.id==='mara')!.needs.energy=0;}));tired=run(tired);assert.equal(tired.activities!.programs[0].responses.mara?.status,'declined');assert(!tired.events.some(e=>e.type==='activity_gesture_completed'&&[e.payload.leftId,e.payload.rightId].includes('mara')));exact(tired);
});

test('individual consent may be withdrawn during a long gesture and never produces a completion effect',()=>{
 let s=apply(fresh(old=>{const n=old.npcs.find(n=>n.id==='ada')!;n.needs.hunger=81;n.goals.find(g=>g.id==='belong')!.weight=65;}),blueprint([step('gesture',{gesture:'kiss',durationSteps:300})]));s=run(s);assert(s.events.some(e=>e.type==='activity_gesture_started'));assert.equal(s.activities!.programs[0].responses.ada?.status,'withdrawn');assert(!s.events.some(e=>e.type==='activity_gesture_completed'&&[e.payload.leftId,e.payload.rightId].includes('ada')));assert.equal(s.activities!.relationships['ada>wren'].lastInteractionStep,null);exact(s);
});

test('pair cooldown prevents repeated kisses being counted as separate completed actions without time',()=>{
 let s=apply(fresh(),blueprint([step('gesture',{gesture:'kiss',durationSteps:10}),step('gesture',{gesture:'kiss',durationSteps:10})]));s=run(s);assert.equal(s.events.filter(e=>e.type==='activity_gesture_completed').length,1);assert(s.activities!.programs[0].outcomes.some(o=>o.outcome==='blocked'&&/little time/.test(o.reason)));exact(s);
});

test('composed collect, exchange and consume steps move finite owned goods through real physical actions',()=>{
 let s=apply(fresh(),blueprint([step('collect',{actorId:'ada',targetId:'bakery',item:'bread',quantity:1}),step('exchange',{actorId:'ada',targetId:'mara',item:'bread',quantity:1}),step('consume',{actorId:'mara',item:'bread',quantity:1})]));s=run(s);assert.equal(s.activities!.programs[0].status,'completed');assert.equal(s.places.find(p=>p.id==='bakery')!.stock.bread,1);assert.equal(s.ledger.consumed.bread,1);assert.equal(s.npcs.find(n=>n.id==='mara')!.inventory.bread,0);assert(s.events.some(e=>e.type==='activity_goods_exchanged'));assert(s.events.some(e=>e.type==='activity_goods_consumed'));assert.equal(s.festival.phase,'planning');exact(s);
});

test('missing goods and protected seeds block actual steps without fabricating transfers',()=>{
 let s=apply(fresh(),blueprint([step('exchange',{actorId:'ada',targetId:'mara',item:'bread',quantity:1})]));s=run(s);assert(s.activities!.programs[0].outcomes.some(o=>o.outcome==='declined'));assert(!s.events.some(e=>e.type==='activity_goods_exchanged'));assert.equal(s.ledger.consumed.bread,0);exact(s);
 let reserved=apply(fresh(old=>{const bakery=old.places.find(p=>p.id==='bakery')!;old.ledger.waste.grain+=bakery.stock.grain-1;bakery.stock.grain=1;}),blueprint([step('collect',{actorId:'ada',targetId:'bakery',item:'grain',quantity:1})]));reserved=run(reserved);assert.equal(reserved.places.find(p=>p.id==='bakery')!.stock.grain,1);assert(reserved.activities!.programs[0].outcomes.some(o=>o.outcome==='blocked'));exact(reserved);
});

test('personal compose submits a real program while preserving an unrelated unfinished aspiration',()=>{
 let s=fresh();const context=projectPersonalContext(s);const d:PersonalDecision={npcId:'wren',triggerKey:context.triggerKey,intentHash:context.intentHash,action:'compose',aspirationId:null,aspiration:null,plan:null,targetId:null,speech:null,belief:null,reason:'Try a real social program while allowing each person to choose.',evidenceIds:[],program:blueprint([step('gesture',{gesture:'dance'})])};s=applyPersonalDecision(s,d,source,'personal-compose');assert.equal(s.activities!.programs.length,1);assert.equal(s.mind!.aspirations.length,0);s=run(s);assert(s.events.some(e=>e.type==='activity_gesture_completed'&&e.payload.gesture==='dance'));assert.equal(applyPersonalDecision(s,d,source,'personal-compose'),s);exact(s);
});

test('known generated props enter private perception, support finite water collection and replay actual resources',()=>{
 let s=fresh();s=applyWorldObjectProposal(s,{kind:'world-object',assetId:'rain-catcher',name:'A painted rain catcher',description:'A small catcher with finite stored water.',position:{x:16,y:17},water:4},{mode:'manual'},'spawn-finite-water');const object=s.worldObjects![0];assert.equal(getKnownWorldObjects(s,'wren').length,0);assert.equal(s.ledger.environment.water,4);s=advanceCozyWorld(s,200);assert(projectPersonalContext(s).knownPlaces.some(p=>p.id===object.id));assert(projectPersonalContext(s).observedObjects?.some(p=>p.id===object.id));const program=blueprint([step('collect',{actorId:'wren',targetId:object.id,item:'water',quantity:2})]);s=apply(s,program);s=run(s);assert.equal(s.worldObjects![0].stock.water,2);assert.equal(s.npcs.find(n=>n.id==='wren')!.inventory.water,2);assert.equal(s.ledger.environment.water,4);exact(s);
});

test('a discovered generated bench supports real personal travel and timed recovery',()=>{
 let s=fresh();s=applyWorldObjectProposal(s,{kind:'world-object',assetId:'garden-bench',name:'A painted garden bench',description:'A small place to sit and rest.',position:{x:25,y:21},water:0},{mode:'manual'},'spawn-bench');const id=s.worldObjects![0].id,context=projectPersonalContext(s),d:PersonalDecision={npcId:'wren',triggerKey:context.triggerKey,intentHash:context.intentHash,action:'rest',aspirationId:null,aspiration:null,plan:null,targetId:id,speech:null,belief:null,reason:'I can rest at the bench I actually noticed.',evidenceIds:[]};s=applyPersonalDecision(s,d,source,'bench-rest');const initial=s.npcs.find(n=>n.id==='wren')!.needs.energy;s=advanceCozyWorld(s,220);assert.equal(s.mind!.plan!.status,'completed');assert(s.npcs.find(n=>n.id==='wren')!.needs.energy>=initial);assert(s.events.some(e=>e.type==='personal_step_completed'&&e.payload.action==='rest'));exact(s);
});

test('activity execution is deterministic across chunking, durable checkpoints and independent forks',()=>{
 let a=apply(fresh()),b=a;a=advanceCozyWorld(a,400);for(let i=0;i<40;i++)b=advanceCozyWorld(b,10);assert.equal(hashCozyWorld(a),hashCozyWorld(b));assert.equal(a.eventHead,b.eventHead);exact(a);const cp=checkpointCozyWorld(a);exact(replayCozyRecording(cp.archive));const parentHash=hashCozyWorld(cp.state),fork=advanceCozyWorld(forkCozyWorld(cp.state,'party-counterfactual'),50);assert.equal(hashCozyWorld(cp.state),parentHash);exact(fork);
});

test('introduced objects require genuine adjacent player interaction, not unknown IDs or remote collection',()=>{
 let s=fresh();s=applyWorldObjectProposal(s,{kind:'world-object',assetId:'rain-catcher',name:'A finite catcher',description:'Four units of actual stored water.',position:{x:5,y:21},water:4},{mode:'manual'},'near-player-catcher');const id=s.worldObjects![0].id;s=dispatchCozyCommand(s,{id:'collect-object',type:'object-interact',objectId:id,action:'collect',item:'water',quantity:2});assert.equal(s.player.inventory.water,4);assert.equal(s.worldObjects![0].stock.water,2);assert.throws(()=>dispatchCozyCommand(s,{id:'missing-object',type:'object-interact',objectId:'missing',action:'inspect',item:null,quantity:0} as CozyCommand),/does not exist/);exact(s);
});


test('an activity can inspect a physically discovered generated object and retain its actual semantic receipt',()=>{
 let s=fresh();s=applyWorldObjectProposal(s,{kind:'world-object',assetId:'luminous-mushroom',name:'A strange painted mushroom',description:'A luminous-looking mushroom without invented magical powers.',position:{x:16,y:17},water:0},{mode:'manual'},'mushroom-observation');s=advanceCozyWorld(s,200);const id=s.worldObjects![0].id;s=apply(s,blueprint([step('observe',{actorId:'wren',targetId:id})]));s=run(s);assert(s.events.some(e=>e.type==='world_object_inspected'&&e.actorId==='wren'&&e.payload.objectId===id));assert(s.activities!.programs[0].outcomes.some(o=>o.outcome==='completed'));exact(s);
});
