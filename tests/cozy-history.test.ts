import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeCozyWorld,upgradePersonalCozyWorld,dispatchCozyCommand,type CozyEvent} from '../lib/cozy';
import {observedHistory,observedMoment,observedEvidence,momentSource} from '../components/cozy/cozy-history';

const fresh=()=>upgradePersonalCozyWorld(initializeCozyWorld(137,'history-parent'),'history-world');
const event=(id:string,seq:number,type:string,changes:Partial<CozyEvent>={}):CozyEvent=>({id,seq,type,step:seq,tick:Math.floor(seq/10),actorId:'wren',audience:['player'],payload:{},sourceIds:[],rulesRevision:0,prevHash:'0'.repeat(64),hash:'1'.repeat(64),...changes});

test('observed history excludes private thoughts, future records and unsupported event types without mutating the world',()=>{
 const s=fresh();s.step=20;
 s.events=[event('private',1,'npc_dialogue',{audience:['wren'],payload:{text:'A private secret.'}}),event('public',2,'npc_dialogue',{payload:{text:'A word you actually heard.'}}),event('wish',3,'personal_aspiration_imagined',{payload:{text:'A school was imagined, not built.'}}),event('future',21,'npc_dialogue',{payload:{text:'Not yet spoken.'}})];
 const before=JSON.stringify(s),moments=observedHistory(s);
 assert.deepEqual(moments.map(m=>m.id),['public']);assert.equal(moments[0].detail,'A word you actually heard.');assert.equal(JSON.stringify(s),before);
});

test('history follows explicit evidence links and never treats adjacent events or hidden intermediates as causes',()=>{
 const s=fresh();s.step=20;
 const planted=event('planted',1,'crop_planted',{actorId:'player'}),nearby=event('unlinked',2,'crop_watered',{actorId:'player'}),spoken=event('spoken',3,'npc_dialogue',{payload:{text:'I saw that seed.'},sourceIds:['planted']});
 const privateEvent=event('hidden',4,'npc_dialogue',{audience:['mara'],payload:{text:'Do not publish this.'},sourceIds:['unlinked']}),later=event('later',5,'npc_dialogue',{payload:{text:'Something happened.'},sourceIds:['hidden']});s.events=[planted,nearby,spoken,privateEvent,later];
 assert.deepEqual(observedEvidence(s,'spoken').moments.map(m=>m.id),['planted']);
 const hidden=observedEvidence(s,'later');assert.deepEqual(hidden.moments,[]);assert.equal(hidden.unavailable,true);assert.deepEqual(observedEvidence(s,'hidden'),{moments:[],unavailable:false});
});

test('only the player’s memory receipts can resolve journal links, with bounded cycles and missing evidence',()=>{
 const s=fresh();s.step=20;const root=event('root',1,'crop_planted',{actorId:'player'}),visible=event('visible',5,'npc_dialogue',{payload:{text:'A received observation.'},sourceIds:['my-memory','their-memory','missing']});
 s.events=[root,visible];s.player.memories=[{id:'my-memory',step:1,type:'crop_planted',text:'Observed.',sourceIds:['root','visible'],actorId:'player'}];s.npcs[0].memories=[{id:'their-memory',step:1,type:'crop_planted',text:'Private.',sourceIds:['root'],actorId:'ada'}];
 const linked=observedEvidence(s,'visible');assert.deepEqual(linked.moments.map(m=>m.id),['root']);assert.equal(linked.unavailable,true);
});

test('proposed or started gestures are never described as completed interactions',()=>{
 const s=fresh();s.step=20;
 const payload={gesture:'kiss',leftId:'ada',rightId:'wren',consented:true};
 assert.equal(observedMoment(s,event('start',1,'activity_gesture_started',{payload})),null);
 assert.equal(observedMoment(s,event('proposal',2,'activity_program_proposed',{payload})),null);
 assert.equal(observedMoment(s,event('nonconsent',3,'activity_gesture_completed',{payload:{...payload,consented:false}})),null);
 const completed=observedMoment(s,event('complete',4,'activity_gesture_completed',{payload}));assert.equal(completed?.title,'Ada and Wren shared a kiss.');
 const refused=observedMoment(s,event('refused',5,'activity_step_outcome',{payload:{outcome:'declined',reason:'Mara: I do not feel comfortable with that gesture right now.'}}));assert.equal(refused?.detail,'Mara: I do not feel comfortable with that gesture right now.');assert(!refused?.title.includes('kiss'));
});

test('finite transfers describe the original receipt rather than current or invented resource quantities',()=>{
 const s=fresh();s.step=10;const receipt=event('water',1,'world_object_goods_collected',{actorId:'player',payload:{objectId:'object-1',item:'water',quantity:1,remaining:5}});
 assert.deepEqual(observedMoment(s,receipt)?.detail,'5 water remained in that container.');assert.equal(observedMoment(s,receipt)?.title,'You collected 1 water.');
 assert.equal(observedMoment(s,event('invalid',2,'goods_collected',{payload:{item:'water',quantity:-1}})),null);
});

test('source labels distinguish synthetic and imported claims from recorded Meta assistance',()=>{
 const e=event('meta',1,'rules_applied',{payload:{provenance:{mode:'meta'}}});
 assert.equal(momentSource(e),'Recorded Meta assistance');assert.equal(momentSource(e,true),'Imported record · source unverified');assert.equal(momentSource({...e,payload:{provenance:{mode:'fixture'}}}),'Synthetic test fixture');
});

test('a real gift/dialogue journey yields an exact public evidence chain and keeps speech verbatim',()=>{
 const initial=initializeCozyWorld(137,'gift-parent'),wren=initial.npcs.find(n=>n.id==='wren')!;initial.player.x=wren.x;initial.player.y=wren.y;
 let s=upgradePersonalCozyWorld(initial,'gift-history');s=dispatchCozyCommand(s,{id:'history-gift',type:'gift',npcId:'wren',item:'grain',quantity:1});
 const speech=s.events.find(e=>e.type==='npc_dialogue')!,gift=s.events.find(e=>e.type==='gift_accepted')!;
 assert(speech&&gift);assert.equal(observedMoment(s,speech)?.detail,speech.payload.text);assert(observedEvidence(s,speech.id).moments.some(m=>m.id===gift.id));
});

test('history remains bounded, deduplicated and ordered across malformed caller limits',()=>{
 const s=fresh();s.step=100;s.events=Array.from({length:40},(_,i)=>event(`e-${i}`,i,'npc_dialogue',{payload:{text:`Line ${i}`}}));s.events.push(s.events[39]);
 assert.equal(observedHistory(s,1000).length,20);assert.equal(observedHistory(s,Number.NaN).length,8);assert.equal(observedHistory(s,0).length,1);assert.equal(observedHistory(s)[0].id,'e-39');
});
