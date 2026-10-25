import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  AGENT_IDS, HORIZON_SECONDS, advanceWorld, applyDecision, applyIntervention,
  canonicalStringify, checkpointPersistentWorld, chooseRuleDecision, exportRecording, findPath, forkWorld,
  getDueDecisionRequests, hashState, hashValue, initializePersistentWorld, initializeWorld, isWalkable,
  projectAgentContext, projectObserver, replayRecording, rewindWorld, runRuleWorld,
  sha256, validateDecisionProposal, verifyWorld,
  type AgentId, type DecisionProposal, type DecisionTicket, type WorldState,
} from '../lib/sim/index';

const idle = (ticket:DecisionTicket,overrides:Partial<DecisionProposal>={}):DecisionProposal => ({
  action:'wait',targetId:null,item:null,quantity:0,duration:3600,claimId:null,
  utterance:'',goalId:null,evidenceIds:[],beliefUpdates:[],reason:'Controlled test decision.',...overrides,
});
function resolveAll(state:WorldState,select:(ticket:DecisionTicket)=>DecisionProposal=idle):WorldState{
  let next=state;for(const ticket of getDueDecisionRequests(state))next=applyDecision(next,ticket.id,select(ticket),'rule');return next;
}
function until(state:WorldState,tick:number):WorldState{return advanceWorld(state,tick-state.tick,{rulePolicy:true});}
const agent = (state:WorldState,id:AgentId) => state.agents.find(a=>a.id===id)!;
const place = (state:WorldState,id:string) => state.places.find(p=>p.id===id)!;
let afternoon:WorldState|undefined;
const baseline=()=>afternoon??=runRuleWorld(7);

test('canonical SHA-256 matches independent Node implementation including Unicode and long inputs',()=>{
  for(const value of ['', 'abc', 'Bellwether ☔ 24 residents', 'x'.repeat(10000)])assert.equal(sha256(value),createHash('sha256').update(value).digest('hex'));
  assert.equal(canonicalStringify({z:[3,2],a:1}),'{"a":1,"z":[3,2]}');
  assert.throws(()=>canonicalStringify({bad:Infinity}),/Non-finite/);
});

test('24 stable identities have distinct walkable spawn tiles and authored individual needs and priorities',()=>{
  const state=initializeWorld(7);
  assert.deepEqual(state.agents.map(a=>a.id),[...AGENT_IDS]);
  assert.equal(new Set(state.agents.map(a=>`${a.x},${a.y}`)).size,24);
  assert(state.agents.every(a=>isWalkable(state,a.x,a.y)));
  assert(new Set(state.agents.map(a=>a.needs.hunger)).size>12);
  assert(new Set(state.agents.map(a=>a.goals.map(g=>g.weight).join(','))).size>12);
  assert.equal(getDueDecisionRequests(state).length,24);
  assert(getDueDecisionRequests(state).every(t=>t.triggerKind==='bootstrap'&&t.snapshotTick===0&&t.effectiveTick===0));
  assert.deepEqual(verifyWorld(state),[]);
});

test('advance without completed decisions stops at a logical barrier and never invents AI',()=>{
  const state=initializeWorld(1);const frozen=canonicalStringify(state);
  const held=advanceWorld(state,300);
  assert.equal(held.tick,0);assert.equal(held.blocked,true);assert.equal(held.decisionCount,0);
  assert.equal(projectObserver(held).mode,'rule');
  assert.equal(canonicalStringify(state),frozen,'input state remains unchanged');
  const running=advanceWorld(held,1,{rulePolicy:true});
  assert.equal(running.tick,1);assert.equal(running.decisionCount,24);
  assert(running.agents.every(a=>a.decisions.meta===0&&a.decisions.rule===1));
});

test('network completion order cannot change canonical commit order or world state',()=>{
  const initial=initializeWorld(3);const requests=getDueDecisionRequests(initial);
  let forward=initial,backward=initial;
  for(const ticket of requests)forward=applyDecision(forward,ticket.id,chooseRuleDecision(ticket.context),'rule');
  for(const ticket of requests.toReversed())backward=applyDecision(backward,ticket.id,chooseRuleDecision(ticket.context),'rule');
  assert.equal(hashState(forward),hashState(backward),'uncommitted resolution arrival is excluded from simulation hash');
  forward=advanceWorld(forward,300);backward=advanceWorld(backward,300);
  assert.equal(hashState(forward),hashState(backward));assert.equal(forward.eventHead,backward.eventHead);
  assert.deepEqual(forward.events,backward.events);
});

