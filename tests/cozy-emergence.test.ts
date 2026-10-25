import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeCozyWorld,upgradeCozyWorld,advanceCozyWorld,dispatchCozyCommand,applyRulePatch,applyNpcPlan,projectInitiativeContext,selectInitiativeOpportunity,validateSocialInitiative,applySocialInitiative,previewSocialProposalPermission,decideSocialProposal,exportCozyRecording,replayCozyRecording,hashCozyWorld,verifyCozyWorld,forkCozyWorld,checkpointCozyWorld,COZY_ENGINE_VERSION,COZY_V2_ENGINE_VERSION,COZY_V2_CONTENT_VERSION,COZY_MAP,type CozyWorldState,type CozyRecording,type SocialInitiativeDecision,type NpcId,type CozyCommand} from '../lib/cozy';

const fixture={mode:'fixture' as const,model:'synthetic-contract-test'};
let ids=0;
const command=(s:CozyWorldState,c:Omit<CozyCommand,'id'>)=>dispatchCozyCommand(s,{...c,id:`social-test-command-${++ids}`} as CozyCommand);
function walk(s:CozyWorldState,target:{x:number;y:number}){s=command(s,{type:'move',target} as Omit<CozyCommand,'id'>);for(let i=0;s.player.path.length&&i<500;i++)s=advanceCozyWorld(s,4);assert.equal(s.player.path.length,0);return s;}
function upgraded(customize?:(s:CozyWorldState)=>void){const old=advanceCozyWorld(initializeCozyWorld(137,'old-town'),200);customize?.(old);return upgradeCozyWorld(old,'social-town');}
function decision(s:CozyWorldState,npcId:NpcId='wren',overrides:Partial<SocialInitiativeDecision>={}):SocialInitiativeDecision{const context=projectInitiativeContext(s,npcId);return{npcId,triggerKey:context.triggerKey,intentHash:context.intentHash,action:'propose',proposalId:null,targetId:'mara',name:'The Open Table',purpose:'Contribute finite supplies and prepare somewhere to share a meal.',charter:{venue:context.observedFestival?.venue??'square',grainTarget:3,seedFloor:1},reason:'This shared project fits my current goals.',evidenceIds:context.observations.slice(-2).map(m=>m.id),...overrides};}
function proposed(customize?:(s:CozyWorldState)=>void){let s=upgraded(customize);s=applySocialInitiative(s,decision(s),fixture,'first-social-proposal');return s;}
function formed(customize?:(s:CozyWorldState)=>void){let s=proposed(customize);for(let i=0;i<30&&!s.emergence!.proposals[0].deliveries.ada;i++)s=advanceCozyWorld(s,50);assert.equal(s.emergence!.institutions.length,1);return s;}
function complete(s:CozyWorldState){for(let i=0;i<60&&s.festival.phase!=='complete';i++)s=advanceCozyWorld(s,50);assert.equal(s.festival.phase,'complete');return s;}
function exact(s:CozyWorldState){assert.deepEqual(verifyCozyWorld(s),[]);const recording=exportCozyRecording(s),rebuilt=replayCozyRecording(recording);assert.equal(hashCozyWorld(rebuilt),hashCozyWorld(s));assert.equal(rebuilt.eventHead,s.eventHead);}

test('captured pre-change v1 baseline, checkpoint and fork replay their exact original hashes',()=>{
 const golden=JSON.parse(readFileSync(new URL('./fixtures/cozy-v1-golden.json',import.meta.url),'utf8')) as Record<'base'|'continued'|'branched',{recording:CozyRecording;hash:string}>;
 for(const name of ['base','continued','branched'] as const){const entry=golden[name],s=replayCozyRecording(entry.recording);assert.equal(s.engineVersion,'cozy-engine-1');assert.equal(hashCozyWorld(s),entry.hash);assert.deepEqual(exportCozyRecording(s),entry.recording);assert.equal(s.emergence,undefined);}
});

test('upgrade is an explicit separate versioned fork preserving stock, needs, clock, memory and physical intent',()=>{
 let old=initializeCozyWorld(21,'legacy-kept');old=command(old,{type:'move',target:{x:10,y:14}} as Omit<CozyCommand,'id'>);old=advanceCozyWorld(old,17);const oldHash=hashCozyWorld(old),oldRecording=exportCozyRecording(old),s=upgradeCozyWorld(old,'new-cooperation');
 assert.equal(initializeCozyWorld().engineVersion,COZY_ENGINE_VERSION);assert.equal(s.engineVersion,COZY_V2_ENGINE_VERSION);assert.equal(s.contentVersion,COZY_V2_CONTENT_VERSION);assert.equal(s.origin.parentHash,oldHash);assert.equal(hashCozyWorld(old),oldHash);assert.deepEqual(exportCozyRecording(old),oldRecording);for(const field of ['player','npcs','places','plots','ledger','rules','step','tick','day'] as const)assert.deepEqual(s[field],old[field]);assert(s.events.some(e=>e.type==='cozy_world_upgraded'));exact(s);
});

