import { AGENT_IDS, CONTENT_VERSION, ENGINE_VERSION, EPOCH_SECONDS, HORIZON_SECONDS, type Action, type AdvanceOptions, type Agent, type AgentContext, type AgentId, type Checkpoint, type DecisionProposal, type DecisionTicket, type Good, type Goods, type Intervention, type InvariantViolation, type Observation, type ObserverView, type Place, type Provenance, type Recording, type SimEvent, type WorldState, type WorldMode } from './contracts';
import { canonicalStringify, hashValue } from './canonical';
import { distance, findPath } from './pathfinding';
import { createAgents, createClaims, createPlaces, emptyGoods, FORD_Y, isWalkable, mayCollect, RIVER_X, WORLD_HEIGHT, WORLD_WIDTH } from './scenario';

const GOODS:Good[]=['grain','water','timber','bread'];
const ACTIONS:Action[]=['move','work','collect','deliver','give','request','eat','inspect','talk','read','wait'];
const MAX_EVENTS=800, MAX_OBSERVATIONS=24;
const agentById=(s:WorldState,id:string)=>s.agents.find(a=>a.id===id);
const placeById=(s:WorldState,id:string|null)=>s.places.find(p=>p.id===id);
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const nowLabel=(tick:number)=>`${String((12+Math.floor(tick/3600))%24).padStart(2,'0')}:${String(Math.floor(tick/60)%60).padStart(2,'0')}`;
const dayAt=(tick:number)=>Math.floor((tick+21600)/86400)+1;
const queuedQuotas=(s:WorldState,day:number)=>s.queuedInterventions.filter(c=>dayAt(c.effectiveTick)===day).reduce((counts,c)=>({...counts,[c.type]:counts[c.type]+1}),{rain:0,resourceDrop:0,message:0});
function copy(s:WorldState):WorldState {
  return {...s,persistent:s.persistent?{...s.persistent}:null,agents:s.agents.map(a=>({...a,inventory:{...a.inventory},needs:{...a.needs},intent:a.intent?{...a.intent,path:[...a.intent.path],evidenceIds:[...a.intent.evidenceIds]}:null,knownPlaces:[...a.knownPlaces],observations:[...a.observations],memories:[...a.memories],beliefs:{...a.beliefs},relationships:{...a.relationships},goals:a.goals.map(g=>({...g})),decisions:{...a.decisions},contributions:{...a.contributions}})),places:s.places.map(p=>({...p,stock:{...p.stock}})),claims:[...s.claims],notes:s.notes.map(n=>({...n})),offers:s.offers.map(o=>({...o})),reservations:s.reservations.map(r=>({...r})),events:[...s.events],checkpoints:[...s.checkpoints],tickets:s.tickets.map(t=>({...t})),queuedInterventions:[...s.queuedInterventions],heartbeatCount:{...s.heartbeatCount},triggers:Object.fromEntries(Object.entries(s.triggers).map(([id,v])=>[id,[...v!]])),interventionCounts:{...s.interventionCounts},weather:{...s.weather},crossing:{...s.crossing},oven:{...s.oven},ledger:{initial:{...s.ledger.initial},external:{...s.ledger.external},environment:{...s.ledger.environment},produced:{...s.ledger.produced},recipeConsumed:{...s.ledger.recipeConsumed},eaten:{...s.ledger.eaten},waste:{...s.ledger.waste}},operations:[...s.operations],origin:{...s.origin}};
}
function trigger(s:WorldState,id:AgentId,reason:string){const list=s.triggers[id]??[];if(!list.includes(reason))s.triggers[id]=[...list,reason].slice(-4);}
function emit(s:WorldState,type:string,actorId:string|null,payload:Record<string,unknown>,audience:AgentId[]=[],sourceIds:string[]=[],phase='physical'):SimEvent {
  const body={id:`${s.branchId}:${s.eventSeq+1}`,seq:s.eventSeq+1,branchId:s.branchId,tick:s.tick,phase,type,actorId,audience:[...audience].sort(),payload,sourceIds:[...sourceIds],prevHash:s.eventHead};
  const event={...body,hash:hashValue(body)};s.eventSeq=event.seq;s.eventHead=event.hash;s.events.push(event);if(s.events.length>MAX_EVENTS)s.events.splice(0,s.events.length-MAX_EVENTS);return event;
}
/** Explicit bounded memory selection preserves received claims alongside recent activity. */
function retainedObservations(observations:Observation[],limit:number):Observation[]{
  const selected=new Set([...observations.filter(o=>o.channel==='read').slice(-3),...observations.filter(o=>o.claimId&&(o.channel==='self'||o.channel==='saw')).slice(-3),...observations.filter(o=>o.claimId&&o.channel==='heard').slice(-2)].map(o=>o.id));
  for(let index=observations.length-1;index>=0&&selected.size<limit;index--)selected.add(observations[index].id);
  return observations.filter(o=>selected.has(o.id));
}
function observe(s:WorldState,event:SimEvent,ids:AgentId[],text:string,channel:'saw'|'heard'|'read'|'self'='saw',claimId:string|null=null,sourceId:string|null=null,details?:{placeId?:string;stock?:Goods}) {
  for(const id of ids){const agent=agentById(s,id);if(!agent)continue;const observation={id:`${event.id}/o/${id}`,eventId:event.id,tick:s.tick,channel,text,claimId,sourceId,...(details?{details:clone(details)}:{})};if(agent.observations.some(o=>o.id===observation.id))continue;agent.observations=retainedObservations([...agent.observations,observation],MAX_OBSERVATIONS);agent.memories.push(observation.id);agent.memories=agent.memories.slice(-48);}
}
function nearby(s:WorldState,point:{x:number;y:number},radius=6):AgentId[]{return s.agents.filter(a=>distance(a,point)<=radius).map(a=>a.id);}
function stockObservation(s:WorldState,a:Agent,p:Place){
  const event=emit(s,'store_inspected',a.id,{placeId:p.id,stock:{...p.stock}},[a.id],[], 'observation');
  let claimId:string|null=null;
  if(p.id==='granary'){claimId=`granary-stock-${p.stock.grain}`;if(!s.claims.some(c=>c.id===claimId))s.claims.push({id:claimId,text:`The granary contains ${p.stock.grain} sacks of grain.`,subjectId:'granary',kind:'fact',predicate:'stock:grain',value:p.stock.grain});}
  observe(s,event,[a.id],`${p.name}: grain ${p.stock.grain}, water ${p.stock.water}, timber ${p.stock.timber}, bread ${p.stock.bread}.`,'self',claimId,p.id,{placeId:p.id,stock:p.stock});
}
function relationship(s:WorldState,from:Agent,to:AgentId,trust:number,eventId:string){const old=from.relationships[to]??{trust:50,affinity:50,evidenceIds:[]};from.relationships[to]={trust:clamp(old.trust+trust,0,100),affinity:clamp(old.affinity+Math.sign(trust),0,100),evidenceIds:[...old.evidenceIds,eventId].slice(-6)};}
function knownClaimIds(a:Agent){return new Set([...a.observations.flatMap(o=>o.claimId?[o.claimId]:[]),...Object.keys(a.beliefs)]);}
/** Route knowledge expires; revisiting a route is not remote knowledge of its present condition. */
function knowsCrossingClosed(a:Agent,tick:number){const last=[...a.observations].reverse().find(o=>o.claimId==='ford-closed'||o.claimId==='ford-open'||o.text.includes('raised footbridge is complete'));return last?.claimId==='ford-closed'&&tick-last.tick<=1800;}

export function projectAgentContext(s:WorldState,id:AgentId):AgentContext {
  const a=agentById(s,id);if(!a)throw new Error('Unknown resident');const known=knownClaimIds(a);
  const places=s.places.filter(p=>a.knownPlaces.includes(p.id)).map(p=>{
    const visible=distance(a,p)<=2 && (p.kind!=='home'||mayCollect(id,p));
    const remembered=[...a.observations].reverse().find(o=>o.details?.placeId===p.id&&o.details.stock&&s.tick-o.tick<=1800)?.details?.stock;
    const closure=knowsCrossingClosed(a,s.tick);
    const sameBank=(a.x<RIVER_X&&p.x<RIVER_X)||(a.x>RIVER_X&&p.x>RIVER_X)||p.x===a.x;
    return {id:p.id,name:p.name,kind:p.kind,x:p.x,y:p.y,stock:visible?{...p.stock}:remembered?{...remembered}:null,accessible:sameBank||!closure};
  });
  return {mode:s.mode,agent:{id:a.id,name:a.name,role:a.role,traits:[...a.traits],capabilities:[...a.capabilities],x:a.x,y:a.y,inventory:{...a.inventory},needs:{...a.needs},fed:a.fed,goals:a.goals.map(g=>({...g})),currentAction:a.action,contributions:{...a.contributions}},tick:s.tick,time:nowLabel(s.tick),places,nearbyAgents:s.agents.filter(other=>other.id!==id&&distance(a,other)<=6).map(other=>({id:other.id,name:other.name,role:other.role})),observations:clone(retainedObservations(a.observations,12)),beliefs:clone(Object.values(a.beliefs).sort((x,y)=>x.claimId<y.claimId?-1:x.claimId>y.claimId?1:0)),relationships:Object.entries(a.relationships).sort(([x],[y])=>x<y?-1:x>y?1:0).map(([agentId,r])=>({agentId:agentId as AgentId,trust:r!.trust,affinity:r!.affinity})),notes:s.notes.filter(n=>n.recipientId===id).map(n=>({id:n.id,read:n.readAt!==null})),offers:s.offers.filter(o=>o.status==='pending'&&(o.toId===id||o.fromId===id)).map(o=>({...o})),claims:s.claims.filter(c=>known.has(c.id)).map(c=>({...c})),allowedActions:[...ACTIONS]};
}