test('one-second ticks produce the same world under different client advance chunk sizes',()=>{
  let single=initializeWorld(8),chunked=initializeWorld(8);
  for(let tick=0;tick<1800;tick++)single=advanceWorld(single,1,{rulePolicy:true});
  while(chunked.tick<1800)chunked=advanceWorld(chunked,Math.min(137,1800-chunked.tick),{rulePolicy:true});
  assert.equal(hashState(single),hashState(chunked));assert.equal(single.eventHead,chunked.eventHead);
  assert.deepEqual(verifyWorld(single),[]);
});

test('projected residents receive local knowledge rather than observer-only stock or unread note claims',()=>{
  let state=initializeWorld(1);
  assert.equal(projectAgentContext(state,'bo').places.find(p=>p.id==='granary')!.stock,null);
  assert.equal(projectAgentContext(state,'bo').places.some(p=>p.id==='home-2'),false);
  assert.equal(projectAgentContext(state,'bo').claims.some(c=>c.id==='granary-twelve'),false);
  state=applyIntervention(state,{id:'private-note',type:'message',targetId:'wren',claimId:'granary-twelve'});
  state=until(state,300);
  assert.equal(projectAgentContext(state,'wren').notes.length,1);
  assert.equal(projectAgentContext(state,'wren').claims.some(c=>c.id==='granary-twelve'),false,'delivered note has not been read');
  assert.equal(projectAgentContext(state,'bo').notes.length,0);
  state=until(state,6000);
  const wren=projectAgentContext(state,'wren');
  assert(wren.notes[0].read);assert(wren.observations.some(o=>o.channel==='read'&&o.claimId==='granary-twelve'));
  assert.equal(place(state,'granary').stock.grain>12,false,'a received false claim cannot create grain');
  assert.deepEqual(verifyWorld(state),[]);
});

test('decision validation rejects unavailable evidence and converts bad output to an explicit deterministic fallback',()=>{
  const initial=initializeWorld(4);const ticket=getDueDecisionRequests(initial)[0];
  const proposal=idle(ticket,{beliefUpdates:[{claimId:'granary-twelve',stance:'believe',confidence:99,evidenceIds:['unseen-event/o/iona']}]});
  assert.match(validateDecisionProposal(proposal,ticket.context)!,/citation/);
  const invalid=applyDecision(initial,ticket.id,proposal,'meta');
  assert.equal(invalid.tickets[0].provenance,'fallback');assert(invalid.tickets[0].failure);
  assert.equal(initial.tickets[0].status,'pending');
  assert.throws(()=>applyDecision(invalid,ticket.id,idle(ticket),'meta'),/already resolved/);
  const settled=advanceWorld(invalid,0,{rulePolicy:true});
  assert.equal(agent(settled,ticket.agentId).decisions.fallback,1);assert.equal(projectObserver(settled).metrics.metaDecisions,0);
});

test('manual resource actions require real quantities, and private stores reject unauthorized collection',()=>{
  let state=initializeWorld(1);agent(state,'mara').x=15;agent(state,'mara').y=10;
  state=resolveAll(state,t=>t.agentId==='mara'?idle(t,{action:'collect',targetId:'granary',item:'grain',quantity:1}):idle(t));
  state=advanceWorld(state,5);
  assert.equal(agent(state,'mara').inventory.grain,0);assert.equal(place(state,'granary').stock.grain,6);
  assert(state.events.some(e=>e.type==='plan_failed'&&e.actorId==='mara'));
  assert.deepEqual(verifyWorld(state),[]);
  const ticket=getDueDecisionRequests(initializeWorld(2))[0];
  assert.match(validateDecisionProposal(idle(ticket,{action:'collect',targetId:'granary',item:'grain',quantity:0}),ticket.context)!,/positive quantity/);
});

test('competing collectors reserve finite goods and cannot both claim the final loaf',()=>{
  let state=initializeWorld(1);
  state=resolveAll(state,t=>['bo','joss','una'].includes(t.agentId)?idle(t,{action:'collect',targetId:'home-1',item:'bread',quantity:1}):idle(t));
  state=advanceWorld(state,20);
  const carried=['bo','joss','una'].reduce((n,id)=>n+agent(state,id as AgentId).inventory.bread,0);
  assert.equal(carried,1);assert.equal(place(state,'home-1').stock.bread,0);
  assert.equal(state.reservations.length,0);assert.deepEqual(verifyWorld(state),[]);
});

