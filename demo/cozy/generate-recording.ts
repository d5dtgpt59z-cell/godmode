import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {initializeCozyWorld,advanceCozyWorld,dispatchCozyCommand,applyRulePatch,previewRulePatch,exportCozyRecording,replayCozyRecording,forkCozyWorld,hashCozyWorld,verifyCozyWorld,compareCozyWorlds} from './engine-snapshot/cozy/index';
import type {CozyWorldState,CozyCommand,CozyEvent,Point,NpcId} from './engine-snapshot/cozy/contracts';
const root=fileURLToPath(new URL('.',import.meta.url));mkdirSync(root+'film/assets',{recursive:true});
const write=(name:string,value:unknown)=>writeFileSync(root+name,JSON.stringify(value));
let sequence=0;
const compact=(s:CozyWorldState)=>({step:s.step,tick:s.tick,day:s.day,player:{...s.player,memories:undefined},npcs:s.npcs.map(n=>({...n,memories:undefined})),places:s.places,plots:s.plots,rules:s.rules,rulesRevision:s.rulesRevision,festival:s.festival,flood:s.flood,ledger:s.ledger});
const allEvents=new Map<string,CozyEvent>();const primarySnapshots:ReturnType<typeof compact>[]=[];const beats:Record<string,{step:number;event?:CozyEvent;state?:ReturnType<typeof compact>}>={};
let s=initializeCozyWorld(137,'cozy-demo-main');
function capture(){for(const p of s.places)if(typeof p.name!=='string'||!p.name||typeof p.kind!=='string'||!p.kind)throw new Error('Undefined place name/kind: '+p.id);const errors=verifyCozyWorld(s);if(errors.length)throw new Error(JSON.stringify(errors));for(const e of s.events)allEvents.set(e.id,e);primarySnapshots.push(compact(s));}
function advance(steps:number){while(steps>0){const n=Math.min(3,steps);s=advanceCozyWorld(s,n);capture();steps-=n;}}
function command(value:Record<string,unknown>){s=dispatchCozyCommand(s,{...value,id:`demo-command-${++sequence}`} as CozyCommand);capture();}
function walk(target:Point){command({type:'move',target});let cap=0;while(s.player.path.length){advance(3);if(++cap>200)throw new Error('Walk did not finish');}}
function approach(id:NpcId){let cap=0;while(true){const n=s.npcs.find(n=>n.id===id)!;if(Math.abs(n.x-s.player.x)+Math.abs(n.y-s.player.y)<=1.25)return;walk({x:n.x,y:n.y});if(++cap>20)throw new Error('Could not approach '+id);}}
function event(type:string,actor?:string){const e=[...allEvents.values()].filter(e=>e.type===type&&(!actor||e.actorId===actor)).at(-1);if(!e)throw new Error(`Missing actual event ${type}/${actor}`);return e;}
function beat(id:string,type?:string,actor?:string){beats[id]={step:s.step,event:type?event(type,actor):undefined,state:compact(s)};}
capture();beat('opening');
approach('mara');command({type:'gift',npcId:'mara',item:'grain',quantity:1});beat('mara-response','npc_dialogue','mara');
walk(s.plots[0].position);command({type:'plant',plotId:'plot-1'});beat('planted','crop_planted');advance(15);command({type:'water',plotId:'plot-1'});beat('watered','crop_watered');advance(180);beat('ripe','crop_ripened');command({type:'harvest',plotId:'plot-1'});beat('harvested','crop_harvested');
approach('ada');command({type:'gift',npcId:'ada',item:'grain',quantity:1});beat('ada-response','npc_dialogue','ada');
approach('wren');command({type:'gift',npcId:'wren',item:'grain',quantity:1});beat('wren-response','npc_dialogue','wren');
walk(s.places.find(p=>p.id==='square')!.position);beat('before-rule');
const beforeRule=structuredClone(s);const preview=previewRulePatch(s,{organizer:'villagers'});if(!preview.valid)throw new Error('Invalid exact edit');
s=applyRulePatch(s,{organizer:'villagers'},s.rulesRevision,{mode:'manual',sourceText:'Exact field: organizer = villagers'},'demo-exact-organizer');capture();beat('rule-applied','rules_applied');
for(let i=0;i<400;i++){advance(3);if(s.festival.phase==='complete'&&s.festival.participants.length===3)break;}
if(s.festival.phase!=='complete'||s.festival.participants.length!==3)throw new Error('Physical festival did not complete');
beat('festival-complete','festival_completed');advance(30);beat('ending');
const recording=exportCozyRecording(s);const replay=replayCozyRecording(recording);if(hashCozyWorld(replay)!==hashCozyWorld(s))throw new Error('Primary replay mismatch');
let branch=forkCozyWorld(beforeRule,'cozy-demo-player-organizes');const branchSnapshots=[compact(branch)];const branchEvents=new Map<string,CozyEvent>();
while(branch.step<s.step){branch=advanceCozyWorld(branch,Math.min(3,s.step-branch.step));const errors=verifyCozyWorld(branch);if(errors.length)throw new Error(JSON.stringify(errors));branchSnapshots.push(compact(branch));for(const e of branch.events)branchEvents.set(e.id,e);}
const branchRecording=exportCozyRecording(branch);const replayBranch=replayCozyRecording(branchRecording);if(hashCozyWorld(replayBranch)!==hashCozyWorld(branch))throw new Error('Branch replay mismatch');
const events=[...allEvents.values()].sort((a,b)=>a.seq-b.seq);const bids=events.filter(e=>e.type==='festival_bid');const food=events.find(e=>e.type==='festival_food_added'&&e.actorId==='ada');const setup=events.find(e=>e.type==='festival_setup_completed'&&e.actorId==='mara');const invitations=events.filter(e=>e.type==='festival_invitation'&&e.actorId==='wren');const arrivals=events.filter(e=>e.type==='festival_arrival');
if(!bids.some(e=>e.actorId==='ada')||!bids.some(e=>e.actorId==='mara')||!bids.some(e=>e.actorId==='wren')||!food||!setup||invitations.length<1||arrivals.length<3)throw new Error('Required real festival evidence missing');
const summary={seed:137,mode:'rule-policy',modelCalls:0,metaConnected:false,manualRulePatch:{organizer:'villagers'},preview,beats,bids,food,setup,invitations,arrivals,primary:{step:s.step,festival:s.festival,hash:recording.finalHash,eventHead:recording.eventHead,operations:recording.operations.length,replayVerified:true,inventory:s.player.inventory,ledger:s.ledger,memories:s.npcs.map(n=>({id:n.id,memories:n.memories}))},baseline:{step:branch.step,festival:branch.festival,hash:branchRecording.finalHash,eventHead:branchRecording.eventHead,operations:branchRecording.operations.length,replayVerified:true},comparison:compareCozyWorlds(s,branch),snapshotCount:primarySnapshots.length,branchSnapshotCount:branchSnapshots.length,eventCount:events.length};
write('primary-recording.json',recording);write('baseline-recording.json',branchRecording);write('source-events.json',events);write('baseline-events.json',[...branchEvents.values()]);write('final-state.json',s);write('baseline-final-state.json',branch);write('recording-summary.json',summary);write('film/assets/snapshots.json',{primarySnapshots,branchSnapshots,summary});writeFileSync(root+'film/assets/recording-data.js','window.COZY_CAPTURE='+JSON.stringify({primarySnapshots,branchSnapshots,summary})+';\n');
console.log(JSON.stringify({primary:summary.primary.step,operations:summary.primary.operations,snapshots:summary.snapshotCount,baseline:summary.baseline.festival.phase,festival:s.festival.phase,participants:s.festival.participants,modelCalls:0,replays:true,beats:Object.fromEntries(Object.entries(beats).map(([k,v])=>[k,{step:v.step,text:v.event?.payload.text,type:v.event?.type}]))},null,2));