function makeTickets(s:WorldState,ids:AgentId[],effectiveTick:number,kind:'bootstrap'|'heartbeat'|'event'){
  for(const id of ids){if(s.tickets.some(t=>t.agentId===id&&t.effectiveTick===effectiveTick))continue;const context=projectAgentContext(s,id);const ticket:DecisionTicket={id:`${s.branchId}/d/${effectiveTick}/${id}/${s.nextId++}`,agentId:id,triggerKind:kind,snapshotTick:s.tick,effectiveTick,context,requestHash:hashValue(context),status:'pending',proposal:null,provenance:'rule',failure:null};s.tickets.push(ticket);emit(s,'decision_scheduled',id,{ticketId:ticket.id,effectiveTick,snapshotTick:s.tick,triggerKind:kind,requestHash:ticket.requestHash},[],[],'scheduler');if(kind==='event'){s.eventDecisionCount++;if(s.persistent)s.persistent.eventWindowCount++;}delete s.triggers[id];}
}

export function initializeWorld(seed=1,branchId='main',options:{mode?:WorldMode}={}):WorldState {
  if(!Number.isSafeInteger(seed)||!branchId||branchId.length>100)throw new Error('Invalid world identity');
  const mode=options.mode??'scenario';if(!['scenario','persistent'].includes(mode))throw new Error('Unknown world mode');const places=createPlaces();const heartbeatCount=Object.fromEntries(AGENT_IDS.map(id=>[id,0])) as Record<AgentId,number>;
  const state:WorldState={mode,persistent:mode==='persistent'?{day:1,lastDawn:null,totalMeals:0,eventWindowStart:0,eventWindowCount:0}:null,version:1,engineVersion:ENGINE_VERSION,contentVersion:CONTENT_VERSION,seed,branchId,parentBranchId:null,tick:0,settledTick:-1,phase:'bootstrap',width:WORLD_WIDTH,height:WORLD_HEIGHT,agents:createAgents(places),places,claims:createClaims(),notes:[],offers:[],reservations:[],events:[],eventSeq:0,eventHead:'0'.repeat(64),checkpoints:[],tickets:[],queuedInterventions:[],heartbeatCount,eventDecisionCount:0,triggers:{},decisionCount:0,externalBread:12,interventionCounts:{rain:0,resourceDrop:0,message:0},weather:{rainingUntil:0,rainStartedAt:null},crossing:{x:RIVER_X,y:FORD_Y,blockedUntil:0,bridgeBuilt:false,workSeconds:0,materialsUsed:false},oven:{startedAt:null,finishesAt:null,workerId:null},ledger:{initial:{grain:6,water:2,timber:8,bread:6},external:emptyGoods(),environment:emptyGoods(),produced:emptyGoods(),recipeConsumed:emptyGoods(),eaten:emptyGoods(),waste:emptyGoods()},blocked:true,ended:false,nextId:1,operations:[],origin:{seed,branchId,parentBranchId:null,mode}};
  emit(state,'world_started',null,{engineVersion:ENGINE_VERSION,contentVersion:CONTENT_VERSION,seed,mode,authoredSetup:true},[],[],'origin');
  for(const a of state.agents){const event=emit(state,'resident_briefed',a.id,{name:a.name,role:a.role,authoredSetup:true},[a.id],[],'origin');observe(state,event,[a.id],`You are ${a.name}, ${a.role.toLowerCase()}. The town is preparing a shared supper. Your goals and prior relationships are authored starting conditions.`,'self',null,a.id);const p=[...state.places].sort((p,q)=>distance(a,p)-distance(a,q)).find(p=>distance(a,p)<=2);if(p)stockObservation(state,a,p);}
  makeTickets(state,[...AGENT_IDS],0,'bootstrap');
  return state;
}
export function initializePersistentWorld(seed=1,branchId='main'):WorldState{return initializeWorld(seed,branchId,{mode:'persistent'});}

export function getDueDecisionRequests(s:WorldState):DecisionTicket[]{return s.tickets.filter(t=>t.status==='pending').map(t=>clone(t));}

function proposalError(p:DecisionProposal,ctx:AgentContext):string|null {
  if(!p||!ACTIONS.includes(p.action))return 'Unsupported action';
  if(!Number.isInteger(p.quantity)||p.quantity<0||p.quantity>2||!Number.isInteger(p.duration)||p.duration<1||p.duration>3600)return 'Invalid quantity or duration';
  if(p.item!==null&&!GOODS.includes(p.item))return 'Unknown good';
  if(['collect','deliver','give','request'].includes(p.action)&&(!p.item||p.quantity<1))return 'A resource action requires a positive quantity and item';
  if(typeof p.utterance!=='string'||p.utterance.length>240||typeof p.reason!=='string'||p.reason.length>240)return 'Overlong or invalid text';
  if(!Array.isArray(p.evidenceIds)||p.evidenceIds.length>8||!Array.isArray(p.beliefUpdates)||p.beliefUpdates.length>3)return 'Invalid evidence or belief updates';
  const evidence=new Set(ctx.observations.map(o=>o.id));
  if(p.evidenceIds.some(id=>!evidence.has(id)))return 'Evidence unavailable to this resident';
  const known=new Set(ctx.claims.map(c=>c.id));
  if(p.claimId!==null&&!known.has(p.claimId))return 'Unknown claim';
  for(const b of p.beliefUpdates){if(!b||!known.has(b.claimId)||!['believe','doubt','reject'].includes(b.stance)||!Number.isInteger(b.confidence)||b.confidence<0||b.confidence>100||!Array.isArray(b.evidenceIds)||b.evidenceIds.length<1||b.evidenceIds.some(id=>!evidence.has(id)))return 'Belief citation or value unavailable';}
  if(p.goalId!==null&&!ctx.agent.goals.some(g=>g.id===p.goalId))return 'Unknown goal';
  const targets=new Set([...ctx.places.map(v=>v.id),...ctx.nearbyAgents.map(v=>v.id),...ctx.notes.map(v=>v.id),ctx.agent.id]);
  if(p.targetId!==null&&!targets.has(p.targetId))return 'Target unavailable to this resident';
  if(!['wait','eat'].includes(p.action)&&p.targetId===null)return 'Action requires a known target';
  return null;
}

export function validateDecisionProposal(p:DecisionProposal,ctx:AgentContext):string|null{return proposalError(p,ctx);}
function fallbackProposal(ctx:AgentContext,reason:string):DecisionProposal{return {...chooseRuleDecision(ctx),utterance:'',reason:`Deterministic fallback: ${reason}`.slice(0,240)};}
function resolveInPlace(s:WorldState,ticketId:string,proposal:DecisionProposal,provenance:Provenance,failure:string|null){const ticket=s.tickets.find(t=>t.id===ticketId);if(!ticket)throw new Error('Unknown or expired decision ticket');if(ticket.status==='resolved')throw new Error('Decision already resolved');const error=proposalError(proposal,ticket.context);ticket.status='resolved';ticket.proposal=error?fallbackProposal(ticket.context,error):clone(proposal);ticket.provenance=error?'fallback':provenance;ticket.failure=error??failure;}
export function applyDecision(s:WorldState,ticketId:string,proposal:DecisionProposal,provenance:Provenance='meta',failure:string|null=null):WorldState {
  if(!['rule','meta','fallback'].includes(provenance))throw new Error('Unknown decision provenance');const next=copy(s);resolveInPlace(next,ticketId,proposal,provenance,failure);next.operations.push({type:'decision',ticketId,proposal:clone(proposal),provenance,failure});return next;
}