test('a resident can eat a reserved public meal while carrying a full pack of other goods',()=>{
  let state=initializeWorld(1);const mara=agent(state,'mara');mara.x=44;mara.y=15;mara.inventory.water=2;place(state,'well').stock.water=0;
  state=resolveAll(state,t=>t.agentId==='mara'?idle(t,{action:'eat',targetId:'bakery',item:'bread',quantity:1}):idle(t));
  state=advanceWorld(state,5);assert.equal(agent(state,'mara').fed,true);assert.equal(agent(state,'mara').inventory.water,2);
  assert.equal(place(state,'bakery').stock.bread,1);assert.equal(state.ledger.eaten.bread,1);assert.deepEqual(verifyWorld(state),[]);
});

test('offered goods do not transfer until the recipient independently accepts them',()=>{
  let state=initializeWorld(1);const donor=agent(state,'bo'),recipient=agent(state,'joss');
  donor.inventory.bread=1;place(state,'home-1').stock.bread=0;
  state=resolveAll(state,t=>t.agentId==='bo'?idle(t,{action:'give',targetId:'joss',item:'bread',quantity:1}):idle(t));
  state=advanceWorld(state,10);
  assert.equal(agent(state,'bo').inventory.bread,1);assert.equal(agent(state,'joss').inventory.bread,0);
  const offer=state.offers.find(o=>o.fromId==='bo')!;assert.equal(offer.status,'pending');
  // This fixture assigns a decision at a controlled epoch; no transfer API bypass is used.
  const accept=idle({} as DecisionTicket,{action:'give',targetId:'bo',item:'bread',quantity:1});
  const ticket={...state.tickets[0],id:'test-accept',agentId:'joss' as AgentId,triggerKind:'event' as const,snapshotTick:state.tick,effectiveTick:300,context:projectAgentContext(state,'joss'),requestHash:'controlled',status:'pending' as const,proposal:null,provenance:'rule' as const,failure:null};
  state.tickets.push(ticket);state=applyDecision(state,ticket.id,accept,'rule');state=advanceWorld(state,295);
  assert.equal(agent(state,'bo').inventory.bread,0);assert.equal(agent(state,'joss').inventory.bread,1);
  assert.equal(state.offers.find(o=>o.id===offer.id)!.status,'accepted');assert.deepEqual(verifyWorld(state),[]);
  assert.equal(recipient.inventory.bread,0,'the original input resident was not mutated');
});

test('rain, supply deliveries, and notes obey finite budgets and tick-boundary order',()=>{
  let state=initializeWorld(1);state=advanceWorld(state,17,{rulePolicy:true});
  state=applyIntervention(state,{id:'rain',type:'rain'});
  state=applyIntervention(state,{id:'drop1',type:'resourceDrop',targetId:'supper'});
  assert.equal(state.weather.rainingUntil,0);assert.equal(state.queuedInterventions[0].effectiveTick,300);
  assert.equal(applyIntervention(state,{id:'drop1',type:'resourceDrop',targetId:'supper'}),state,'duplicate command is idempotent');
  state=applyIntervention(state,{id:'drop2',type:'resourceDrop',targetId:'inn'});state=applyIntervention(state,{id:'drop3',type:'resourceDrop',targetId:'square'});
  assert.throws(()=>applyIntervention(state,{id:'drop4',type:'resourceDrop'}),/fully allocated/);
  assert.throws(()=>applyIntervention(state,{id:'rain2',type:'rain'}),/one rain/);
  state=until(state,300);
  assert.equal(state.ledger.environment.water,4);assert.equal(state.ledger.external.bread,12);assert.equal(state.externalBread,0);
  const boundary=state.events.filter(e=>e.tick===300);const rainIndex=boundary.findIndex(e=>e.type==='rain_started');const decisionIndex=boundary.findIndex(e=>e.type==='decision_scheduled');
  assert(rainIndex>=0&&decisionIndex>rainIndex,'commands are authoritative before the next frozen decision contexts');
  assert.equal(isWalkable(state,32,24),false);assert.equal(findPath(state,{x:31,y:24},{x:33,y:24}),null);
  assert.deepEqual(verifyWorld(state),[]);
});

