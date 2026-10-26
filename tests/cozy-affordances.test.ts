import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeCozyWorld,upgradePersonalCozyWorld,applyWorldObjectProposal,getActivityAffordances,preflightActivityProposal,previewActivityProposal,validateActivityProposal,projectPersonalContext,preflightPersonalDecision,validatePersonalDecision,applyPersonalDecision,advanceCozyWorld,hashCozyWorld,exportCozyRecording,replayCozyRecording,type ActivityBlueprint,type ActivityStep,type CozyWorldState,type PersonalContext,type PersonalDecision,type CozyRecording} from '../lib/cozy';

const provenance={mode:'fixture' as const,model:'synthetic-affordance-admission'};
function fresh(){return upgradePersonalCozyWorld(initializeCozyWorld(137,'affordance-parent'),'affordance-world');}
const step=(action:ActivityStep['action'],changes:Partial<ActivityStep>={}):ActivityStep=>({action,actorId:'wren',targetId:null,item:null,quantity:null,gesture:null,text:null,durationSteps:20,...changes});
const program=(steps:ActivityStep[]):ActivityBlueprint=>({name:'A grounded afternoon',purpose:'Try only physically implemented actions with known sources.',organizerId:'wren',participants:['wren','ada'],venue:'square',steps});
function compose(context:PersonalContext,blueprint:ActivityBlueprint):PersonalDecision{return{npcId:'wren',triggerKey:context.triggerKey,intentHash:context.intentHash,action:'compose',aspirationId:null,aspiration:null,plan:null,targetId:null,speech:null,belief:null,reason:'I can ask someone to try a supported physical activity.',evidenceIds:[],program:blueprint};}
function introduce(state:CozyWorldState,assetId:'rain-catcher'|'garden-bench'|'luminous-mushroom',near=true){const wren=state.npcs.find(n=>n.id==='wren')!;return applyWorldObjectProposal(state,{kind:'world-object',assetId,name:'An observed local prop',description:'A generated registered object with only its actual affordances.',position:near?{x:Math.round(wren.x),y:Math.round(wren.y)}:{x:4,y:6},water:assetId==='rain-catcher'?2:0},provenance,`introduce-${assetId}`);}

test('new activity admission rejects impossible source/item combinations before any physical state changes',()=>{
 const state=fresh(),before=hashCozyWorld(state);
 for(const [targetId,item]of[['well','bread'],['woodpile','water'],['bakery','timber']] as const){const blueprint=program([step('collect',{targetId,item,quantity:1})]);assert.deepEqual(validateActivityProposal(state,blueprint),blueprint,'Legacy shape remains readable for accepted recordings');assert.throws(()=>preflightActivityProposal(state,blueprint),/does not supply/);const preview=previewActivityProposal(state,blueprint);assert.equal(preview.valid,false);assert.match(preview.errors[0],/does not supply/);}
 assert.equal(hashCozyWorld(state),before);
});

test('source affordances describe supported goods without promising present stock or revealing unseen changes',()=>{
 const state=fresh(),before=getActivityAffordances(state,'wren');assert.deepEqual(before,[{targetId:'bakery',collect:['bread','grain'],rest:true},{targetId:'well',collect:['water'],rest:true},{targetId:'woodpile',collect:['timber'],rest:true}]);
 state.places.find(p=>p.id==='well')!.stock.water=0;state.places.find(p=>p.id==='bakery')!.stock.bread=987;state.npcs.find(n=>n.id==='ada')!.memories.push({id:'private-ada-note',actorId:'ada',step:0,type:'npc_dialogue',text:'A private idea never delivered to Wren.',sourceIds:[]});
 assert.deepEqual(getActivityAffordances(state,'wren'),before);assert(preflightActivityProposal(state,program([step('collect',{targetId:'well',item:'water',quantity:1})])),'An empty valid source remains a possible attempt, checked at arrival');
 const projected=projectPersonalContext(state);assert.deepEqual(projected.activityCapabilities!.targetAffordances,before);assert(!JSON.stringify(before).includes('987'));assert(!JSON.stringify(projected).includes('private-ada-note'));
});

test('discovered object semantics admit actual collection/rest and reject unsupported object use',()=>{
 for(const assetId of ['rain-catcher','garden-bench','luminous-mushroom'] as const){const state=introduce(fresh(),assetId),known=getActivityAffordances(state,'wren').find(a=>a.targetId.startsWith('world-object-'))!;assert(known);const collect=program([step('collect',{targetId:known.targetId,item:'water',quantity:1})]),rest=program([step('rest',{targetId:known.targetId})]),observe=program([step('observe',{targetId:known.targetId})]);assert(preflightActivityProposal(state,observe));if(assetId==='rain-catcher'){assert(preflightActivityProposal(state,collect));assert.throws(()=>preflightActivityProposal(state,rest),/no rest affordance/);}else if(assetId==='garden-bench'){assert(preflightActivityProposal(state,rest));assert.throws(()=>preflightActivityProposal(state,collect),/does not supply/);}else{assert.throws(()=>preflightActivityProposal(state,rest),/no rest affordance/);assert.throws(()=>preflightActivityProposal(state,collect),/does not supply/);}}
});