export function chooseRuleDecision(ctx:AgentContext):DecisionProposal {
  const a=ctx.agent;const latest=ctx.observations.slice(-1)[0];const evidenceIds=latest?[latest.id]:[];
  const base:DecisionProposal={action:'wait',targetId:null,item:null,quantity:0,duration:900,claimId:null,utterance:'',goalId:'community',evidenceIds,beliefUpdates:[],reason:'Continue a practical, explicitly deterministic local rule policy.'};
  const observation=[...ctx.observations].reverse().find(o=>o.claimId);
  if(observation?.claimId){const claim=ctx.claims.find(c=>c.id===observation.claimId);if(claim){base.beliefUpdates=[{claimId:claim.id,stance:observation.channel==='self'||observation.channel==='saw'?'believe':a.traits.some(t=>/checks|skept|questions/.test(t))?'doubt':'believe',confidence:observation.channel==='self'?95:observation.channel==='read'?55:45,evidenceIds:[observation.id]}];if(claim.subjectId==='granary'&&observation.channel==='self')for(const old of ctx.claims.filter(c=>c.subjectId==='granary'&&c.predicate===claim.predicate&&c.value!==claim.value).slice(0,2))base.beliefUpdates.push({claimId:old.id,stance:'reject',confidence:95,evidenceIds:[observation.id]});}}
  const unread=ctx.notes.find(n=>!n.read);if(unread)return {...base,action:'read',targetId:unread.id,duration:60,reason:'Read the ordinary note addressed to me.'};
  const gift=ctx.offers.find(o=>o.toId===a.id&&!o.request);if(gift)return {...base,action:'give',targetId:gift.fromId,item:gift.item,quantity:gift.quantity,duration:120,reason:'Respond to an offer that I actually received.'};
  const request=ctx.offers.find(o=>o.toId===a.id&&o.request&&a.inventory[o.item]>=o.quantity);if(request)return {...base,action:'give',targetId:request.fromId,item:request.item,quantity:request.quantity,duration:300,reason:'Independently choose to offer owned goods in response to a received request.'};
  const hour=(12+ctx.tick/3600)%24;
  if(ctx.mode==='persistent'&&(hour>=20||hour<6)){const home=ctx.places.find(p=>p.kind==='home');if(home&&distance(a,home)>0)return {...base,action:'move',targetId:home.id,duration:3600,reason:'It is nighttime; return to my own known home.'};return {...base,duration:1800,reason:'Rest at home overnight before the next working day.'};}
  if(!a.fed&&a.inventory.bread>0)return {...base,action:'eat',item:'bread',quantity:1,duration:60,goalId:'meal',reason:'Eat the bread I am already carrying.'};
  const food=ctx.places.filter(p=>(p.stock?.bread??0)>0&&p.accessible).sort((x,y)=>distance(a,x)-distance(a,y)||(x.id<y.id?-1:x.id>y.id?1:0))[0];
  if(!a.fed&&a.needs.hunger>=70&&food)return {...base,action:'eat',targetId:food.id,item:'bread',quantity:1,duration:1800,goalId:'meal',reason:'A known food source can meet my meal need.'};
  if(ctx.mode==='persistent'&&!a.fed&&hour>=16.5&&hour<20&&!food)return {...base,action:'inspect',targetId:'supper',duration:1800,goalId:'meal',reason:'Stop work for the shared evening meal and check the common table.'};
  if(!a.fed&&a.needs.hunger>=70&&!food&&!(ctx.mode==='persistent'&&a.capabilities.some(c=>['baker','porter','water','timber'].includes(c)))){const search=ctx.places.filter(p=>['bakery','inn','supper'].includes(p.id)&&p.accessible).sort((x,y)=>{const seen=(id:string)=>Math.max(-1,...ctx.observations.filter(o=>o.details?.placeId===id).map(o=>o.tick));return seen(x.id)-seen(y.id)||distance(a,x)-distance(a,y);})[0];if(search)return {...base,action:'inspect',targetId:search.id,duration:1800,goalId:'meal',reason:'I do not know where bread remains; check a known public food location.'};}
  const noteClaim=ctx.claims.find(c=>c.id==='granary-twelve'||c.id==='granary-empty');
  const checked=ctx.observations.some(o=>o.sourceId==='granary'&&o.channel==='self'&&o.tick>0);
  if(noteClaim&&!checked&&a.traits.some(t=>/checks|skept|questions|curious/.test(t)))return {...base,action:'inspect',targetId:'granary',duration:1800,goalId:'understand',reason:'Check the granary ledger rather than assume the note is true.'};
  const sawBridgeDone=ctx.observations.some(o=>o.text.includes('bridge is finished')||o.text.includes('footbridge is complete')||o.text.includes('bridge is already complete'));
  if(a.capabilities.includes('builder')&&!sawBridgeDone)return {...base,action:'work',targetId:'bridge',duration:3600,reason:'Use my building skill to improve the shared crossing.'};
  if(a.capabilities.includes('baker'))return {...base,action:'work',targetId:'bakery',duration:1800,reason:'Fetch the actual ingredients and bake while there is oven capacity.'};
  if(a.role==='Porter'){
    const item:Good=a.id==='bram'?'grain':a.id==='leda'?'water':a.id==='kitt'?'timber':'bread';
    return {...base,action:'deliver',targetId:item==='bread'?'supper':'bakery',item,quantity:2,duration:1800,reason:`Carry ${item} toward the shared supper using local task steps.`};
  }
  if(a.capabilities.includes('timber'))return {...base,action:'deliver',targetId:a.contributions.deliveries<1?'bridge':'bakery',item:'timber',quantity:a.contributions.deliveries<1?1:2,duration:1800,reason:'First bring one bridge bundle; then support baking with remaining timber.'};
  if(a.capabilities.includes('water'))return {...base,action:'deliver',targetId:'bakery',item:'water',quantity:2,duration:1800,reason:'Bring water from the known well to the bakers.'};
  if(a.capabilities.includes('keeper'))return {...base,action:'inspect',targetId:'granary',duration:900,reason:'Check the store I am responsible for.'};
  const known=ctx.beliefs.filter(b=>b.stance!=='reject').map(b=>ctx.claims.find(c=>c.id===b.claimId)).find(Boolean);
  if(known&&ctx.nearbyAgents.length&&ctx.tick%1800<600)return {...base,action:'talk',targetId:ctx.nearbyAgents[0].id,claimId:known.id,utterance:`I heard this, but you can check: ${known.text}`.slice(0,240),duration:300,reason:'Share a claim I actually received, without making it world truth.'};
  if(!a.fed&&food)return {...base,action:'eat',targetId:food.id,item:'bread',quantity:1,duration:1800,goalId:'meal',reason:'Get a meal from a known available source.'};
  if(a.capabilities.includes('cook'))return {...base,action:'deliver',targetId:'supper',item:'bread',quantity:2,duration:1800,reason:'Carry baked bread to the common table.'};
  if((12+ctx.tick/3600)%24>=16.5)return {...base,action:'move',targetId:'supper',duration:1800,reason:'Go to the shared supper.'};
  return {...base,action:'move',targetId:a.role==='Courier'?'noticeboard':ctx.tick%3600<1800?'square':'inn',duration:1800,reason:'Visit a known public place and see what is happening.'};
}