test('frozen initiative contexts contain own evidence and explicit common addresses, never hidden stocks or other minds',()=>{
 const s=upgraded(),c=projectInitiativeContext(s,'wren');assert(c.eligibility.canPropose);assert.equal(selectInitiativeOpportunity(s)?.npcId,'wren');assert.equal(selectInitiativeOpportunity(s,{excludeNpcIds:['wren']})?.npcId,'ada');assert.equal(c.observedPlaces.find(p=>p.id==='bakery')!.stock,null);assert.equal(c.neighbors.length,2);assert(!JSON.stringify(c.neighbors).includes('goals'));assert.equal(c.knownProposals.length,0);assert(new TextEncoder().encode(JSON.stringify(c)).length<=8000);
 const original=hashCozyWorld(s);c.npc.trust=0;c.observedPlaces[0].position.x=999;c.observations.push({id:'foreign',step:0,type:'fake',text:'Not received',sourceIds:[],actorId:null});assert.equal(hashCozyWorld(s),original);
 const fresh=upgradeCozyWorld(initializeCozyWorld(),'empty-social');const opportunity=selectInitiativeOpportunity(fresh)!;assert(opportunity);assert.equal(opportunity.context.eligibility.canPropose,false);const wait=decision(fresh,opportunity.npcId,{action:'wait',targetId:null,name:null,purpose:null,charter:null});assert.doesNotThrow(()=>validateSocialInitiative(wait,opportunity.context));
});

test('clock ticks alone do not stale a frozen initiative; competing actor intent and foreign evidence do',()=>{
 let s=upgraded();const d=decision(s),ctx=projectInitiativeContext(s,'wren');s=advanceCozyWorld(s,70);assert.doesNotThrow(()=>applySocialInitiative(s,d,fixture,'late-but-current-intent'));assert.throws(()=>validateSocialInitiative({...d,evidenceIds:['foreign-private-memory']},ctx),/frozen/);
 const plan={npcId:'wren' as const,action:'wait' as const,targetId:null,quantity:0,durationSteps:300,reason:'A separate accepted intent.',speech:'',evidenceIds:[]};s=applyNpcPlan(s,plan,fixture,'competing-intent');assert.throws(()=>applySocialInitiative(s,d,fixture,'stale-social'),/different intent/);
});

test('proposal recipients cannot respond until its author physically reaches them',()=>{
 let s=proposed();const p=s.emergence!.proposals[0];assert.deepEqual(Object.keys(p.responses),['wren']);assert.equal(p.deliveries.mara,undefined);assert.equal(p.deliveries.ada,undefined);assert.equal(s.emergence!.institutions.length,0);const initial={x:s.npcs[2].x,y:s.npcs[2].y};
 for(let i=0;i<1600&&!s.emergence!.proposals[0].deliveries.mara;i++)s=advanceCozyWorld(s,1);
 const delivered=s.emergence!.proposals[0];assert(delivered.deliveries.mara);const author=s.npcs.find(n=>n.id==='wren')!,recipient=s.npcs.find(n=>n.id==='mara')!;assert(Math.abs(author.x-recipient.x)+Math.abs(author.y-recipient.y)<=1.25);assert(Math.abs(author.x-initial.x)+Math.abs(author.y-initial.y)>1);assert.equal(delivered.responses.mara?.stance,'conditional');assert.equal(delivered.deliveries.ada,undefined);assert.equal(projectInitiativeContext(s,'ada').knownProposals.length,0);exact(s);
});

test('individual goals and trust produce join, conditional and decline without forcing group formation',()=>{
 let s=formed();let p=s.emergence!.proposals[0];assert.equal(p.responses.wren?.stance,'join');assert.equal(p.responses.ada?.stance,'join');assert.equal(p.responses.mara?.stance,'conditional');assert.deepEqual(p.responses.mara?.conditions,['witness-harvest']);assert.deepEqual(s.emergence!.institutions[0].members,['ada','wren']);
 s=proposed(state=>{state.npcs.find(n=>n.id==='ada')!.trust=10;state.npcs.find(n=>n.id==='mara')!.trust=10;});s=advanceCozyWorld(s,1600);p=s.emergence!.proposals[0];assert.equal(p.responses.ada?.stance,'decline');assert.equal(p.responses.mara?.stance,'decline');assert.equal(s.emergence!.institutions.length,0);assert.throws(()=>previewSocialProposalPermission(s,p.id),/two independent members/);exact(s);
});

