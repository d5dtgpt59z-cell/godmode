import {test} from "node:test";
import assert from "node:assert/strict";
import {ForegroundInitiativePump,type PumpGate,type InitiativeOutcome} from "../components/cozy/initiative-pump";
import {causalReceipts,socialNotice,taskLabel,provenanceLabel,memorySummary} from "../components/cozy/social-presentation";
import {initializeCozyWorld} from "../lib/cozy/world";
import type {CozyEvent} from "../lib/cozy/contracts";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {EmergenceNotebook} from "../components/cozy/cozy-emergence";
import {upgradeCozyWorld} from "../lib/cozy/replay";
import type {CozySaveDTO} from "../lib/server/cozy-contract";
import ResidentPage,{PersonalNotes,personalStepLabel} from "../components/cozy/cozy-resident";
import DeveloperInspection from "../components/cozy/cozy-developer";
import {interactionApproach,type InteractionTrack} from "../components/cozy/interaction-approach";

const gate=(changes:Partial<PumpGate>={}):PumpGate=>({saveId:"town-a",living:true,recorded:false,paused:false,visible:true,enabled:true,eligible:true,pending:false,remainingTotal:10,hourCalls:0,hourLimit:12,...changes});
function harness(){let now=0,id=0;const data=new Map<string,string>();const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};return{pump:new ForegroundInitiativePump(()=>"request:"+(++id),()=>now,storage),advance:(ms:number)=>{now+=ms;},data,storage,time:()=>now};}
const outcome=(status:InitiativeOutcome)=>({initiative:{status}});