function releaseReservations(s:WorldState,a:Agent){s.reservations=s.reservations.filter(r=>r.agentId!==a.id);}
function finish(s:WorldState,a:Agent,text:string,failed=false){releaseReservations(s,a);a.intent=null;a.action=failed?'Reconsidering':'Looking around';const e=emit(s,failed?'plan_failed':'intent_completed',a.id,{text},[a.id]);observe(s,e,[a.id],text,'self');trigger(s,a.id,failed?'plan_failed':'intent_completed');}
function sourceFor(item:Good){return item==='grain'?'granary':item==='water'?'well':item==='timber'?'timber-yard':'bakery';}
function startIntent(s:WorldState,a:Agent,p:DecisionProposal){
  releaseReservations(s,a);a.intent={action:p.action,targetId:p.targetId,item:p.item,quantity:p.quantity,startedAt:s.tick,expiresAt:s.tick+p.duration,phase:'start',path:[],sourceId:null,offerId:null,reason:p.reason,evidenceIds:[...p.evidenceIds],utterance:p.utterance,claimId:p.claimId};a.action=p.action==='work'?(p.targetId==='bridge'?'Working on crossing':'Preparing bread'):p.action==='deliver'?`Carrying ${p.item??'goods'}`:p.action==='move'?'Walking':p.action==='eat'?'Finding a meal':p.action==='inspect'?'Checking records':p.action==='read'?'Reading a note':p.action==='talk'?'Talking':p.action==='wait'?'Resting':p.action;
}
function moveToward(s:WorldState,a:Agent,target:{x:number;y:number}):'arrived'|'moving'|'failed'{
  const intent=a.intent!;if(distance(a,target)===0){intent.path=[];return 'arrived';}
  if(!intent.path.length||intent.path[intent.path.length-1].x!==target.x||intent.path[intent.path.length-1].y!==target.y){const knowsClosed=knowsCrossingClosed(a,s.tick);const routeWorld=distance(a,s.crossing)>2&&!knowsClosed?{...s,crossing:{...s.crossing,blockedUntil:0}}:s;const path=findPath(routeWorld,a,target);if(path===null)return 'failed';intent.path=path;}
  const next=intent.path[0];if(!next||!isWalkable(s,next.x,next.y)){if(next?.x===RIVER_X){const e=emit(s,'blocked_crossing_seen',a.id,{claimId:'ford-closed'},[a.id]);observe(s,e,[a.id],'The low ford is blocked by water.','saw','ford-closed','bridge');}intent.path=[];return 'failed';}
  a.moveProgress++;const cost=next.x===RIVER_X?(s.crossing.bridgeBuilt?5:10):5;if(a.moveProgress<cost)return 'moving';
  // The single-cell ford is exclusive. Broad public tiles can hold small groups.
  if(next.x===RIVER_X&&s.agents.some(other=>other.id!==a.id&&other.x===next.x&&other.y===next.y))return 'moving';
  a.moveProgress=0;a.x=next.x;a.y=next.y;intent.path.shift();return distance(a,target)===0?'arrived':'moving';
}
function stockTransfer(s:WorldState,a:Agent,p:Place,item:Good,amount:number,toAgent:boolean):boolean {
  if(!Number.isInteger(amount)||amount<=0)return false;
  if(toAgent){if(!mayCollect(a.id,p)||p.stock[item]<amount||GOODS.reduce((n,g)=>n+a.inventory[g],0)+amount>2)return false;p.stock[item]-=amount;a.inventory[item]+=amount;}
  else {if(a.inventory[item]<amount)return false;a.inventory[item]-=amount;p.stock[item]+=amount;a.contributions.deliveries++;}
  const e=emit(s,toAgent?'goods_collected':'goods_delivered',a.id,{placeId:p.id,item,quantity:amount,stock:{...p.stock}},nearby(s,p));observe(s,e,[a.id],`${toAgent?'Collected':'Delivered'} ${amount} ${item} ${toAgent?'from':'to'} ${p.name}.`,'self',null,p.id,{placeId:p.id,stock:p.stock});return true;
}
function eatMeal(s:WorldState,a:Agent,source:Place|null=null){
  if(source)source.stock.bread--;else a.inventory.bread--;
  s.ledger.eaten.bread++;if(s.persistent)s.persistent.totalMeals++;a.fed=true;a.needs.hunger=0;
  const event=emit(s,'meal_eaten',a.id,{item:'bread',uniqueResidentFed:true,placeId:source?.id??null},nearby(s,a));
  observe(s,event,[a.id],'I ate one loaf of bread.','self',null,source?.id??null,source?{placeId:source.id,stock:source.stock}:undefined);finish(s,a,'I have had my meal.');
}

function processAgent(s:WorldState,a:Agent){
  const i=a.intent;if(!i)return;if(s.tick>i.expiresAt){finish(s,a,'My intention expired; I need to reconsider.',true);return;}
  if(i.action==='eat'&&a.fed){finish(s,a,'My afternoon meal need is already met.');return;}
  if(i.action==='wait'){if(s.tick>=i.expiresAt)finish(s,a,'Finished resting.');return;}
  if(i.action==='read'){
    const note=s.notes.find(n=>n.id===i.targetId&&n.recipientId===a.id);if(!note){finish(s,a,'The note is unavailable.',true);return;}
    if(note.readAt===null){note.readAt=s.tick;const c=s.claims.find(c=>c.id===note.claimId)!;const e=emit(s,'note_read',a.id,{noteId:note.id,claimId:c.id,text:c.text,source:'anonymous note'},[a.id]);observe(s,e,[a.id],`An anonymous note says: ${c.text}`,'read',c.id,note.id);trigger(s,a.id,'new_information');}finish(s,a,'I read the note. Receiving a claim does not make it true.');return;
  }
  if(i.action==='give'||i.action==='request'){
    const recipient=agentById(s,i.targetId??'');if(!recipient||!i.item){finish(s,a,'The proposed exchange is unavailable.',true);return;}
    const existing=s.offers.find(o=>o.toId===a.id&&o.fromId===recipient.id&&o.item===i.item&&o.status==='pending'&&!o.request);
    if(existing){if(distance(a,recipient)>2){const moved=moveToward(s,a,recipient);if(moved==='failed')finish(s,a,'I cannot reach the person offering goods.',true);return;}const qty=Math.min(existing.quantity,2-GOODS.reduce((n,g)=>n+a.inventory[g],0));if(qty>0&&recipient.inventory[i.item]>=qty){recipient.inventory[i.item]-=qty;a.inventory[i.item]+=qty;existing.status='accepted';recipient.contributions.shared+=qty;const e=emit(s,'offer_accepted',a.id,{offerId:existing.id,fromId:recipient.id,item:i.item,quantity:qty},[a.id,recipient.id]);observe(s,e,[a.id,recipient.id],`${a.name} accepted ${qty} ${i.item} from ${recipient.name}.`,'saw');relationship(s,a,recipient.id,3,e.id);relationship(s,recipient,a.id,1,e.id);}else existing.status='declined';finish(s,a,'Responded to the offer.');return;}
    if(i.offerId){const o=s.offers.find(o=>o.id===i.offerId);if(!o||o.status!=='pending')finish(s,a,'The offer is no longer pending.');return;}
    const moved=moveToward(s,a,recipient);if(moved==='failed'){finish(s,a,'I cannot reach the intended exchange partner.',true);return;}if(moved!=='arrived')return;
    if(i.action==='give'&&a.inventory[i.item]<i.quantity){finish(s,a,'I cannot offer goods I do not own.',true);return;}
    const offer={id:`${s.branchId}/offer/${s.nextId++}`,fromId:a.id,toId:recipient.id,item:i.item,quantity:Math.max(1,i.quantity),createdAt:s.tick,expiresAt:s.tick+900,status:'pending' as const,request:i.action==='request'};s.offers.push(offer);i.offerId=offer.id;const e=emit(s,'offer_made',a.id,{...offer},[a.id,recipient.id]);observe(s,e,[a.id,recipient.id],`${a.name} ${offer.request?'asked for':'offered'} ${offer.quantity} ${offer.item}.`,'heard',null,a.id);trigger(s,recipient.id,'offer_received');return;
  }
  if(i.action==='talk'){
    const target=agentById(s,i.targetId??'')??placeById(s,i.targetId);if(!target){finish(s,a,'The listener is no longer available.',true);return;}const moved=distance(a,target)<=3?'arrived':moveToward(s,a,target);if(moved==='failed'){finish(s,a,'I cannot reach my listener.',true);return;}if(moved!=='arrived')return;
    const e=emit(s,'speech',a.id,{text:(i as typeof i&{utterance?:string}).utterance??'Let us see what needs doing.',claimId:(i as typeof i&{claimId?:string}).claimId??null},nearby(s,a,5),i.evidenceIds,'social');const claimId=(e.payload.claimId as string|null);observe(s,e,e.audience,`${a.name}: ${e.payload.text}`,'heard',claimId,a.id);for(const id of e.audience)if(id!==a.id)trigger(s,id,'heard_news');a.lastSocialAt=s.tick;finish(s,a,'Finished speaking.');return;
  }
  const target=placeById(s,i.targetId);
  if(i.action==='eat'&&a.inventory.bread>0){eatMeal(s,a);return;}
  if(!target){finish(s,a,'There is no known target for this intention.',true);return;}
  if(i.action==='deliver'||(i.action==='work'&&target.id==='bakery')){
    let item=i.item;let amount=Math.max(1,i.quantity);
    if(i.action==='work'){
      if(i.phase==='start'){const reached=moveToward(s,a,target);if(reached==='failed'){finish(s,a,'I cannot reach the bakery.',true);return;}if(reached!=='arrived')return;stockObservation(s,a,target);i.phase='at-oven';}
      if(s.oven.finishesAt!==null){if(s.oven.workerId===a.id)a.action='Watching the oven';return;}
      item=i.phase==='fetching'?i.item:GOODS.find(g=>g!=='bread'&&availableStock(s,target,g)<1)??null;amount=1;
      if(item!==null){i.item=item;i.phase='fetching';}
      if(item===null){const moved=moveToward(s,a,target);if(moved==='failed'){finish(s,a,'I cannot reach the oven.',true);return;}if(moved!=='arrived')return;if(!a.capabilities.includes('baker')){finish(s,a,'I do not have the baking skill.',true);return;}for(const g of ['grain','water','timber'] as Good[]){target.stock[g]--;s.ledger.recipeConsumed[g]++;}s.oven={startedAt:s.tick,finishesAt:s.tick+900,workerId:a.id};emit(s,'baking_started',a.id,{finishesAt:s.tick+900,inputs:{grain:1,water:1,timber:1}},nearby(s,target));a.action='Baking bread';return;}
    }
    if(!item){finish(s,a,'A delivery needs an item.',true);return;}
    if(a.inventory[item]>0){const moved=moveToward(s,a,target);if(moved==='failed'){finish(s,a,'My delivery route is blocked.',true);return;}if(moved!=='arrived')return;const qty=Math.min(a.inventory[item],amount);stockTransfer(s,a,target,item,qty,false);if(i.action==='deliver')finish(s,a,`Delivered ${qty} ${item}.`);else{i.phase='at-oven';i.item=null;}return;}
    const source=placeById(s,sourceFor(item));if(!source||!a.knownPlaces.includes(source.id)){finish(s,a,'I do not know a source for this good.',true);return;}if(source.id===target.id){finish(s,a,'There is nothing useful to transfer here.',true);return;}
    const moved=moveToward(s,a,source);if(moved==='failed'){finish(s,a,'The route to my material source is blocked.',true);return;}if(moved!=='arrived')return;
    collectReserved(s,a,source,item,amount);return;
  }
  const moved=moveToward(s,a,target);if(moved==='failed'){finish(s,a,'The path is blocked; I need a new plan.',true);return;}if(moved!=='arrived')return;
  if(i.action==='move'){finish(s,a,`Arrived at ${target.name}.`);stockObservation(s,a,target);return;}
  if(i.action==='inspect'){if(target.kind==='home'&&!mayCollect(a.id,target)){finish(s,a,'I cannot inspect this private home.',true);return;}stockObservation(s,a,target);finish(s,a,`Inspected ${target.name}.`);return;}
  if(i.action==='collect'||i.action==='eat'){const item=i.action==='eat'?'bread':i.item;if(!item){finish(s,a,'The requested good is unavailable.',true);return;}if(collectReserved(s,a,target,item,Math.max(1,i.quantity))&&i.action==='collect')finish(s,a,'Collected the requested goods.');return;}
  if(i.action==='work'&&target.id==='bridge'){
    if(s.crossing.bridgeBuilt){finish(s,a,'The footbridge is already complete.');return;}if(!a.capabilities.includes('builder')){finish(s,a,'This job needs a skilled builder.',true);return;}
    if(!s.crossing.materialsUsed){if(availableStock(s,target,'timber')<2){a.action='Waiting for bridge timber';return;}target.stock.timber-=2;s.ledger.recipeConsumed.timber+=2;s.crossing.materialsUsed=true;emit(s,'bridge_started',a.id,{timber:2},nearby(s,target));}
    s.crossing.workSeconds++;a.contributions.workSeconds++;a.action='Building the footbridge';
    if(s.crossing.workSeconds>=3600){s.crossing.bridgeBuilt=true;const e=emit(s,'bridge_completed',a.id,{workerSeconds:3600},nearby(s,target,10));observe(s,e,e.audience,'The raised footbridge is complete. It remains usable in this modeled rain.','saw',null,'bridge');for(const id of e.audience)trigger(s,id,'crossing_changed');finish(s,a,'The shared bridge is finished.');}return;
  }
  finish(s,a,'This intention cannot execute here.',true);
}