test('planted wheat is not harvest proof; an actual witnessed harvest can satisfy a private condition',()=>{
 let s=formed();s=walk(s,COZY_MAP.plots[0].position);s=command(s,{type:'plant',plotId:'plot-1'} as Omit<CozyCommand,'id'>);s=command(s,{type:'water',plotId:'plot-1'} as Omit<CozyCommand,'id'>);s=advanceCozyWorld(s,180);assert.equal(s.emergence!.proposals[0].responses.mara?.stance,'conditional');s=command(s,{type:'harvest',plotId:'plot-1'} as Omit<CozyCommand,'id'>);s=advanceCozyWorld(s,20);const p=s.emergence!.proposals[0];assert.equal(p.responses.mara?.stance,'join');assert(s.emergence!.institutions[0].members.includes('mara'));assert(p.responses.mara!.evidenceIds.some(id=>s.npcs.find(n=>n.id==='mara')!.memories.some(m=>m.id===id&&m.type==='crop_harvested')));exact(s);
});

test('owner consent previews actual changes; decline preserves the association without spending shared supplies',()=>{
 let s=formed();const p=s.emergence!.proposals[0],g=s.emergence!.institutions[0],before=structuredClone(s.ledger),bakery=s.places.find(p=>p.id==='bakery')!.stock.grain,wood=s.places.find(p=>p.id==='woodpile')!.stock.timber;
 assert.equal(g.permission,'pending');assert.equal(s.rules.organizer,'player');const preview=previewSocialProposalPermission(s,p.id);assert(preview.valid);assert(preview.changes.some(c=>c.field==='organizer'&&c.to==='villagers'));assert.equal(s.rules.organizer,'player');
 s=decideSocialProposal(s,p.id,'decline','owner-declined');s=advanceCozyWorld(s,500);assert.equal(s.emergence!.institutions[0].permission,'declined');assert.deepEqual(s.emergence!.institutions[0].members,g.members);assert.equal(s.places.find(p=>p.id==='bakery')!.stock.grain,bakery);assert.equal(s.places.find(p=>p.id==='woodpile')!.stock.timber,wood);assert.deepEqual(s.ledger.consumed,before.consumed);assert.equal(s.festival.food,0);assert(!s.events.some(e=>e.type==='institution_task_completed'));exact(s);
});

test('permission is learned at the physical notice rather than granting remote preparation knowledge',()=>{
 let s=formed();const p=s.emergence!.proposals[0];const adaBefore=structuredClone(projectInitiativeContext(s,'ada').observedFestival);s=decideSocialProposal(s,p.id,'approve','owner-posted');const ada=s.npcs.find(n=>n.id==='ada')!,venue=s.places.find(p=>p.id==='square')!.position;
 if(Math.abs(ada.x-venue.x)+Math.abs(ada.y-venue.y)>4){const context=projectInitiativeContext(s,'ada');assert.deepEqual(context.observedFestival,adaBefore);assert.equal(context.institutions[0].permission,'pending');}
 s=advanceCozyWorld(s,500);assert(s.events.some(e=>e.type==='institution_permission_observed'));assert(!s.events.some(e=>e.type==='festival_notice_posted'));exact(s);
});

test('generic goal scoring, not identity roles, allocates real shared work and conserves finite goods',()=>{
 let s=formed(state=>{for(const n of state.npcs){if(n.id==='ada')for(const g of n.goals)g.weight=g.id==='understand'?70:g.id==='help'?65:50;if(n.id==='wren')for(const g of n.goals)g.weight=g.id==='help'?100:g.id==='belong'?40:0;}});const p=s.emergence!.proposals[0];s=decideSocialProposal(s,p.id,'approve','swap-role-permission');s=complete(s);
 assert(s.events.some(e=>e.type==='institution_task_completed'&&e.actorId==='wren'&&e.payload.kind==='food'));assert(s.events.some(e=>e.type==='institution_task_completed'&&e.actorId==='ada'&&e.payload.kind==='setup'));assert.equal(s.ledger.consumed.grain,3);assert.equal(s.ledger.consumed.timber,1);assert(s.events.some(e=>e.type==='setup_started')||s.events.some(e=>e.type==='festival_setup_completed'));assert.equal(s.emergence!.institutions[0].resourceAccount.kind,'festival');assert(!('stock'in s.emergence!.institutions[0].resourceAccount));exact(s);
});