test('foreign object creation and hidden replenishment do not grant private action targets or stock facts',()=>{
 const original=fresh(),before=getActivityAffordances(original,'wren'),far=introduce(original,'rain-catcher',false),object=far.worldObjects![0];assert(!object.noticedBy.wren);assert.deepEqual(getActivityAffordances(far,'wren'),before);assert.throws(()=>preflightActivityProposal(far,program([step('collect',{targetId:object.id,item:'water',quantity:1})])),/finite accessible public supplies/);
 const near=introduce(fresh(),'rain-catcher'),observed=getActivityAffordances(near,'wren');near.worldObjects![0].stock.water=0;assert.deepEqual(getActivityAffordances(near,'wren'),observed);const detached=getActivityAffordances(near,'wren');detached[0].collect.push('water');assert.deepEqual(getActivityAffordances(near,'wren'),observed,'Projection arrays cannot mutate authoritative source semantics');
});

test('new personal contexts preflight supported activity affordances while retained old tickets preserve their contract',()=>{
 const state=fresh(),context=projectPersonalContext(state),blueprint=program([step('collect',{targetId:'well',item:'bread',quantity:1})]),decision=compose(context,blueprint);assert.throws(()=>preflightPersonalDecision(decision,context),/does not supply/);assert.deepEqual(validatePersonalDecision(decision,context),decision);
 const retained=structuredClone(context);delete retained.activityCapabilities!.targetAffordances;assert.deepEqual(preflightPersonalDecision(decision,retained),decision,'Previously frozen tickets without the admission field are not reinterpreted');
 // Replay/application continues to reproduce an old accepted failed attempt. No new goods are invented.
 const accepted=applyPersonalDecision(state,decision,provenance,'previously-accepted-attempt'),later=advanceCozyWorld(accepted,600);assert.equal(later.npcs.find(n=>n.id==='wren')!.inventory.bread,0);assert.equal(hashCozyWorld(replayCozyRecording(exportCozyRecording(later))),hashCozyWorld(later));
});

test('a retained bench-rest intent survives later discoveries that omit its object from the bounded wire context',()=>{
 const parent=initializeCozyWorld(137,'bench-context-parent');const actor=parent.npcs.find(n=>n.id==='wren')!;actor.x=23;actor.y=21;let state=upgradePersonalCozyWorld(parent,'bench-context-world');
 state=applyWorldObjectProposal(state,{kind:'world-object',assetId:'garden-bench',name:'The first known bench',description:'An actual place to rest.',position:{x:23,y:21},water:0},provenance,'first-bench');const first=state.worldObjects![0],frozen=projectPersonalContext(state),decision:PersonalDecision={...compose(frozen,program([step('rest')])),action:'rest',program:null,targetId:first.id};assert(preflightPersonalDecision(decision,frozen));
 for(const [index,position]of [{x:25,y:21},{x:27,y:21},{x:23,y:19}].entries())state=applyWorldObjectProposal(state,{kind:'world-object',assetId:'garden-bench',name:`Another known bench ${index}`,description:'A later discovery with a real rest affordance.',position,water:0},provenance,`later-bench-${index}`);
 const latest=projectPersonalContext(state);assert(!latest.observedObjects!.some(o=>o.id===first.id),'The three-object wire window omitted the older object');assert(!latest.activityCapabilities!.targetAffordances!.some(o=>o.targetId===first.id),'Wire affordances must not advertise an object omitted from their evidence window');assert.equal(latest.intentHash,frozen.intentHash);assert.throws(()=>validatePersonalDecision(decision,{...latest,triggerKey:decision.triggerKey}),/fixed physical target/);
 state=applyPersonalDecision(state,decision,provenance,'accepted-frozen-bench-rest');assert.equal(state.mind!.plan!.steps[0].targetId,first.id);state=advanceCozyWorld(state,220);assert.equal(state.mind!.plan!.status,'completed');assert.equal(hashCozyWorld(replayCozyRecording(exportCozyRecording(state))),hashCozyWorld(state));
});

test('both actual captured V3 browser recordings retain their exact original hashes and operation exports',()=>{
 const cases=[['browser-qa-recording.json','a53fa1c4a471279b5f381c833e242414da13d75e7a03ced7210de61d69c7b9c7'],['browser-qa-party-recording.json','949d6164e3c6336c4bf4c7eee6b0e72525f149c5e163183076a76603d3fb16fd']];
 for(const [filename,expected]of cases){const envelope=JSON.parse(readFileSync(new URL(`../quality/personal-agent/${filename}`,import.meta.url),'utf8')) as {recording:CozyRecording};assert.equal(envelope.recording.finalHash,expected);const state=replayCozyRecording(envelope.recording);assert.equal(hashCozyWorld(state),expected);assert.deepEqual(exportCozyRecording(state),envelope.recording);}
});