function availableStock(s:WorldState,p:Place,item:Good){return p.stock[item]-s.reservations.filter(r=>r.placeId===p.id&&r.item===item).reduce((n,r)=>n+r.quantity,0);}
function collectReserved(s:WorldState,a:Agent,p:Place,item:Good,wanted:number):boolean {
  const own=s.reservations.find(r=>r.agentId===a.id&&r.placeId===p.id&&r.item===item);
  if(own){s.reservations=s.reservations.filter(r=>r.id!==own.id);if(a.intent?.action==='eat'&&item==='bread'){if(p.stock.bread>0&&mayCollect(a.id,p)){eatMeal(s,a,p);return true;}finish(s,a,'The reserved meal is no longer available.',true);return false;}if(!stockTransfer(s,a,p,item,own.quantity,true)){finish(s,a,'The reserved goods are no longer available.',true);return false;}return true;}
  const qty=Math.min(wanted,availableStock(s,p,item),a.intent?.action==='eat'?1:2-GOODS.reduce((n,g)=>n+a.inventory[g],0));
  if(qty<1||!mayCollect(a.id,p)){finish(s,a,'The source is empty, unauthorized, or my pack is full.',true);return false;}
  const reservation={id:`${s.branchId}/r/${s.nextId++}`,agentId:a.id,placeId:p.id,item,quantity:qty,expiresAt:s.tick+60};s.reservations.push(reservation);emit(s,'goods_reserved',a.id,{...reservation},[a.id]);return false;
}

export function applyIntervention(s:WorldState,command:Intervention):WorldState {
  if(!command||typeof command.id!=='string'||!command.id||command.id.length>120)throw new Error('A stable command id is required');
  if(s.operations.some(o=>o.type==='intervention'&&o.command.id===command.id))return s;
  if(s.ended||(s.mode==='scenario'&&Math.floor(s.tick/EPOCH_SECONDS+1)*EPOCH_SECONDS>=HORIZON_SECONDS))throw new Error('No active intervention window remains');
  if(!['rain','resourceDrop','message'].includes(command.type))throw new Error('Unknown intervention');
  const next=copy(s);const effectiveTick=(Math.floor(s.tick/EPOCH_SECONDS)+1)*EPOCH_SECONDS;
  const nextDay=s.mode==='persistent'&&dayAt(effectiveTick)>dayAt(s.tick);const quotas=nextDay?queuedQuotas(next,dayAt(effectiveTick)):next.interventionCounts;
  if(command.type==='rain'&&quotas.rain>=1)throw new Error('This scenario permits one rain event per active period');
  if(command.type==='resourceDrop'){
    if(quotas.resourceDrop>=3)throw new Error('The outside bread reserve is fully allocated');
    if(!['square','supper','market','inn'].includes(command.targetId??'supper'))throw new Error('Supplies must arrive at a public delivery location');
  }
  if(command.type==='message'){
    if(quotas.message>=3)throw new Error('This scenario permits three delivered notes per active period');
    if(!agentById(next,command.targetId??''))throw new Error('Select an actual recipient');
    if(!next.claims.some(c=>c.id===command.claimId))throw new Error('Select an authored known proposition');
  }
  if(!nextDay)next.interventionCounts[command.type]++;next.queuedInterventions.push({...clone(command),effectiveTick});next.operations.push({type:'intervention',command:clone(command)});emit(next,'intervention_queued',null,{...command,effectiveTick},[],[],'command');return next;
}

function applyQueuedInterventions(s:WorldState){
  const due=s.queuedInterventions.filter(c=>c.effectiveTick<=s.tick);s.queuedInterventions=s.queuedInterventions.filter(c=>c.effectiveTick>s.tick);
  for(const c of due){
    if(c.type==='rain'){
      s.weather.rainStartedAt=s.tick;s.weather.rainingUntil=s.tick+5400;s.crossing.blockedUntil=s.tick+5400;
      const well=placeById(s,'well')!;well.stock.water+=4;s.ledger.environment.water+=4;
      const e=emit(s,'rain_started',null,{commandId:c.id,endsAt:s.tick+5400,waterAdded:4},[...AGENT_IDS],[],'command');observe(s,e,[...AGENT_IDS],'Rain has started over the town.','saw',null,'weather');
      const listeners=nearby(s,s.crossing,6);const crossing=emit(s,'ford_flooded',null,{blockedUntil:s.tick+5400},listeners,[],'command');observe(s,crossing,listeners,'The low ford is blocked by water.','saw','ford-closed','bridge');for(const id of listeners)trigger(s,id,'crossing_changed');
    }else if(c.type==='resourceDrop'){
      const target=placeById(s,c.targetId??'supper')!;if(s.externalBread<4)throw new Error('Outside reserve invariant failed');s.externalBread-=4;target.stock.bread+=4;s.ledger.external.bread+=4;const ids=nearby(s,target,6);const e=emit(s,'supplies_delivered',null,{commandId:c.id,placeId:target.id,item:'bread',quantity:4,externalReserve:s.externalBread},ids,[],'command');observe(s,e,ids,`A delivery added four bread loaves at ${target.name}.`,'saw',null,target.id,{placeId:target.id,stock:target.stock});for(const id of ids)trigger(s,id,'supplies_seen');
    }else{
      const recipient=agentById(s,c.targetId!)!;const note={id:`${s.branchId}/note/${s.nextId++}`,recipientId:recipient.id,claimId:c.claimId!,deliveredAt:s.tick,readAt:null};s.notes.push(note);const e=emit(s,'note_delivered',null,{commandId:c.id,noteId:note.id,recipientId:recipient.id},[recipient.id],[],'command');observe(s,e,[recipient.id],'An anonymous folded note has been delivered to me. I have not read its contents.','self',null,note.id);trigger(s,recipient.id,'note_received');
      if(s.mode==='persistent'&&s.notes.length>72){const archived=s.notes.splice(0,s.notes.length-72);emit(s,'old_note_receipts_archived',null,{noteIds:archived.map(n=>n.id),source:'complete operation history',reason:'Bound active note receipts; preserve received memories and replayable history.'},[],[],'archive');}
    }
  }
}