test('afternoon baseline is a real finite economy with 24 unique meal accounts and a constructed crossing',()=>{
  const state=baseline();assert.equal(state.tick,HORIZON_SECONDS);assert(state.ended);
  assert.equal(state.agents.length,24);assert.equal(state.ledger.eaten.bread,state.agents.filter(a=>a.fed).length);
  assert.equal(state.ledger.produced.bread,8,'two initial water units permit exactly two recipes');
  assert.equal(state.ledger.eaten.bread,14);assert.equal(state.crossing.bridgeBuilt,true);
  assert.equal(state.crossing.workSeconds,3600);assert(state.ledger.recipeConsumed.timber>=2);
  assert.equal(state.decisionCount,384);assert.equal(state.eventDecisionCount,96);
  assert(Object.values(state.heartbeatCount).every(n=>n===12));assert.equal(state.tickets.length,0);
  assert(state.agents.every(a=>a.decisions.meta===0&&a.observations.length<=24&&a.memories.length<=48));
  assert.deepEqual(verifyWorld(state),[]);assert(JSON.stringify(state).length<1_000_000);
});

test('finite interventions change actual resources; all 24 can eat without a scripted success outcome',()=>{
  const state=runRuleWorld(7,[{at:300,command:{id:'rain',type:'rain'}},{at:900,command:{id:'drop',type:'resourceDrop',targetId:'supper'}}]);
  assert.equal(state.ledger.external.bread,4);assert.equal(state.ledger.environment.water,4);
  assert.equal(state.agents.filter(a=>a.fed).length,24);assert.equal(state.ledger.eaten.bread,24);
  assert.equal(projectObserver(state).mode,'rule');assert.deepEqual(verifyWorld(state),[]);
});

test('false notes remain sourced claims and can be rejected using first-hand observations',()=>{
  const state=runRuleWorld(7,[{at:0,command:{id:'note',type:'message',targetId:'wren',claimId:'granary-twelve'}}]);
  const wren=agent(state,'wren');const reading=wren.observations.find(o=>o.channel==='read'&&o.claimId==='granary-twelve');
  assert(reading,'bounded semantic memory retains the actual reading receipt');
  const belief=wren.beliefs['granary-twelve'];assert(belief);assert.equal(belief.stance,'reject');
  assert(belief.evidenceIds.every(id=>id.endsWith('/o/wren')));
  assert.equal(state.ledger.initial.grain,6);assert.deepEqual(verifyWorld(state),[]);
});

test('complete recordings replay without inference and reject altered operations or checkpoint metadata',()=>{
  const state=baseline();const recording=exportRecording(state);
  assert.equal(hashState(replayRecording(recording)),hashState(state));
  assert.equal(replayRecording(recording).eventHead,state.eventHead);
  const tampered=structuredClone(recording);tampered.operations[0]={type:'advance',seconds:1,rulePolicy:false};
  assert.throws(()=>replayRecording(tampered),/mismatch|missing/);
  const checkpoints=structuredClone(recording);checkpoints.checkpoints[0].eventHash='0'.repeat(64);
  assert.throws(()=>replayRecording(checkpoints),/mismatch/);
});

test('rewind reconstructs exact earlier history and fork isolates new interventions from its parent',()=>{
  const original=baseline(),parentHash=hashState(original);const earlier=rewindWorld(original,3600);
  const direct=until(initializeWorld(7),3600);
  assert.equal(hashState(earlier),hashState(direct));assert.equal(earlier.eventHead,direct.eventHead);
  let fork=forkWorld(earlier,'alternative');assert.equal(fork.parentBranchId,'main');
  assert(fork.tickets.every(t=>t.id.startsWith('alternative/')&&t.status==='pending'));
  fork=applyIntervention(fork,{id:'branch-rain',type:'rain'});fork=until(fork,7200);
  assert.equal(original.ledger.environment.water,0);assert.equal(fork.ledger.environment.water,4);
  assert.equal(hashState(original),parentHash);assert.deepEqual(verifyWorld(fork),[]);
  assert.equal(hashState(replayRecording(exportRecording(fork))),hashState(fork));
  assert.throws(()=>rewindWorld(fork,3000),/predates/,'a branch archive begins at its actual fork checkpoint');
});

test('rewind cannot inherit answers to future decisions from a live recording',()=>{
  let state=initializeWorld(3);state=resolveAll(state);state=advanceWorld(state,600);
  const pending=getDueDecisionRequests(state);assert(pending.length>0);
  for(const ticket of pending)state=applyDecision(state,ticket.id,idle(ticket),'meta');
  const rewind=rewindWorld(state,state.tick);
  assert(rewind.tickets.every(t=>t.status==='pending'),'future model resolutions are excluded from an earlier settled checkpoint');
  const fork=forkWorld(rewind,'private-future');assert(fork.tickets.every(t=>t.status==='pending'&&t.proposal===null));
});