test("foreground initiative never dispatches for paused, hidden, recorded, legacy, disabled or exhausted worlds",async()=>{
 const h=harness();let calls=0;const request=async()=>{calls++;return outcome("idle");};
 for(const override of [{paused:true},{visible:false},{recorded:true},{living:false},{enabled:false},{eligible:false},{remainingTotal:0},{hourCalls:12}])assert.equal(await h.pump.run(gate(override),request),null);
 assert.equal(calls,0);assert.ok(await h.pump.run(gate(),request));assert.equal(calls,1);
});
test("one slow model request coalesces repeated polls without occupying a physical command queue",async()=>{
 const h=harness();let finish!:(value:ReturnType<typeof outcome>)=>void;let calls=0;const first=h.pump.run(gate(),()=>{calls++;return new Promise<ReturnType<typeof outcome>>(resolve=>{finish=resolve;});});
 assert.equal(await h.pump.run(gate(),async()=>{calls++;return outcome("idle");}),null);
 // A completely independent physical operation remains runnable while inference is unresolved.
 let physicalStep=0;await Promise.resolve().then(()=>{physicalStep++;});assert.equal(physicalStep,1);assert.equal(calls,1);
 finish(outcome("applied"));assert.equal((await first)?.saveId,"town-a");
});
test("busy and lost responses retain the same request ID, including a page coordinator restart",async()=>{
 const h=harness(),ids:string[]=[];
 await assert.rejects(h.pump.run(gate(),async(_save,id)=>{ids.push(id);throw Object.assign(new Error("busy"),{code:"COZY_BUSY"});}));
 h.advance(5000);const restarted=new ForegroundInitiativePump(()=>"new-id",h.time,h.storage);
 await restarted.run(gate({eligible:false,pending:true}),async(_save,id)=>{ids.push(id);return outcome("pending");});
 h.advance(3000);await restarted.run(gate({eligible:false,pending:true}),async(_save,id)=>{ids.push(id);return outcome("applied");});
 assert.deepEqual(ids,["request:1","request:1","request:1"]);assert.equal(h.data.size,0);
});
test("pause retains a pending receipt and resume recovers it without a new generation ID",async()=>{
 const h=harness(),ids:string[]=[];await h.pump.run(gate(),async(_save,id)=>{ids.push(id);return outcome("pending");});h.advance(3000);
 assert.equal(await h.pump.run(gate({paused:true}),async()=>outcome("applied")),null);
 await h.pump.run(gate({eligible:false,pending:true}),async(_save,id)=>{ids.push(id);return outcome("applied");});assert.deepEqual(ids,["request:1","request:1"]);
});
test("empty-storage pending ticket uses one stable recovery-only probe despite admission limits",async()=>{
 const h=harness(),requests:{id:string;recoveryOnly:boolean}[]=[];let generations=0;
 const pendingGate=gate({pending:true,eligible:false,remainingTotal:0,hourCalls:12});
 const request=async(_save:string,id:string,recoveryOnly:boolean)=>{requests.push({id,recoveryOnly});if(!recoveryOnly)generations++;return outcome("pending");};
 await h.pump.run(pendingGate,request);assert.equal(await h.pump.run(pendingGate,request),null);
 h.advance(3000);const restarted=new ForegroundInitiativePump(()=>"different-id",h.time,h.storage);
 await restarted.run(pendingGate,async(_save,id,recoveryOnly)=>{requests.push({id,recoveryOnly});if(!recoveryOnly)generations++;return outcome("applied");});
 assert.deepEqual(requests,[{id:"request:1",recoveryOnly:true},{id:"request:1",recoveryOnly:true}]);assert.equal(generations,0);assert.equal(h.data.size,0);
});
test("fresh tab leaves a paused ready ticket alone, then resumes it through a recovery-only probe",async()=>{
 const h=harness(),requests:boolean[]=[];const request=async(_save:string,_id:string,recoveryOnly:boolean)=>{requests.push(recoveryOnly);return outcome("applied");};
 assert.equal(await h.pump.run(gate({paused:true,pending:true,eligible:false}),request),null);assert.equal(h.data.size,0);
 await h.pump.run(gate({pending:true,eligible:false}),request);assert.deepEqual(requests,[true]);
});
test("terminal unknown outcome observes provider quarantine and never retries the previous generation ID",async()=>{
 const h=harness(),ids:string[]=[];await h.pump.run(gate(),async(_save,id)=>{ids.push(id);return outcome("unknown");});h.advance(129999);
 assert.equal(await h.pump.run(gate(),async()=>outcome("idle")),null);h.advance(1);await h.pump.run(gate(),async(_save,id)=>{ids.push(id);return outcome("abstained");});assert.deepEqual(ids,["request:1","request:2"]);
});
test("a completed response carries its original save ID for caller stale-save guards",async()=>{
 const h=harness();const result=await h.pump.run(gate({saveId:"old-town"}),async()=>outcome("applied"));assert.equal(result?.saveId,"old-town");
});
test("idle polling backs off and allocates a fresh opportunity ID",async()=>{
 const h=harness(),ids:string[]=[];const request=async(_save:string,id:string)=>{ids.push(id);return outcome("idle");};await h.pump.run(gate(),request);h.advance(4999);assert.equal(await h.pump.run(gate(),request),null);h.advance(1);await h.pump.run(gate(),request);assert.deepEqual(ids,["request:1","request:2"]);
});
const event=(id:string,changes:Partial<CozyEvent>={}):CozyEvent=>({id,seq:1,step:10,tick:1,type:"field_inspected",actorId:"ada",audience:["ada"],payload:{},sourceIds:[],rulesRevision:0,prevHash:"0".repeat(64),hash:"1".repeat(64),...changes});
test("private social observations do not become player notices",()=>{
 const state=initializeCozyWorld(137,"ui-test"),privateEvent=event("private",{type:"social_proposal_created"});assert.equal(socialNotice(state,[privateEvent]),null);
 const publicEvent=event("heard",{type:"social_proposal_delivered",audience:["ada","player"]});assert.equal(socialNotice(state,[privateEvent,publicEvent])?.eventId,"heard");
});
test("causal notebook follows cited receipts, not adjacent unrelated events, and reports missing references",()=>{
 const state=initializeCozyWorld(137,"ui-test");state.events=[event("cause"),event("unrelated",{seq:2}),event("effect",{seq:3,sourceIds:["cause","gone"]})];
 state.npcs[0].memories.push({id:"receipt",step:10,type:"field_inspected",text:"Observed",sourceIds:["effect"],actorId:"ada"});
 const result=causalReceipts(state,["receipt"]);assert.deepEqual(result.events.map(row=>row.id),["cause","effect"]);assert.deepEqual(result.missing,["gone"]);
});
test("doing labels reflect accepted physical tasks rather than generated reason text",()=>{
 const state=initializeCozyWorld(137,"ui-test"),npc=state.npcs[0];npc.reason="I already delivered ten imaginary loaves";npc.task={kind:"food",targetId:"square",remainingSteps:20,reason:npc.reason,ruleRevision:0,phase:"deliver",quantity:2};assert.equal(taskLabel(state,npc),"Bringing 2 wheat to Village square");
});
test("idea provenance keeps fixtures, manual input and actual provider modes distinct",()=>{
 assert.equal(provenanceLabel({mode:"fixture"}),"Recorded fixture idea");assert.equal(provenanceLabel({mode:"local-qwen"}),"Local Qwen idea");assert.equal(provenanceLabel({mode:"manual"}),"Manually recorded idea");
});