function commitTicket(s:WorldState,t:DecisionTicket){
  const a=agentById(s,t.agentId)!;const p=t.proposal!;const event=emit(s,'decision_committed',a.id,{ticketId:t.id,triggerKind:t.triggerKind,provenance:t.provenance,snapshotTick:t.snapshotTick,effectiveTick:t.effectiveTick,requestHash:t.requestHash,proposal:clone(p),failure:t.failure},[a.id],p.evidenceIds,'decision');
  a.decisions[t.provenance]++;s.decisionCount++;if(t.triggerKind!=='event')s.heartbeatCount[a.id]++;
  for(const update of p.beliefUpdates){a.beliefs[update.claimId]={...clone(update),updatedAt:s.tick};emit(s,'belief_revised',a.id,{...clone(update)},[a.id],update.evidenceIds,'social');}
  if(p.goalId){const goal=a.goals.find(g=>g.id===p.goalId);if(goal)goal.weight=Math.min(100,Math.max(80,goal.weight+2));}
  startIntent(s,a,p);
  // Commit citation is an audit reference, not a new observation of an external fact.
  if(t.failure)observe(s,event,[a.id],`A deterministic fallback was used: ${t.failure}`,'self');
}
function scheduleBoundary(s:WorldState){
  if(s.mode==='scenario'&&s.tick+EPOCH_SECONDS>=HORIZON_SECONDS)return;
  const effective=s.tick+EPOCH_SECONDS;
  const heartbeat=AGENT_IDS.filter((id,index)=>{const first=1800+Math.floor(index/4)*300;return effective>=first&&(effective-first)%1800===0&&(s.mode==='persistent'||s.heartbeatCount[id]<12);});
  makeTickets(s,[...heartbeat],effective,'heartbeat');
  const rotation=Math.floor(s.tick/EPOCH_SECONDS)%24;const order=[...AGENT_IDS.slice(rotation),...AGENT_IDS.slice(0,rotation)];
  const windowStart=s.persistent?.eventWindowStart??0;const allowance=Math.min(96,Math.floor(96*(s.tick-windowStart+1800)/HORIZON_SECONDS));const admitted=s.persistent?.eventWindowCount??s.eventDecisionCount;
  const extra=order.filter(id=>s.triggers[id]?.length&&!heartbeat.includes(id)).slice(0,Math.max(0,Math.min(2,allowance-admitted)));
  makeTickets(s,extra,effective,'event');
}
function settleBoundary(s:WorldState):boolean {
  if(s.settledTick===s.tick)return true;
  applyQueuedInterventions(s);
  const due=s.tickets.filter(t=>t.effectiveTick<=s.tick);
  if(due.some(t=>t.status!=='resolved')){s.blocked=true;s.phase=s.tick===0?'bootstrap':'barrier';return false;}
  const rotation=Math.floor(s.tick/EPOCH_SECONDS)%24;const rank=(id:AgentId)=>(AGENT_IDS.indexOf(id)-rotation+24)%24;
  for(const t of [...due].sort((a,b)=>rank(a.agentId)-rank(b.agentId)))commitTicket(s,t);
  s.tickets=s.tickets.filter(t=>t.effectiveTick>s.tick);s.blocked=false;s.phase='running';s.settledTick=s.tick;
  if(s.mode==='scenario'&&s.tick>=HORIZON_SECONDS){s.ended=true;s.phase='finished';emit(s,'afternoon_finished',null,{residentsFed:s.agents.filter(a=>a.fed).length,bridgeBuilt:s.crossing.bridgeBuilt},[],[],'finish');}
  else scheduleBoundary(s);
  if(s.tick%900===0){const checkpoint:Checkpoint={tick:s.tick,eventSeq:s.eventSeq,eventHash:s.eventHead,stateHash:hashState(s)};s.checkpoints.push(checkpoint);if(s.mode==='persistent'&&s.checkpoints.length>25)s.checkpoints.shift();}
  return true;
}

function tick(s:WorldState){
  s.tick++;
  if(s.persistent){
    if(s.tick%HORIZON_SECONDS===0){s.persistent.eventWindowStart=s.tick;s.persistent.eventWindowCount=0;}
    const hour=(12+Math.floor(s.tick/3600))%24;
    if(s.tick%3600===0&&(hour===20||hour===6)){const event=emit(s,hour===20?'night_started':'day_started',null,{day:s.persistent.day+(hour===6?1:0),hour},[...AGENT_IDS],[],'calendar');observe(s,event,[...AGENT_IDS],hour===20?'Night has fallen. Homes provide a place to rest.':'Dawn has arrived. A new working day begins.','saw',null,'weather');}
    if(s.tick%86400===64800){
      s.persistent.day++;s.persistent.lastDawn=s.tick;for(const a of s.agents){a.fed=false;trigger(s,a.id,'new_day');}
      const priorRemaining=s.externalBread,allocated=12-priorRemaining,priorQuotas={...s.interventionCounts};
      s.externalBread=12;s.persistent.outsideBreadAllocated=(s.persistent.outsideBreadAllocated??12)+allocated;s.interventionCounts=queuedQuotas(s,s.persistent.day);
      emit(s,'outside_reserve_allocated',null,{day:s.persistent.day,source:'daily external observer allowance',priorRemaining,allocated,remaining:12,totalAllocated:s.persistent.outsideBreadAllocated,priorQuotas,quotas:{rain:1,resourceDrop:3,message:3},alreadyReserved:{...s.interventionCounts},townFoodAdded:0},[],[],'observer');
      for(const [placeId,item,rate,cap] of [['granary','grain',6,18],['well','water',6,18],['timber-yard','timber',8,24]] as const){const target=placeById(s,placeId)!;const held=s.places.reduce((n,p)=>n+p.stock[item],0)+s.agents.reduce((n,a)=>n+a.inventory[item],0);const quantity=Math.max(0,Math.min(rate,cap-held));if(quantity){target.stock[item]+=quantity;s.ledger.environment[item]+=quantity;const ids=nearby(s,target,6);const event=emit(s,'renewable_resources_arrived',null,{placeId,item,quantity,day:s.persistent.day,source:item==='water'?'daily catchment':item==='grain'?'modeled daily harvest':'modeled managed woodland harvest',dailyRate:rate,worldStockCap:cap},ids,[],'ecology');observe(s,event,ids,`${quantity} ${item} arrived at ${target.name} through the modeled daily resource cycle.`,'saw',null,placeId,{placeId,stock:target.stock});for(const id of ids)trigger(s,id,'supplies_seen');}}
    }
    if(s.tick%60===0&&(hour>=20||hour<6))for(const a of s.agents){const home=placeById(s,a.homeId);if(home&&distance(a,home)===0&&a.intent?.action==='wait')a.needs.fatigue=Math.max(0,a.needs.fatigue-2);}
  }
  if(s.tick%300===0)for(const a of s.agents){const old=a.needs.hunger;if(!a.fed)a.needs.hunger=Math.min(100,old+1);if(old<70&&a.needs.hunger>=70)trigger(s,a.id,'hungry');if(s.tick%900===0)a.needs.fatigue=Math.min(100,a.needs.fatigue+1);}
  for(const r of s.reservations.filter(r=>r.expiresAt<=s.tick)){emit(s,'reservation_expired',r.agentId,{reservationId:r.id},[r.agentId]);}
  s.reservations=s.reservations.filter(r=>r.expiresAt>s.tick);
  for(const offer of s.offers)if(offer.status==='pending'&&offer.expiresAt<=s.tick){offer.status='expired';trigger(s,offer.fromId,'offer_expired');}
  s.offers=s.offers.filter(o=>o.status==='pending'||s.tick-o.createdAt<3600).slice(-48);
  if(s.oven.finishesAt!==null&&s.tick>=s.oven.finishesAt){const bakery=placeById(s,'bakery')!;bakery.stock.bread+=4;s.ledger.produced.bread+=4;const ids=nearby(s,bakery,6);const e=emit(s,'bread_baked',s.oven.workerId,{placeId:'bakery',quantity:4},ids);observe(s,e,ids,'Four loaves are ready at the bakery.','saw',null,'bakery',{placeId:'bakery',stock:bakery.stock});for(const id of ids)trigger(s,id,'bread_ready');const worker=s.oven.workerId?agentById(s,s.oven.workerId):null;if(worker?.intent?.action==='work')worker.intent.phase='at-oven';s.oven={startedAt:null,finishesAt:null,workerId:null};}
  if(s.weather.rainingUntil!==0&&s.tick===s.weather.rainingUntil){s.weather.rainingUntil=0;if(!s.claims.some(c=>c.id==='ford-open'))s.claims.push({id:'ford-open',text:'The low ford is open again.',subjectId:'bridge',kind:'fact',predicate:'fordBlocked',value:0});const ids=nearby(s,s.crossing,6);const e=emit(s,'ford_receded',null,{},ids);observe(s,e,ids,'The low ford is open again.','saw','ford-open','bridge');for(const id of ids)trigger(s,id,'crossing_changed');}
  const start=s.tick%24;for(let j=0;j<24;j++)processAgent(s,s.agents[(start+j)%24]);
}

