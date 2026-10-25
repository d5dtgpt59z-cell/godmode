import {test} from "node:test";
import assert from "node:assert/strict";
import {canCreateForge,prepareForgeCreate,prepareForgePreview,readForgeAttempt,retainForgePreview,type ForgeReply} from "../components/cozy/world-forge-state";

const reply=(prompt:string):ForgeReply=>({draftId:"draft-1",proposal:{id:"proposal-1",status:"ready",source:"fixture",prompt,payload:{name:"A quiet place",premise:"Three people with their own hopes.",seed:4,residents:[],wrenValues:{care:50,curiosity:60,belonging:70,autonomy:60},rules:{organizer:"player",venue:"square",foodTarget:3,seedReserve:1,flood:{enabled:false,durationSteps:300}},unsupportedRequests:[]},preview:{kind:"world-blueprint",valid:true,errors:[],warnings:[],blueprint:null,worldName:"A quiet place",premise:"Three people with their own hopes.",geometry:{id:"cozy-neighborhood-1",width:32,height:24,generated:false},residents:[],wrenValues:{care:50,curiosity:60,belonging:70,autonomy:60},rules:{organizer:"player",venue:"square",foodTarget:3,seedReserve:1,flood:{enabled:false,durationSteps:300}},unsupportedRequests:[],effects:[]},errorCode:null,createdAt:"2026-10-25T12:00:00Z",expiresAt:"2026-10-25T13:00:00Z"}});

test("world preview retries preserve the request ID; editing the description is a new explicit attempt",()=>{
 let count=0;const uuid=()=>"request-"+(++count),first=prepareForgePreview(null,"  A quiet place  ",uuid);assert.equal(first.prompt,"A quiet place");assert.equal(prepareForgePreview(first,"A quiet place",uuid),first);assert.equal(count,1);
 const changed=prepareForgePreview({...first,draftId:"draft",proposalId:"proposal",createCommandId:"create"},"A different place",uuid);assert.equal(changed.requestId,"request-2");assert.equal(changed.draftId,null);assert.equal(changed.createCommandId,null);
});
test("forge request state round-trips after a lost response and rejects malformed browser data",()=>{
 const attempt=prepareForgePreview(null,"A quiet place",()=>"request-1");assert.deepEqual(readForgeAttempt(JSON.stringify(attempt)),attempt);assert.equal(readForgeAttempt("not json"),null);assert.equal(readForgeAttempt(JSON.stringify({...attempt,requestId:"x<script>"})),null);assert.equal(readForgeAttempt(JSON.stringify({...attempt,prompt:"x".repeat(1001)})),null);
});
test("a mismatched proposal cannot replace the current world preview",()=>{
 const attempt=prepareForgePreview(null,"A quiet place",()=>"request-1");assert.throws(()=>retainForgePreview(attempt,reply("A different place")),/does not match/);const retained=retainForgePreview(attempt,reply(attempt.prompt));assert.equal(retained.draftId,"draft-1");assert.equal(retained.proposalId,"proposal-1");
});
test("explicit world creation retains one command ID through retries",()=>{
 let calls=0;const attempt=retainForgePreview(prepareForgePreview(null,"A quiet place",()=>"request-1"),reply("A quiet place"));const first=prepareForgeCreate(attempt,()=>"create-"+(++calls)),retry=prepareForgeCreate(first,()=>"create-"+(++calls));assert.equal(first.createCommandId,"create-1");assert.deepEqual(retry,first);assert.equal(calls,1);assert.throws(()=>prepareForgeCreate({...attempt,draftId:null},()=>"new"),/Review/);
});
test("creation requires an actual ready valid unexpired blueprint, not text or an unavailable placeholder",()=>{
 const proposal=reply("A quiet place"),before=Date.parse("2026-10-25T12:30:00Z");assert.equal(canCreateForge(proposal,before),true);assert.equal(canCreateForge(proposal,Date.parse("2026-10-25T13:00:01Z")),false);assert.equal(canCreateForge(null,before),false);assert.equal(canCreateForge({...proposal,proposal:{...proposal.proposal,status:"failed"}},before),false);assert.equal(canCreateForge({...proposal,proposal:{...proposal.proposal,preview:null}},before),false);assert.equal(canCreateForge({...proposal,proposal:{...proposal.proposal,preview:{...proposal.proposal.preview!,valid:false}}},before),false);
});