function presentationSave(living=false):CozySaveDTO{
 const legacy=initializeCozyWorld(137,"ui-test"),state=living?upgradeCozyWorld(legacy,"ui-living"):legacy;
 return{id:"town-a",revision:1,mode:"manual",state,view:state,rulesRevision:0,capsHash:"test",historyStartStep:0,parentId:living?"old-town":null,createdAt:"2026-10-25T12:00:00Z",clock:{paused:true,pace:1,dueSeconds:0,lastWallAt:"2026-10-25T12:00:00Z",lastTickAt:null,lastBackgroundTickAt:null},background:{writerEnabled:false,serviceTickVerified:false},budget:{reservedMicroUsd:0,spentMicroUsd:0,limitMicroUsd:0,generationAttempts:0,httpRequests:0},provenance:{simulation:"rule-policy",imported:false,label:"Rule-policy simulation",actualMetaCalls:0,actualLocalCalls:0,eligibility:"unconfirmed"},socialPreviews:[],initiative:{kind:"social",enabled:false,eligible:false,pending:false,lastOutcome:null,lastAt:null,actualCalls:0,remainingTotal:6,hourCalls:0,hourLimit:12},proposals:[],ruleChanges:[]};
}
const renderNotebook=(save:CozySaveDTO)=>renderToStaticMarkup(createElement(EmergenceNotebook,{save,busy:false,available:false,falseReason:"Local initiative is disabled.",onEvolve:()=>{},onPlay:()=>{},onDecision:()=>{},onResident:()=>{}}));
test("legacy notebook explicitly offers an independent paused living branch without inventing a proposal",()=>{
 const html=renderNotebook(presentationSave());assert.match(html,/Start a living branch/);assert.match(html,/new branch starts paused/);assert.doesNotMatch(html,/Allow these changes/);
});
test("empty living branch renders honest quiet state and paused guidance without diagnostic counters",()=>{
 const html=renderNotebook(presentationSave(true));assert.match(html,/No shared charter has been proposed/);assert.match(html,/Press Play/);assert.match(html,/New personal ideas are resting/);assert.doesNotMatch(html,/Captured initiative calls/);assert.doesNotMatch(html,/Start a living branch|Allow these changes/);
});
test("permission controls require the actual exact preview and preserve independent refusal",()=>{
 const save=presentationSave(true),emergence=save.state.emergence!;
 emergence.proposals.push({id:"proposal-test",kind:"cooperative-charter",capability:"shared-gathering",authorId:"ada",name:"The Little Table",purpose:"Share a finite meal.",charter:{venue:"square",grainTarget:3,seedFloor:1},createdStep:0,revision:1,status:"formed",deliveries:{},responses:{mara:{stance:"decline",conditions:["trust"],reason:"Not yet.",evidenceIds:[],decidedStep:0,eventId:"response-test",provenance:"deterministic-policy"}},institutionId:"group-test",provenance:{mode:"fixture"},sourceIds:[]});
 emergence.institutions.push({id:"group-test",proposalId:"proposal-test",name:"The Little Table",purpose:"Share a finite meal.",founderId:"ada",leaderId:"ada",members:["ada","wren"],formedStep:0,status:"waiting-permission",permission:"pending",practices:[],resourceAccount:{kind:"festival",festivalId:save.state.festival.id,venue:"square",grainTarget:3,seedFloor:1},history:[]});
 let html=renderNotebook(save);assert.match(html,/Declines this plan/);assert.match(html,/Recorded fixture idea/);assert.doesNotMatch(html,/>Allow these changes/);assert.match(html,/Decline this request/);
 save.socialPreviews=[{proposalId:"proposal-test",preview:{valid:true,errors:[],expectedRulesRevision:0,previous:save.state.rules,next:{...save.state.rules,organizer:"villagers"},changes:[{field:"organizer",from:"player",to:"villagers"}],warnings:[],capsHash:"test"}}];
 html=renderNotebook(save);assert.match(html,/>Allow these changes/);assert.match(html,/<s>You<\/s>/);assert.match(html,/The neighbors/);
 save.state.rules.organizer="villagers";
 save.socialPreviews[0].preview.changes=[{field:"foodTarget",from:4,to:3},{field:"seedReserve",from:0,to:1}];
 html=renderNotebook(save);assert.match(html,/>Allow these changes/);assert.match(html,/Wheat for the table/);assert.match(html,/Seeds kept safe/);
 emergence.institutions[0].permission="approved";
 html=renderNotebook(save);assert.match(html,/>Restore these agreed rules/);assert.match(html,/town rules no longer support their agreed charter/);
 emergence.institutions[0].status="resting";
 html=renderNotebook(save);assert.doesNotMatch(html,/<details class="cozy-shared-plan" open/);
 emergence.institutions[0].permission="declined";
 html=renderNotebook(save);assert.doesNotMatch(html,/>Allow these changes|>Restore these agreed rules/);
});