export function advanceWorld(s:WorldState,seconds:number,options:AdvanceOptions={}):WorldState {
  if(!Number.isInteger(seconds)||seconds<0||seconds>(s.mode==='persistent'?86400:HORIZON_SECONDS))throw new Error('Advance seconds must be an integer within the scenario horizon');
  const next=copy(s);const initialTick=next.tick;const target=next.mode==='persistent'?next.tick+seconds:Math.min(HORIZON_SECONDS,next.tick+seconds);
  const ruleResolve=()=>{if(options.rulePolicy)for(const t of next.tickets.filter(t=>t.status==='pending'))resolveInPlace(next,t.id,chooseRuleDecision(t.context),'rule',null);};
  ruleResolve();
  if(next.tick%EPOCH_SECONDS===0&&!settleBoundary(next)){next.operations.push({type:'advance',seconds:0,rulePolicy:!!options.rulePolicy});return next;}
  while(next.tick<target&&!next.ended){ruleResolve();tick(next);if(next.tick%EPOCH_SECONDS===0){ruleResolve();if(!settleBoundary(next))break;}}
  next.operations.push({type:'advance',seconds:next.tick-initialTick,rulePolicy:!!options.rulePolicy});return next;
}

export function hashState(s:WorldState):string {
  const rest:Partial<WorldState>={...s};delete rest.events;delete rest.checkpoints;delete rest.operations;delete rest.origin;
  return hashValue({...rest,tickets:s.tickets.map(t=>({id:t.id,agentId:t.agentId,triggerKind:t.triggerKind,snapshotTick:t.snapshotTick,effectiveTick:t.effectiveTick,context:t.context,requestHash:t.requestHash}))});
}
export function projectObserver(s:WorldState):ObserverView {
  const meta=s.agents.reduce((n,a)=>n+a.decisions.meta,0),fallback=s.agents.reduce((n,a)=>n+a.decisions.fallback,0);
  return {branchId:s.branchId,worldMode:s.mode,persistent:s.persistent?{...s.persistent}:null,tick:s.tick,phase:s.phase,width:s.width,height:s.height,agents:clone(s.agents),places:clone(s.places),events:clone(s.events),notes:clone(s.notes),offers:clone(s.offers),claims:clone(s.claims),weather:{...s.weather},crossing:{...s.crossing},externalBread:s.externalBread,interventionCounts:{...s.interventionCounts},blocked:s.blocked,ended:s.ended,checkpoints:clone(s.checkpoints),mode:meta?(fallback?'hybrid':'live'):'rule',metrics:{fed:s.agents.filter(a=>a.fed).length,population:s.agents.length,breadConsumed:s.ledger.eaten.bread,bridgeProgress:Math.min(1,s.crossing.workSeconds/3600),decisions:s.decisionCount,metaDecisions:meta,fallbackDecisions:fallback}};
}
export function verifyWorld(s:WorldState):InvariantViolation[] {
  const errors:InvariantViolation[]=[];const bad=(code:string,message:string)=>errors.push({code,message});
  if(!s||!Array.isArray(s.agents)||!Array.isArray(s.places)||!Array.isArray(s.events)||!Array.isArray(s.claims)||!Array.isArray(s.tickets)||!Array.isArray(s.notes)||!Array.isArray(s.offers)||!Array.isArray(s.reservations)||!Array.isArray(s.checkpoints)||!s.ledger){bad('shape','Missing required world collections');return errors;}
  if(!Number.isInteger(s.tick)||s.tick<0||(s.mode!=='persistent'&&s.tick>HORIZON_SECONDS)||s.width!==WORLD_WIDTH||s.height!==WORLD_HEIGHT)bad('time_map','Invalid scenario tick or map bounds');
  if(s.events.length>MAX_EVENTS||s.places.length>32||s.claims.length>32||s.tickets.length>24||s.notes.length>(s.mode==='persistent'?72:3)||s.offers.length>48||s.reservations.length>24||s.checkpoints.length>25)bad('bounds','A bounded world collection exceeds its scenario limit');
  const claims=new Set(s.claims.map(c=>c.id));const residents=new Set(s.agents.map(a=>a.id));
  if(claims.size!==s.claims.length||new Set(s.places.map(p=>p.id)).size!==s.places.length)bad('identity','Claim and place identities must be unique');
  const validReceipt=(id:string,owner:AgentId)=>{if(typeof id!=='string'||!id.endsWith(`/o/${owner}`))return false;const eventId=id.slice(0,-(`/o/${owner}`).length);const seq=Number(eventId.slice(eventId.lastIndexOf(':')+1));return Number.isSafeInteger(seq)&&seq>=1&&seq<=s.eventSeq;};
  if(s.agents.length!==24||new Set(s.agents.map(a=>a.id)).size!==24||AGENT_IDS.some(id=>!agentById(s,id)))bad('census','Exactly 24 stable residents are required');
  for(const g of GOODS){const current=s.places.reduce((n,p)=>n+p.stock[g],0)+s.agents.reduce((n,a)=>n+a.inventory[g],0);const expected=s.ledger.initial[g]+s.ledger.external[g]+s.ledger.environment[g]+s.ledger.produced[g]-s.ledger.recipeConsumed[g]-s.ledger.eaten[g]-s.ledger.waste[g];if(current!==expected)bad('conservation',`${g}: expected ${expected}, got ${current}`);}
  for(const p of s.places)for(const g of GOODS)if(!Number.isInteger(p.stock[g])||p.stock[g]<0)bad('stock',`${p.id} has invalid ${g}`);
  for(const a of s.agents){if(GOODS.some(g=>!Number.isInteger(a.inventory[g])||a.inventory[g]<0)||GOODS.reduce((n,g)=>n+a.inventory[g],0)>2)bad('inventory',`${a.id} has invalid inventory`);if(!Number.isInteger(a.x)||!Number.isInteger(a.y)||a.x<1||a.x>=s.width-1||a.y<1||a.y>=s.height-1||(a.x===RIVER_X&&a.y!==FORD_Y))bad('position',`${a.id} left walkable map geometry`);
    if(a.observations.length>MAX_OBSERVATIONS||a.memories.length>48||a.goals.length>8||Object.keys(a.relationships).length>24||Object.keys(a.beliefs).length>32)bad('memory_bounds',`${a.id} exceeds bounded cognition limits`);
    for(const o of a.observations){if(!validReceipt(o.id,a.id)||o.id!==`${o.eventId}/o/${a.id}`||!Number.isInteger(o.tick)||o.tick<0||o.tick>s.tick||o.claimId!==null&&!claims.has(o.claimId))bad('knowledge',`${a.id} owns an invalid, future, or unknown-claim observation`);const retained=s.events.find(e=>e.id===o.eventId);if(retained&&!retained.audience.includes(a.id))bad('knowledge',`${a.id} did not receive retained event ${o.eventId}`);}
    for(const id of a.memories)if(!validReceipt(id,a.id))bad('memory',`${a.id} has an invalid memory receipt`);
    for(const [key,b]of Object.entries(a.beliefs))if(key!==b.claimId||!claims.has(key)||!Number.isInteger(b.updatedAt)||b.updatedAt>s.tick||b.updatedAt<0||!Number.isInteger(b.confidence)||b.confidence<0||b.confidence>100||!['believe','doubt','reject'].includes(b.stance)||b.evidenceIds.length<1||b.evidenceIds.some(id=>!validReceipt(id,a.id)))bad('belief',`${a.id} has an invalid belief or source reference`);
    for(const [id,r]of Object.entries(a.relationships))if(!residents.has(id as AgentId)||!r||r.trust<0||r.trust>100||r.affinity<0||r.affinity>100)bad('relationship',`${a.id} has an invalid social tie`);
  }
  if(!Number.isInteger(s.externalBread)||s.externalBread<0||s.externalBread>12||s.externalBread+s.ledger.external.bread!==(s.persistent?.outsideBreadAllocated??12))bad('external','Outside reserve allocation and physical deliveries do not reconcile');
  if((s.mode==='scenario'&&s.ledger.eaten.bread!==s.agents.filter(a=>a.fed).length)||(s.mode==='persistent'&&s.ledger.eaten.bread<s.agents.filter(a=>a.fed).length))bad('meals','One afternoon meal must correspond to exactly one unique fed resident');
  for(const p of s.places)for(const g of GOODS)if(s.reservations.filter(r=>r.placeId===p.id&&r.item===g).reduce((n,r)=>n+r.quantity,0)>p.stock[g])bad('reservation',`${p.id} over-reserves ${g}`);
  for(const note of s.notes)if(!residents.has(note.recipientId)||!claims.has(note.claimId)||note.deliveredAt>s.tick||(note.readAt!==null&&(note.readAt<note.deliveredAt||note.readAt>s.tick)))bad('note','Invalid note recipient, claim, or receipt time');
  for(const ticket of s.tickets)if(!residents.has(ticket.agentId)||ticket.context.agent.id!==ticket.agentId||ticket.context.tick!==ticket.snapshotTick||ticket.snapshotTick>s.tick||ticket.effectiveTick<ticket.snapshotTick||ticket.requestHash!==hashValue(ticket.context)||ticket.context.observations.some(o=>!validReceipt(o.id,ticket.agentId)||o.tick>ticket.snapshotTick)||ticket.context.claims.some(c=>!claims.has(c.id)))bad('ticket','Invalid frozen decision request');
  for(let index=0;index<s.events.length;index++){const event=s.events[index];const {hash,...body}=event;if(hashValue(body)!==hash)bad('event_hash',`Event ${event.id} has an invalid digest`);if(index>0&&(event.prevHash!==s.events[index-1].hash||event.seq!==s.events[index-1].seq+1))bad('event_chain',`Event ${event.id} breaks the retained chain`);}
  if(s.events.length&&(s.events.at(-1)!.hash!==s.eventHead||s.events.at(-1)!.seq!==s.eventSeq))bad('event_head','Retained events do not end at the authoritative head');
  if((s.persistent?.eventWindowCount??s.eventDecisionCount)>96)bad('scheduler','Too many event-triggered decisions');if(s.mode==='scenario'&&s.decisionCount>384)bad('scheduler','Too many accepted logical decisions');return errors;
}

