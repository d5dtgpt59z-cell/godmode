import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {replayCozyRecording,hashCozyWorld,verifyCozyWorld} from './engine-snapshot/cozy/index';
import type {CozyRecording} from './engine-snapshot/cozy/contracts';
const root=fileURLToPath(new URL('.',import.meta.url));
const results=[];
for(const file of ['primary-recording.json','baseline-recording.json']){
 const recording=JSON.parse(readFileSync(root+file,'utf8')) as CozyRecording;
 const replay=replayCozyRecording(recording);assert.equal(hashCozyWorld(replay),recording.finalHash);assert.equal(replay.eventHead,recording.eventHead);assert.deepEqual(verifyCozyWorld(replay),[]);
 assert(replay.places.every(p=>typeof p.name==='string'&&!!p.name&&typeof p.kind==='string'&&!!p.kind));
 assert(recording.operations.every(op=>op.type!=='npc-plan'));assert(recording.operations.filter(op=>op.type==='rules').every(op=>op.provenance.mode==='manual'));
 results.push({file,step:replay.step,finalHash:recording.finalHash,eventHead:recording.eventHead,operations:recording.operations.length,replayVerified:true,festival:replay.festival.phase,participants:replay.festival.participants,placeFieldsDefined:true,modelPlanOperations:0});
}
assert.equal(results[0].step,results[1].step);assert.equal(results[0].festival,'complete');assert.equal(results[0].participants.length,3);assert.equal(results[1].festival,'planning');
const report={passed:true,modelCalls:0,providerInferenceIncluded:false,results};writeFileSync(root+'recording-verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