test("resident page leads with original portrait, needs and social actions; raw policy stays in inspection",()=>{
 const save=presentationSave(true),npc=save.state.npcs.find(value=>value.id==="wren")!;npc.reason="commitment score 999";npc.memories.push({id:"raw-private-id",step:10,type:"initiative_waited",text:"I chose to wait: hidden policy calculation",sourceIds:["raw-event-id"],actorId:"wren"});
 const html=renderToStaticMarkup(createElement(ResidentPage,{state:save.state,npc,onGift:()=>{},onTalk:()=>{},onInspect:()=>{}}));
 assert.match(html,/portraits\/wren-neutral.png/);assert.match(html,/Have a chat/);assert.match(html,/Well rested/);assert.doesNotMatch(html,/commitment score|raw-private-id|raw-event-id|51 \/ 100|Captured.*calls/);
 const inspection=renderToStaticMarkup(createElement(DeveloperInspection,{save,proof:"replay-hash-for-inspection",onHistory:()=>{}}));assert.match(inspection,/commitment score 999|raw-private-id/);assert.match(inspection,/Captured local Qwen calls/);
});
test("personal notes separate an unfinished wish from a completed supported plan and mark uncertain beliefs",()=>{
 const save=presentationSave(true);save.state.mind={version:1,npcId:"wren",values:{care:65,curiosity:90,belonging:80,autonomy:70},preferences:{food:"bread",restPlaceId:"wren-home"},relationships:{player:{actorId:"player",trust:50,affinity:40,helpfulness:0,basis:"seeded",lastInteractionStep:null,evidenceIds:[]},ada:{actorId:"ada",trust:50,affinity:40,helpfulness:0,basis:"seeded",lastInteractionStep:null,evidenceIds:[]},mara:{actorId:"mara",trust:50,affinity:40,helpfulness:0,basis:"seeded",lastInteractionStep:null,evidenceIds:[]},wren:{actorId:"wren",trust:100,affinity:100,helpfulness:0,basis:"seeded",lastInteractionStep:null,evidenceIds:[]}},beliefs:[{id:"belief-private-id",subject:"the garden",claim:"The wheat may be ready.",expectedValue:null,confidence:40,kind:"inference",status:"tentative",sourceId:null,observedStep:0,updatedStep:0,evidenceIds:[]}],aspirations:[{id:"wish-private-id",title:"A lantern that remembers",description:"An unusual wish for a lantern that recalls our stories.",motivation:"I want to remember this place.",requestedCapability:"remembering-lantern",capabilityRequestId:"missing-mechanic-id",status:"imagined",createdStep:0,updatedStep:0,provenance:{mode:"fixture"},evidenceIds:[],history:[]}],capabilityRequests:[],plan:{id:"plan-private-id",aspirationId:null,summary:"Look at the square",status:"completed",steps:[{id:"step-private-id",action:"inspect",targetId:"square",durationSteps:20,speech:null,status:"completed",startedStep:0,completedStep:20,resultEventIds:["real-inspection-event"],blockedReason:null}],currentStep:1,createdStep:0,updatedStep:20,blockedReason:null,provenance:{mode:"fixture"},evidenceIds:[]},pastPlans:[],history:[],lastDecisionStep:0,intentRevision:0,observationCursor:0,nextReconsiderStep:0,foodSearchBackoffUntil:0,lastConsideredTrigger:null,regulation:null};
 const html=renderToStaticMarkup(createElement(PersonalNotes,{state:save.state}));assert.match(html,/Private notes/);assert.match(html,/An idea for someday/);assert.match(html,/A small plan, finished/);assert.match(html,/It has not been made possible/);assert.match(html,/Still uncertain/);assert.match(html,/>Done<\/small>/);assert.equal(personalStepLabel(save.state,{...save.state.mind.plan!.steps[0],targetId:save.state.plots[0].id}),"Take a closer look at the wheat field");assert.doesNotMatch(html,/wish-private-id|step-private-id|real-inspection-event|Captured/);
 save.state.mind.beliefs[0].status="contradicted";const contradicted=renderToStaticMarkup(createElement(PersonalNotes,{state:save.state}));assert.match(contradicted,/Contradicted by evidence/);assert.match(contradicted,/<s>The wheat may be ready.<\/s>/);
 const resident=renderToStaticMarkup(createElement(ResidentPage,{state:save.state,npc:save.state.npcs.find(value=>value.id==="wren")!,onGift:()=>{},onTalk:()=>{},onShareIdea:()=>{},onInspect:()=>{}}));assert.match(resident,/Tell Wren an idea/);
});
test("normal memory wording uses recorded stance instead of policy formula",()=>{
 const save=presentationSave(true);const response={stance:"join" as const,conditions:[],reason:"commitment score 52",evidenceIds:[],decidedStep:0,eventId:"response-id",provenance:"deterministic-policy" as const};save.state.emergence!.proposals.push({id:"proposal",kind:"cooperative-charter",capability:"shared-gathering",authorId:"wren",name:"A shared table",purpose:"Meet",charter:{venue:"square",grainTarget:3,seedFloor:1},createdStep:0,revision:1,status:"awaiting-responses",deliveries:{},responses:{wren:response},institutionId:null,provenance:{mode:"fixture"},sourceIds:[]});
 assert.equal(memorySummary(save.state,{id:"memory",step:0,type:"npc_dialogue",text:"commitment score 52",sourceIds:["response-id"],actorId:"wren"}),"Chose to lend a hand.");
});

