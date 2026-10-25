import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {initializePersistentWorld,advanceWorld,applyIntervention,projectObserver,exportRecording,replayRecording,rewindWorld,forkWorld,verifyWorld,hashState} from './engine-snapshot/index';
import type {WorldState,SimEvent} from './engine-snapshot/contracts';
const root=fileURLToPath(new URL('.',import.meta.url));
mkdirSync(root+'film/assets',{recursive:true});
const write=(name:string,value:unknown)=>writeFileSync(root+name,JSON.stringify(value));
const compact=(s:WorldState)=>({tick:s.tick,phase:s.phase,day:s.persistent?.day??1,agents:s.agents.map(a=>({id:a.id,x:a.x,y:a.y,inventory:{...a.inventory},action:a.action,fed:a.fed,intent:a.intent?{action:a.intent.action,phase:a.intent.phase,path:a.intent.path}:null})),places:s.places.map(p=>({id:p.id,kind:p.kind,x:p.x,y:p.y,stock:{...p.stock}})),weather:{...s.weather},crossing:{...s.crossing},metrics:projectObserver(s).metrics});
const events=new Map<string,SimEvent>();const captureEvents=(s:WorldState)=>{for(const e of s.events)events.set(e.id,e)};
let state=advanceWorld(initializePersistentWorld(137,'demo-main'),0,{rulePolicy:true});
const snapshots=[compact(state)];captureEvents(state);
while(state.tick<93600){
 if(state.tick===0)state=applyIntervention(state,{id:'demo-rain',type:'rain'});
 if(state.tick===900)state=applyIntervention(state,{id:'demo-note',type:'message',targetId:'wren',claimId:'granary-twelve'});
 if(state.tick===1800)state=applyIntervention(state,{id:'demo-supplies',type:'resourceDrop',targetId:'square'});
 state=advanceWorld(state,state.tick<21600?30:300,{rulePolicy:true});
 const problems=verifyWorld(state);if(problems.length)throw new Error(JSON.stringify(problems));
 snapshots.push(compact(state));captureEvents(state);
}
const recording=exportRecording(state);const replay=replayRecording(recording);
if(hashState(replay)!==hashState(state))throw new Error('Primary replay mismatch');
const parent=rewindWorld(state,1800);let branch=forkWorld(parent,'demo-no-supply');const forkSnapshots=[compact(branch)];
while(branch.tick<21600){branch=advanceWorld(branch,30,{rulePolicy:true});forkSnapshots.push(compact(branch));}
const branchRecording=exportRecording(branch);const branchReplay=replayRecording(branchRecording);if(hashState(branchReplay)!==hashState(branch))throw new Error('Branch replay mismatch');
const sourceEvents=[...events.values()].sort((a,b)=>a.seq-b.seq);
const bridge=sourceEvents.find(e=>e.type==='bridge_completed');
const read=sourceEvents.find(e=>e.type==='note_read'&&e.actorId==='wren');
const check=sourceEvents.find(e=>e.type==='store_inspected'&&e.actorId==='wren'&&e.tick>(read?.tick??0)&&e.payload.placeId==='granary');
const supply=sourceEvents.find(e=>e.type==='supplies_delivered');
const night=sourceEvents.find(e=>e.type==='night_started');const dawn=sourceEvents.find(e=>e.type==='day_started');
const firstSupper=snapshots.find(s=>s.tick===21600)!;
const summary={seed:137,mode:'rule-policy',worldMode:'persistent',metaCalls:0,durationSimSeconds:state.tick,snapshots:snapshots.length,bridge,read,check,supply,night,dawn,firstSupper:{tick:firstSupper.tick,fed:firstSupper.metrics.fed,bridge:firstSupper.crossing.bridgeBuilt,decisions:firstSupper.metrics.decisions},branch:{forkTick:1800,fed:branch.agents.filter(a=>a.fed).length,bridge:branch.crossing.bridgeBuilt,externalBreadDelivered:branch.ledger.external.bread},primaryHash:recording.finalHash,branchHash:branchRecording.finalHash,primaryReplayVerified:true,branchReplayVerified:true,providerCalls:0,events:sourceEvents.length};
if(!bridge||!read||!check||!supply||!night||!dawn)throw new Error('Required real evidence did not occur: '+JSON.stringify(summary));
write('primary-recording.json',recording);write('fork-recording.json',branchRecording);write('source-events.json',sourceEvents);write('recording-summary.json',summary);
write('film/assets/snapshots.json',{snapshots,forkSnapshots,summary,people:state.agents.map(a=>({id:a.id,name:a.name,role:a.role}))});
writeFileSync(root+'film/assets/recording-data.js','window.GODMODE_CAPTURE='+JSON.stringify({snapshots,forkSnapshots,summary,people:state.agents.map(a=>({id:a.id,name:a.name,role:a.role}))})+';\n');
console.log(JSON.stringify(summary,null,2));
