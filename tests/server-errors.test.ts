import test from 'node:test';
import assert from 'node:assert/strict';
import {errorResponse} from '../lib/server/errors';

test('private diagnostics locate database failures without logging uncontrolled message text',async()=>{
 const logs:unknown[][]=[];const original=console.error;console.error=(...args)=>{logs.push(args);};
 try{const response=errorResponse(new Error('D1_ERROR: no such table: godmode_runs; synthetic-secret-do-not-log'));const body=await response.json() as {incidentId?:string};assert.equal(response.status,500);assert.equal(typeof body.incidentId,'string');const serialized=JSON.stringify(logs);assert.ok(serialized.includes('Missing table: godmode_runs'));assert.ok(!serialized.includes('synthetic-secret-do-not-log'));assert.ok(!JSON.stringify(body).includes('godmode_runs'));}finally{console.error=original;}
});