test("moving-neighbor approach uses current position and throttles meaningful reroutes",()=>{
 const state=initializeCozyWorld(137,"tracking-ui"),target=state.npcs.find(npc=>npc.id==="wren")!;state.player.x=5;state.player.y=10;state.player.path=[{x:6,y:10}];state.step=40;target.x=12;target.y=10;
 const track:InteractionTrack={point:{x:5,y:10},targetNpcId:"wren",routeTarget:{x:8,y:10},lastRouteStep:0,routeCount:1,startedStep:0};
 assert.deepEqual(interactionApproach(state,track),{kind:"route",point:{x:12,y:10}});
 const updated={...track,routeTarget:{x:12,y:10},lastRouteStep:40,routeCount:2};state.step=45;target.x=14;assert.deepEqual(interactionApproach(state,updated),{kind:"wait"});
 state.step=60;assert.deepEqual(interactionApproach(state,updated),{kind:"route",point:{x:14,y:10}});
});
test("neighbor interaction delivers only in current physical range and remains bounded",()=>{
 const state=initializeCozyWorld(137,"tracking-ui"),target=state.npcs.find(npc=>npc.id==="wren")!;state.player.x=5;state.player.y=10;target.x=6;target.y=10;
 const track:InteractionTrack={point:{x:25,y:20},targetNpcId:"wren",routeTarget:null,lastRouteStep:-5,routeCount:0,startedStep:0};assert.equal(interactionApproach(state,track).kind,"deliver");target.x=20;assert.equal(interactionApproach(state,{...track,routeCount:12}).kind,"expired");state.step=1200;assert.equal(interactionApproach(state,track).kind,"expired");
});
