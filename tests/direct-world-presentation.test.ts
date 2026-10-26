import {test} from "node:test";
import assert from "node:assert/strict";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {initializeCozyWorld} from "../lib/cozy/world";
import {upgradePersonalCozyWorld} from "../lib/cozy/replay";
import {validateActivityBlueprint} from "../lib/cozy/activities";
import {applyActivityProposal} from "../lib/cozy/engine";
import {previewWorldObjectProposal} from "../lib/cozy/world-objects";
import {blankDirectStep,buildDirectActivity,buildDirectObject,directPlacement,directTargets,type DirectActivity} from "../components/cozy/direct-world";
import DirectWorldComposer from "../components/cozy/direct-world-composer";
import {nextPlayHint} from "../components/cozy/play-guide";
import PlayGuide from "../components/cozy/cozy-play-guide";

const world=()=>upgradePersonalCozyWorld(initializeCozyWorld(137,"guide-old"),"guide-new");
const activity=():DirectActivity=>({name:"Our own small moment",purpose:"Spend a little time together.",organizerId:"wren",participants:["wren","ada","mara"],venue:"square",steps:[]});
test("all nine human action choices compile to actual engine-valid steps without a model",()=>{
 for(const action of ["meet","approach","communicate","collect","exchange","consume","rest","observe","gesture"] as const){
  const draft=blankDirectStep("one","wren",action);if(["approach","exchange"].includes(action))draft.targetId="ada";if(["collect","observe"].includes(action))draft.targetId="well";if(action==="communicate")draft.text="A literal invitation, written by the player.";
  const compiled=buildDirectActivity({...activity(),steps:[draft]});assert.equal(validateActivityBlueprint(compiled.program).steps[0].action,action);
 }
});
test("changing an action never submits stale hidden goods, speech or gesture fields",()=>{
 const draft={...blankDirectStep("one","wren"),item:"bread" as const,quantity:3,text:"old words",gesture:"kiss" as const,targetId:"ada"};const step=buildDirectActivity({...activity(),steps:[draft]}).program.steps[0];assert.equal(step.actorId,null);assert.equal(step.targetId,null);assert.equal(step.item,null);assert.equal(step.quantity,null);assert.equal(step.text,null);assert.equal(step.gesture,null);
});
test("manual composer rejects missing purpose, insufficient people and incomplete physical destinations",()=>{
 const value={...activity(),steps:[blankDirectStep("one","wren")]};assert.throws(()=>buildDirectActivity({...value,name:""}),/name and a purpose/);assert.throws(()=>buildDirectActivity({...value,participants:["wren"]}),/two or three/);assert.throws(()=>buildDirectActivity({...value,steps:[blankDirectStep("one","wren","approach")]}),/destination/);
});
test("manual object placement uses legal empty ground and records finite water only for containers",()=>{
 const state=world(),before=JSON.stringify(state),point=directPlacement(state,"square");assert.ok(point);assert.ok([state.player,...state.npcs].every(actor=>Math.abs(actor.x-point.x)+Math.abs(actor.y-point.y)>=1));
 for(const assetId of ["rain-catcher","luminous-mushroom","garden-bench"] as const){const value=buildDirectObject(state,{assetId,name:"A thing we introduced",description:"A deliberate, supported change.",anchorId:"square",water:6});assert.equal(previewWorldObjectProposal(state,value.object).valid,true);assert.equal(value.object.water,assetId==="rain-catcher"?6:0);}
 assert.equal(JSON.stringify(state),before);
});
test("activity destination choices do not expose a distant unobserved object to its organizer",()=>{
 const state=world();state.worldObjects=[{id:"world-object-private",assetId:"garden-bench",name:"A private discovery",description:"Not yet seen by this organizer.",position:{x:10,y:15},stock:{grain:0,bread:0,water:0,timber:0},introducedStep:0,sourceEventId:"introduced",provenance:{mode:"manual"},noticedBy:{ada:{step:0,eventId:"ada-saw-it",stock:{grain:0,bread:0,water:0,timber:0}}}}];assert.equal(directTargets(state,"wren").some(target=>target.id==="world-object-private"),false);assert.equal(directTargets(state,"ada").some(target=>target.id==="world-object-private"),true);
});
test("first-minute hints read real crop/resource state and advance to direct play without inventing a quest",()=>{
 const state=world(),before=JSON.stringify(state);assert.equal(nextPlayHint(state).action,"plant");assert.equal(JSON.stringify(state),before);state.plots[0].phase="planted";assert.equal(nextPlayHint(state).action,"water");state.player.inventory.water=0;assert.equal(nextPlayHint(state).action,"well");state.plots[0].phase="ripe";assert.equal(nextPlayHint(state).action,"harvest");state.player.harvests=1;assert.equal(nextPlayHint(state).action,"gift");state.player.gifts=1;assert.equal(nextPlayHint(state).action,"direct");
});
test("an actual active invitation takes priority over garden hints",()=>{
 const value=buildDirectActivity({...activity(),steps:[blankDirectStep("one","wren")]});const state=applyActivityProposal(world(),value.program,{mode:"manual"},"guide-program");assert.equal(nextPlayHint(state).action,"activity");
});
test("normal direct controls and first-minute guide explicitly distinguish manual play from Muse",()=>{
 const state=world(),composer=renderToStaticMarkup(createElement(DirectWorldComposer,{state,busy:false,onPreview:async()=>{}}));assert.match(composer,/Plan a moment/);assert.match(composer,/Place an object/);assert.match(composer,/no model inference/);assert.match(composer,/Who carries the invitations/);assert.doesNotMatch(composer,/cozy-exact-world|Enter valid JSON/);
 const guide=renderToStaticMarkup(createElement(PlayGuide,{state,museAvailable:false,onExplore:()=>{},onNeighbors:()=>{},onDirect:()=>{}}));assert.match(guide,/Muse interpretation is unavailable/);assert.match(guide,/not a guaranteed scene/);assert.match(guide,/Try a direct change/);
});