test('membership survives completion, reset, cold checkpoint and a subsequent resource-consuming work round',()=>{
 let s=formed();s=decideSocialProposal(s,s.emergence!.proposals[0].id,'approve','permission-rounds');s=complete(s);const members=[...s.emergence!.institutions[0].members],id=s.emergence!.institutions[0].id,first=s.ledger.consumed.grain;s=checkpointCozyWorld(s).state;s=replayCozyRecording(exportCozyRecording(s));s=command(s,{type:'festival-reset'});s=complete(s);assert.equal(s.emergence!.institutions[0].id,id);assert.deepEqual(s.emergence!.institutions[0].members,members);assert.equal(s.emergence!.institutions[0].resourceAccount.festivalId,2);assert.equal(s.ledger.consumed.grain,first+3);assert.equal(s.ledger.consumed.timber,2);exact(s);
});

test('shortages and physical flooding delay fulfillment without inventing goods or teleporting members',()=>{
 let s=formed();const p=s.emergence!.proposals[0];s=decideSocialProposal(s,p.id,'approve','permission-flood');s=applyRulePatch(s,{flood:{enabled:true,durationSteps:1200}},s.rulesRevision,{mode:'manual'},'flood-association');const original=s.npcs.map(n=>({id:n.id,x:n.x,y:n.y}));s=advanceCozyWorld(s,80);assert(s.flood.active);for(const n of s.npcs){const before=original.find(a=>a.id===n.id)!;assert(Math.abs(n.x-before.x)+Math.abs(n.y-before.y)<=20);}assert.equal(s.ledger.consumed.grain,0);s=advanceCozyWorld(s,1200);assert.equal(s.flood.active,false);s=complete(s);exact(s);
 let poor=formed();poor=decideSocialProposal(poor,poor.emergence!.proposals[0].id,'approve','permission-poor');poor=complete(poor);poor=command(poor,{type:'festival-reset'});poor=complete(poor);poor=command(poor,{type:'festival-reset'});poor=advanceCozyWorld(poor,1500);assert.notEqual(poor.festival.phase,'complete');assert.equal(poor.places.find(p=>p.id==='bakery')!.stock.grain,1);assert.equal(poor.emergence!.institutions[0].status,'waiting-resources');exact(poor);
});

test('social acceptance and owner decisions are idempotent; batching, fork and archive continuation replay exactly',()=>{
 let s=proposed();const d=s.operations.find(op=>op.type==='social-initiative');assert(d&&d.type==='social-initiative');assert.equal(applySocialInitiative(s,d.decision,fixture,d.id),s);const before=hashCozyWorld(s);let a=advanceCozyWorld(s,600),b=s;for(let i=0;i<60;i++)b=advanceCozyWorld(b,10);assert.equal(hashCozyWorld(a),hashCozyWorld(b));assert.equal(a.eventHead,b.eventHead);s=formed();const p=s.emergence!.proposals[0];s=decideSocialProposal(s,p.id,'approve','once-only');assert.equal(decideSocialProposal(s,p.id,'approve','once-only'),s);const parent=hashCozyWorld(s),fork=forkCozyWorld(s,'cooperation-counterfactual');a=advanceCozyWorld(fork,100);assert.equal(hashCozyWorld(s),parent);assert.notEqual(hashCozyWorld(a),before);const archive=checkpointCozyWorld(a);exact(replayCozyRecording(archive.archive));a=advanceCozyWorld(archive.state,50);exact(a);exact(b);
});


test('unseen seed-law and stock changes do not alter private charter responses or reveal remote memberships',()=>{
 let left=proposed(),right=structuredClone(left);left=applyRulePatch(left,{seedReserve:0},left.rulesRevision,{mode:'manual'},'unseen-left-law');right=applyRulePatch(right,{seedReserve:3},right.rulesRevision,{mode:'manual'},'unseen-right-law');
 // Exogenous initial-stock counterfactual: balances remain conserved; neither recipient sees this source.
 right.places.find(p=>p.id==='bakery')!.stock.grain-=2;right.ledger.waste.grain+=2;
 left=advanceCozyWorld(left,1000);right=advanceCozyWorld(right,1000);for(const id of ['ada','mara','wren'] as const){const a=left.emergence!.proposals[0].responses[id]!,b=right.emergence!.proposals[0].responses[id]!;assert.equal(a.stance,b.stance);assert.deepEqual(a.conditions,b.conditions);assert.equal(a.reason,b.reason);}
 const context=projectInitiativeContext(left,'ada'),hidden=structuredClone(left);hidden.emergence!.institutions[0].members.push('mara');hidden.emergence!.proposals[0].responses.mara!.stance='join';assert.deepEqual(projectInitiativeContext(hidden,'ada').institutions,context.institutions);
});