test('observer projections and decision requests cannot mutate authoritative private state',()=>{
  const state=initializeWorld(1);const hash=hashState(state);
  const observer=projectObserver(state);observer.agents[0].inventory.grain=999;observer.events[0].payload.seed=999;observer.places[0].stock.grain=999;
  const tickets=getDueDecisionRequests(state);tickets[0].context.agent.name='Changed';
  assert.equal(hashState(state),hash);assert.equal(state.events[0].payload.seed,1);
  const eventBody={...state.events[0]};Reflect.deleteProperty(eventBody,'hash');assert.equal(state.events[0].hash,hashValue(eventBody));
});

test('imported branch checkpoints reject future observations and unknown belief evidence',()=>{
  const state=advanceWorld(initializeWorld(1),300,{rulePolicy:true});const forged=structuredClone(state);
  agent(forged,'iona').observations.push({id:'forged:999/o/iona',eventId:'forged:999',tick:99999,channel:'self',text:'Unreceived future private information.',claimId:'granary-twelve',sourceId:'una'});
  agent(forged,'iona').beliefs['not-a-real-claim']={claimId:'not-a-real-claim',stance:'believe',confidence:100,evidenceIds:['foreign-observation-not-received'],updatedAt:99999};
  assert(verifyWorld(forged).some(e=>e.code==='knowledge'));assert(verifyWorld(forged).some(e=>e.code==='belief'));
  const recording=exportRecording(forged);recording.origin={...forged.origin,checkpointState:canonicalStringify(forged)};recording.operations=[];
  assert.throws(()=>replayRecording(recording),/Invalid branch checkpoint/);
});

test('persistent mode continues beyond the experiment horizon and residents go home and rest at night',()=>{
  let state=initializePersistentWorld(9,'persistent');
  state=advanceWorld(state,21600,{rulePolicy:true});assert.equal(state.ended,false);assert.equal(state.tick,21600);
  const identities=state.agents.map(a=>a.id);state=advanceWorld(state,18000,{rulePolicy:true});
  assert.equal(state.phase,'running');assert.equal(state.persistent!.day,1);
  assert(state.agents.every(a=>a.x===place(state,a.homeId).x&&a.y===place(state,a.homeId).y));
  assert(state.agents.every(a=>a.needs.fatigue<=5),'night rest reduces actual fatigue');
  assert.deepEqual(state.agents.map(a=>a.id),identities);assert.deepEqual(verifyWorld(state),[]);
});

test('a persistent dawn logs finite ecology production and preserves resident histories and conservation',()=>{
  let state=initializePersistentWorld(10,'daily');state=advanceWorld(state,64500,{rulePolicy:true});
  const seq=state.eventSeq,previousFed=state.agents.filter(a=>a.fed).length;assert(previousFed>0);
  state=advanceWorld(state,300,{rulePolicy:true});
  assert.equal(state.tick,64800);assert.equal(state.persistent!.day,2);assert.equal(state.persistent!.lastDawn,64800);
  assert.equal(state.agents.filter(a=>a.fed).length,0);assert.equal(state.eventSeq>seq,true);
  assert.equal(state.ledger.environment.grain,6);assert.equal(state.ledger.environment.water,6);assert.equal(state.ledger.environment.timber,8);
  assert.equal(state.events.filter(e=>e.type==='renewable_resources_arrived').length,3);
  assert(state.agents.every(a=>a.observations.length<=24&&a.memories.length<=48));
  assert.equal(state.persistent!.totalMeals,state.ledger.eaten.bread);assert.deepEqual(verifyWorld(state),[]);
  state=advanceWorld(state,43200,{rulePolicy:true});
  assert.equal(state.tick,108000);assert.equal(state.agents.filter(a=>a.fed).length,24,'finite daily water supports a complete next-day supper');
  assert.deepEqual(verifyWorld(state),[]);
});