export function exportRecording(s:WorldState):Recording{return {version:1,engineVersion:s.engineVersion,contentVersion:s.contentVersion,origin:clone(s.origin),operations:clone(s.operations),finalTick:s.tick,finalHash:hashState(s),eventHead:s.eventHead,checkpoints:clone(s.checkpoints)};}
function worldFromOrigin(origin:Recording['origin']):WorldState {
  if(origin.checkpointState){const state=JSON.parse(origin.checkpointState) as WorldState;if(state.version!==1||state.engineVersion!==ENGINE_VERSION||state.contentVersion!==CONTENT_VERSION)throw new Error('Unsupported checkpoint version');if(verifyWorld(state).length)throw new Error('Invalid branch checkpoint');state.operations=[];state.origin=clone(origin);return state;}
  return initializeWorld(origin.seed,origin.branchId,{mode:origin.mode??'scenario'});
}
export function replayRecording(recording:Recording,options:{untilTick?:number;verify?:boolean}={}):WorldState {
  if(recording.version!==1||recording.engineVersion!==ENGINE_VERSION||recording.contentVersion!==CONTENT_VERSION)throw new Error('Unsupported recording version');
  const until=options.untilTick===undefined?recording.finalTick:clamp(Math.floor(options.untilTick),0,recording.finalTick);let s=worldFromOrigin(recording.origin);
  if(until<s.tick)throw new Error('The requested time predates this branch origin');
  for(const op of recording.operations){
    if(op.type==='decision'){
      const ticket=s.tickets.find(t=>t.id===op.ticketId);if(!ticket)throw new Error('Recording refers to a missing decision ticket');if(ticket.effectiveTick>until&&options.untilTick!==undefined)continue;s=applyDecision(s,op.ticketId,op.proposal,op.provenance,op.failure);
    }else if(op.type==='intervention'){if(s.tick>=until&&options.untilTick!==undefined)continue;s=applyIntervention(s,op.command);}
    else {const amount=Math.min(op.seconds,Math.max(0,until-s.tick));s=advanceWorld(s,amount,{rulePolicy:op.rulePolicy});if(s.tick>=until&&op.seconds>amount)break;}
    if(s.tick>until)throw new Error('Recording advanced beyond requested time');
  }
  if(options.untilTick===undefined&&options.verify!==false){if(hashState(s)!==recording.finalHash||s.eventHead!==recording.eventHead||s.tick!==recording.finalTick||canonicalStringify(s.checkpoints)!==canonicalStringify(recording.checkpoints))throw new Error('Recording state or event hash mismatch');if(verifyWorld(s).length)throw new Error('Replayed state violates world invariants');}
  return s;
}
export function rewindWorld(s:WorldState,tick:number):WorldState {if(!Number.isInteger(tick)||tick<0||tick>s.tick)throw new Error('Invalid rewind tick');return replayRecording(exportRecording(s),{untilTick:tick,verify:false});}
export function forkWorld(s:WorldState,branchId:string):WorldState {
  if(s.tick%EPOCH_SECONDS!==0||s.blocked||s.settledTick!==s.tick||s.tickets.some(t=>t.effectiveTick<=s.tick&&t.status!=='resolved'))throw new Error('Fork only from a settled epoch checkpoint');
  if(!branchId||branchId===s.branchId||branchId.length>100)throw new Error('A new branch identity is required');
  const next=copy(s);const future=next.tickets.map(t=>({agentId:t.agentId,triggerKind:t.triggerKind,effectiveTick:t.effectiveTick}));next.parentBranchId=s.branchId;next.branchId=branchId;next.tickets=[];next.operations=[];next.origin={seed:s.seed,branchId,parentBranchId:s.branchId,mode:s.mode};
  emit(next,'branch_forked',null,{parentBranchId:s.branchId,parentEventHash:s.eventHead,at:s.tick},[],[],'origin');
  for(const t of future){const previousCount=next.eventDecisionCount,windowCount=next.persistent?.eventWindowCount;makeTickets(next,[t.agentId],t.effectiveTick,t.triggerKind);if(t.triggerKind==='event'){next.eventDecisionCount=previousCount;if(next.persistent&&windowCount!==undefined)next.persistent.eventWindowCount=windowCount;}}
  const base=copy(next);base.operations=[];base.origin={seed:s.seed,branchId,parentBranchId:s.branchId,mode:s.mode};next.origin={...base.origin,checkpointState:canonicalStringify(base)};return next;
}
/**
 * Produces both halves of an archival rollover. The caller must durably save archive
 * before replacing its head with state; this function never silently discards history.
 * The archive closes at priorArchiveHash and the new checkpoint logs that exact link.
 */
export function checkpointPersistentWorld(s:WorldState):{state:WorldState;archive:Recording}{
  if(s.mode!=='persistent'||s.blocked||s.tick%EPOCH_SECONDS!==0||s.settledTick!==s.tick)throw new Error('Checkpoint a settled persistent epoch only');
  const archive=exportRecording(s),next=copy(s);next.operations=[];
  emit(next,'history_checkpointed',null,{priorArchiveHash:archive.finalHash,priorEventHash:archive.eventHead,at:s.tick},[],[],'archive');
  const origin={seed:s.seed,branchId:s.branchId,parentBranchId:s.parentBranchId,mode:'persistent' as const,priorArchiveHash:archive.finalHash};
  next.origin=origin;const base=copy(next);base.origin=origin;base.operations=[];
  next.origin={...origin,checkpointState:canonicalStringify(base)};
  return {state:next,archive};
}
export function runRuleWorld(seed=1,commands:({at:number;command:Intervention}|Intervention)[]=[]):WorldState {
  let s=initializeWorld(seed);const timed=commands.map(c=>'at'in c?c:{at:0,command:c}).sort((a,b)=>a.at-b.at);let index=0;
  while(!s.ended){while(index<timed.length&&timed[index].at<=s.tick){s=applyIntervention(s,timed[index].command);index++;}const nextCommand=timed[index]?.at??HORIZON_SECONDS;const step=Math.max(1,Math.min(300,nextCommand-s.tick||300));s=advanceWorld(s,step,{rulePolicy:true});}
  return s;
}
