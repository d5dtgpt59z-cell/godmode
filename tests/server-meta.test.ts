import test from 'node:test';
import assert from 'node:assert/strict';
import {ModelDecisionError,compactContext,requestDecision,validateProposal} from '../lib/server/meta-adapter';
import type {AgentContext,DecisionProposal} from '../lib/sim/contracts';
const context:AgentContext={agent:{id:'iona',name:'Iona',role:'coordinator',x:1,y:1,traits:[],capabilities:[],inventory:{grain:0,water:0,timber:0,bread:0},needs:{hunger:50,fatigue:0},fed:false,goals:[{id:'eat',label:'Find food',weight:100}],currentAction:'waiting',contributions:{deliveries:0,workSeconds:0,shared:0}},tick:0,time:'12:00',places:[{id:'square',name:'Square',kind:'public',x:1,y:1,stock:null,accessible:true}],nearbyAgents:[],observations:[{id:'obs1',eventId:'e1',tick:0,channel:'saw',text:'The square is nearby.',claimId:null,sourceId:null}],beliefs:[],relationships:[],notes:[],offers:[],claims:[],allowedActions:['wait','move']};
const proposal:DecisionProposal={action:'wait',targetId:null,item:null,quantity:0,duration:300,claimId:null,utterance:'',goalId:'eat',evidenceIds:['obs1'],beliefUpdates:[],reason:'I will wait briefly.'};
const fixture=(content=proposal,usage={input_tokens:500,output_tokens:120,output_tokens_details:{reasoning_tokens:20}})=>({id:'resp_synthetic_fixture',model:'muse-spark-1.3',status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(content)}]}],usage});

test('missing or disabled Meta never sends a request',async()=>{
 let calls=0;const fetcher:typeof fetch=async()=>{calls++;throw new Error('must not run');};
 await assert.rejects(requestDecision(context,{enabled:false,apiKey:'fixture',fetcher}),/not connected/);
 await assert.rejects(requestDecision(context,{enabled:true,fetcher}),/not connected/);assert.equal(calls,0);
});
test('exact count preflight and generation capture real-response-shaped usage without live calls',async()=>{
 const requests:string[]=[];const kinds:string[]=[];
 const fetcher:typeof fetch=async(url,init)=>{requests.push(String(url));const body=JSON.parse(String(init?.body));assert.equal(body.max_output_tokens,768);assert.equal(body.reasoning.effort,'minimal');assert.equal(body.text.format.strict,true);return Response.json(requests.length===1?{input_tokens:1500}:fixture());};
 const result=await requestDecision(context,{enabled:true,apiKey:'synthetic-only',fetcher,beforeRequest:async kind=>{kinds.push(kind);}});
 assert.deepEqual(kinds,['count','generation']);assert.ok(requests[0].endsWith('/responses/input_tokens'));assert.equal(result.responseId,'resp_synthetic_fixture');assert.equal(result.reasoningTokens,20);assert.equal(result.actualMicroUsd,1135);
});
test('over-limit input prevents generation',async()=>{
 let calls=0;await assert.rejects(requestDecision(context,{enabled:true,apiKey:'fixture',fetcher:async()=>{calls++;return Response.json({input_tokens:2001});}}),/2,000-token/);assert.equal(calls,1);
});
test('unknown resident evidence, targets and illegal behavior are rejected',()=>{
 assert.throws(()=>validateProposal({...proposal,evidenceIds:['other-resident-secret']},context),/did not receive/);
 assert.throws(()=>validateProposal({...proposal,targetId:'hidden-warehouse'},context),/outside/);
 assert.throws(()=>validateProposal({...proposal,action:'spawn-bread'},context),/contract/);
 assert.throws(()=>validateProposal({...proposal,quantity:Infinity},context),/contract/);
});
test('compact knowledge retains a distant worksite and received note evidence',()=>{
 const received={...context.observations[0],id:'read-note',channel:'read' as const,claimId:'received-claim'};
 const full:AgentContext={...context,places:[...context.places,...Array.from({length:8},(_,i)=>({...context.places[0],id:`place-${i}`})),{...context.places[0],id:'bridge'}],observations:[received,...Array.from({length:10},(_,i)=>({...context.observations[0],id:`later-${i}`}))],claims:[{id:'received-claim',kind:'fact',subjectId:'granary',predicate:'stock',value:'low',text:'An explicitly received claim.'}]};
 const compact=compactContext(full);assert.ok(compact.places.some(place=>place.id==='bridge'));assert.ok(compact.observations.some(o=>o.id==='read-note'));assert.ok(compact.claims.some(c=>c.id==='received-claim'));
});
test('invalid generation retains provider response and billed usage audit',async()=>{
 let calls=0;try{await requestDecision(context,{enabled:true,apiKey:'fixture',fetcher:async()=>Response.json(++calls===1?{input_tokens:1000}:fixture({...proposal,evidenceIds:['not-seen']}))});assert.fail();}catch(error){assert.ok(error instanceof ModelDecisionError);assert.equal(error.audit.responseId,'resp_synthetic_fixture');assert.equal(error.audit.outputTokens,120);assert.equal(error.audit.actualMicroUsd,1135);}
});
test('provider failures are sanitized and deadlines do not fabricate decisions',async()=>{
 await assert.rejects(requestDecision(context,{enabled:true,apiKey:'secret-never-returned',fetcher:async()=>new Response('private secret-never-returned',{status:402})}),error=>error instanceof Error&&!error.message.includes('secret-never-returned'));
 await assert.rejects(requestDecision(context,{enabled:true,apiKey:'fixture',timeoutMs:5,fetcher:()=>new Promise(()=>{})}),/timed out/);
});
