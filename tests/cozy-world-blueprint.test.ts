import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeCozyWorld,validateWorldBlueprint,previewWorldBlueprint,createWorldFromBlueprint,getWorldBlueprintCapabilities,advanceCozyWorld,exportCozyRecording,replayCozyRecording,hashCozyWorld,verifyCozyWorld,projectPersonalContext,type WorldBlueprint} from '../lib/cozy';
const source={mode:'fixture' as const,model:'synthetic-world-contract'};
function blueprint():WorldBlueprint{return{name:'The Lantern Garden',premise:'Three neighbors start a curious community in an existing garden neighborhood.',seed:42,residents:[{id:'wren',name:'Rowan',traits:['Curious explorer','Values independence'],goals:{help:50,belong:30,understand:95}},{id:'ada',name:'Juniper',traits:['Careful craftsperson'],goals:{help:80,belong:55,understand:60}}],wrenValues:{care:50,curiosity:95,belonging:30,autonomy:90},rules:{organizer:'player',venue:'market',foodTarget:4,seedReserve:2,flood:{enabled:false,durationSteps:300}},unsupportedRequests:[{title:'A school among the trees',description:'A place for residents to learn new skills together.',capability:'teaching and learned skills'}]};}
function exact(s:ReturnType<typeof createWorldFromBlueprint>){assert.deepEqual(verifyCozyWorld(s),[]);const r=replayCozyRecording(exportCozyRecording(s));assert.equal(hashCozyWorld(r),hashCozyWorld(s));assert.equal(r.eventHead,s.eventHead);}

test('WorldForge preview shows all three actual merged identities, existing geometry and honest unsupported requests',()=>{
 const b=blueprint(),preview=previewWorldBlueprint(b);assert(preview.valid);assert.equal(preview.worldName,b.name);assert.equal(preview.geometry.generated,false);assert.equal(preview.geometry.width,32);assert.equal(preview.residents.length,3);assert.equal(preview.residents.find(p=>p.id==='wren')!.name,'Rowan');assert.equal(preview.residents.find(p=>p.id==='mara')!.name,'Mara');assert.match(preview.warnings.join(' '),/three starting neighbors/);assert.equal(getWorldBlueprintCapabilities().startingResidents,3);assert.equal(preview.unsupportedRequests.length,1);
});

test('explicit creation applies real names, traits, goals, value weights and supported physical rules',()=>{
 const s=createWorldFromBlueprint(blueprint(),source,'worldforge-created');assert.equal(s.engineVersion,'cozy-engine-3');assert.equal(s.world!.name,'The Lantern Garden');assert.equal(s.npcs.length,3);assert.equal(s.npcs.find(n=>n.id==='wren')!.name,'Rowan');assert.equal(s.npcs.find(n=>n.id==='ada')!.traits[0],'Careful craftsperson');assert.equal(s.npcs.find(n=>n.id==='wren')!.goals.find(g=>g.id==='understand')!.weight,95);assert.equal(s.mind!.values.curiosity,95);assert.equal(s.mind!.values.autonomy,90);assert.equal(s.rules.venue,'market');assert.equal(s.rules.foodTarget,4);assert.equal(s.rules.seedReserve,2);assert.equal(s.festival.venue,'market');assert.equal(projectPersonalContext(s).self.name,'Rowan');assert(s.events.some(e=>e.type==='world_created_from_blueprint'&&e.payload.provenance));exact(s);
});

test('unimplemented world requests are persistent blocked requests rather than fabricated mechanics',()=>{
 let s=createWorldFromBlueprint(blueprint(),source,'unfinished-world');assert.equal(s.mind!.aspirations[0].status,'blocked');assert.equal(s.mind!.capabilityRequests[0].status,'requested');assert.equal(s.mind!.aspirations[0].title,'A school among the trees');assert(!s.events.some(e=>e.type==='school_created'));s=advanceCozyWorld(s,400);assert.equal(s.mind!.aspirations[0].status,'blocked');assert.equal(s.mind!.capabilityRequests[0].status,'requested');assert.equal(s.ledger.initial.grain,11);assert.equal(s.npcs.length,3);exact(s);
});

test('creation is deterministic, independent from earlier saves and rejects executable or unsupported fields',()=>{
 const original=initializeCozyWorld(137,'preserved-world'),hash=hashCozyWorld(original),a=createWorldFromBlueprint(blueprint(),source,'repeatable-world'),b=createWorldFromBlueprint(blueprint(),source,'repeatable-world');assert.equal(hashCozyWorld(a),hashCozyWorld(b));assert.equal(a.eventHead,b.eventHead);assert.equal(hashCozyWorld(original),hash);assert.equal(original.world,undefined);assert.throws(()=>validateWorldBlueprint({...blueprint(),javascript:'makeEveryoneHappy()'}),/bounded named/);assert.throws(()=>validateWorldBlueprint({...blueprint(),residents:[...blueprint().residents,{...blueprint().residents[0]}]}),/distinct/);assert.throws(()=>validateWorldBlueprint({...blueprint(),rules:{...blueprint().rules,gravity:-1}}),/implemented initial/);assert.equal(previewWorldBlueprint({name:'invalid'}).valid,false);exact(a);
});

test('a supported initial flood is real physics, with recorded provenance and exact replay',()=>{
 const b=blueprint();b.rules.flood.enabled=true;b.rules.flood.durationSteps=100;let s=createWorldFromBlueprint(b,source,'wet-created-world');assert(s.flood.active);assert(s.events.some(e=>e.type==='flood_started'));s=advanceCozyWorld(s,101);assert.equal(s.flood.active,false);assert(s.events.some(e=>e.type==='flood_ended'));exact(s);
});