test('persistent background chunking and archival rollover preserve exact deterministic replay',()=>{
  let coarse=initializePersistentWorld(11,'continuous'),fine=initializePersistentWorld(11,'continuous');
  coarse=advanceWorld(coarse,86400,{rulePolicy:true});
  for(let i=0;i<288;i++)fine=advanceWorld(fine,300,{rulePolicy:true});
  assert.equal(hashState(coarse),hashState(fine));assert.equal(coarse.eventHead,fine.eventHead);
  assert.equal(coarse.ended,false);assert.equal(coarse.persistent!.day,2);
  assert(coarse.checkpoints.length<=25);assert.deepEqual(verifyWorld(coarse),[]);
  const {state,archive}=checkpointPersistentWorld(coarse);
  assert.equal(hashState(replayRecording(archive)),hashState(coarse));assert.equal(state.origin.priorArchiveHash,archive.finalHash);
  assert.equal(state.operations.length,0);assert.equal(state.agents[0].decisions.rule,coarse.agents[0].decisions.rule);
  const continued=advanceWorld(state,3600,{rulePolicy:true});
  assert.equal(hashState(replayRecording(exportRecording(continued))),hashState(continued));
  assert.deepEqual(verifyWorld(continued),[]);assert(JSON.stringify(continued).length<1_800_000);
});

function spendDailyInterventions(state:WorldState,prefix:string):WorldState{
  let next=applyIntervention(state,{id:`${prefix}-rain`,type:'rain'});
  for(let index=0;index<3;index++){
    next=applyIntervention(next,{id:`${prefix}-drop-${index}`,type:'resourceDrop',targetId:'supper'});
    next=applyIntervention(next,{id:`${prefix}-note-${index}`,type:'message',targetId:'wren',claimId:'granary-twelve'});
  }
  return next;
}

test('persistent dawn renews daily interventions through an explicit outside allocation without creating town food',()=>{
  let state=spendDailyInterventions(initializePersistentWorld(15,'daily-quota'),'day1');
  state=advanceWorld(state,64200,{rulePolicy:true});
  assert.deepEqual(state.interventionCounts,{rain:1,resourceDrop:3,message:3});assert.equal(state.externalBread,0);
  assert.throws(()=>applyIntervention(state,{id:'too-many-today',type:'rain'}),/one rain/);
  const delivered=state.ledger.external.bread;
  state=advanceWorld(state,600,{rulePolicy:true});
  assert.equal(state.persistent!.day,2);assert.deepEqual(state.interventionCounts,{rain:0,resourceDrop:0,message:0});
  assert.equal(state.externalBread,12);assert.equal(state.ledger.external.bread,delivered,'reserve allocation adds no town food');
  assert.equal(state.persistent!.outsideBreadAllocated,24);
  const allocation=state.events.find(e=>e.type==='outside_reserve_allocated')!;
  assert.deepEqual(allocation.audience,[]);assert.equal(allocation.payload.priorRemaining,0);assert.equal(allocation.payload.allocated,12);assert.equal(allocation.payload.townFoodAdded,0);assert.equal(allocation.payload.source,'daily external observer allowance');
  state=spendDailyInterventions(state,'day2');state=advanceWorld(state,300,{rulePolicy:true});
  assert.equal(state.notes.length,6);assert.equal(state.ledger.external.bread,24);assert.equal(state.externalBread,0);
  assert.equal(state.weather.rainStartedAt,65100);assert.equal(state.persistent!.outsideBreadAllocated,24);
  assert.deepEqual(verifyWorld(state),[]);assert.equal(hashState(replayRecording(exportRecording(state))),hashState(state));
});

test('commands delivered exactly at dawn count against the new day rather than bypassing its limits',()=>{
  let state=spendDailyInterventions(initializePersistentWorld(16,'dawn-boundary'),'first');
  state=advanceWorld(state,64500,{rulePolicy:true});
  state=spendDailyInterventions(state,'second');
  assert.deepEqual(state.interventionCounts,{rain:1,resourceDrop:3,message:3},'old-day counters stay intact while next day is reserved');
  assert.throws(()=>applyIntervention(state,{id:'fourth-next-day',type:'resourceDrop'}),/fully allocated/);
  state=advanceWorld(state,300,{rulePolicy:true});
  assert.deepEqual(state.interventionCounts,{rain:1,resourceDrop:3,message:3});assert.equal(state.externalBread,0);
  assert.equal(state.ledger.external.bread,24);assert.equal(state.persistent!.outsideBreadAllocated,24);
  assert.throws(()=>applyIntervention(state,{id:'another-new-day-rain',type:'rain'}),/one rain/);
  assert.deepEqual(verifyWorld(state),[]);assert.equal(hashState(replayRecording(exportRecording(state))),hashState(state));
});
