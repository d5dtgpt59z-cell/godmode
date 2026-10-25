import {z} from 'zod';
import type {AgentContext,DecisionProposal} from '../sim/contracts';
import {validateDecisionProposal} from '../sim/engine';
import {ServiceError} from './errors';

export const MODEL='muse-spark-1.3';
export const INPUT_TOKEN_CAP=2000;
export const OUTPUT_TOKEN_CAP=768;
export const RESERVATION_MICRO_USD=7494; // 2000 input + 768 TOTAL output, plus 30%; prices pinned 2026-10-25.
const text=(max:number)=>z.string().max(max);
const ids=z.array(text(100)).max(8);
export const decisionSchema=z.object({
  action:z.enum(['move','work','collect','deliver','give','request','eat','inspect','talk','read','wait']),
  targetId:text(100).nullable(),item:z.enum(['grain','water','timber','bread']).nullable(),quantity:z.number().int().min(0).max(2),duration:z.number().int().min(1).max(3600),
  claimId:text(100).nullable(),utterance:text(240),goalId:text(100).nullable(),evidenceIds:ids,
  beliefUpdates:z.array(z.object({claimId:text(100),stance:z.enum(['believe','doubt','reject']),confidence:z.number().int().min(0).max(100),evidenceIds:ids.min(1)}).strict()).max(3),reason:text(240),
}).strict();
const string=(max:number)=>({type:'string',maxLength:max});
const idArray={type:'array',maxItems:8,items:string(100)};
export const responseFormat={type:'json_schema',name:'resident_decision',strict:true,schema:{type:'object',additionalProperties:false,properties:{
  action:{type:'string',enum:['move','work','collect','deliver','give','request','eat','inspect','talk','read','wait']},targetId:{type:['string','null'],maxLength:100},
  item:{type:['string','null'],enum:['grain','water','timber','bread',null]},quantity:{type:'integer',minimum:0,maximum:2},duration:{type:'integer',minimum:1,maximum:3600},
  claimId:{type:['string','null'],maxLength:100},utterance:string(180),goalId:{type:['string','null'],maxLength:100},evidenceIds:idArray,
  beliefUpdates:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,properties:{claimId:string(100),stance:{type:'string',enum:['believe','doubt','reject']},confidence:{type:'integer',minimum:0,maximum:100},evidenceIds:{...idArray,minItems:1}},required:['claimId','stance','confidence','evidenceIds']}},reason:string(180),
},required:['action','targetId','item','quantity','duration','claimId','utterance','goalId','evidenceIds','beliefUpdates','reason']}};

export function compactContext(context:AgentContext):AgentContext{
  const beliefs=context.beliefs.slice(-2);
  const rememberedEvidence=new Set(beliefs.flatMap(b=>b.evidenceIds));
  const priority=context.observations.filter(o=>o.channel==='read'||rememberedEvidence.has(o.id)).slice(-4);
  const observations=[...new Map([...priority,...context.observations.slice(-4)].map(o=>[o.id,o])).values()].slice(-8);
  const relevant=new Set([...observations.map(o=>o.claimId),...beliefs.map(b=>b.claimId)]);
  return {...context,agent:{...context.agent,goals:context.agent.goals.slice(0,3)},places:context.places,nearbyAgents:context.nearbyAgents.slice(0,3),observations,beliefs,
    relationships:context.relationships.slice(0,3),notes:[...context.notes].sort((a,b)=>Number(a.read)-Number(b.read)).slice(0,2),offers:context.offers.slice(0,1),claims:context.claims.filter(c=>relevant.has(c.id)).slice(0,8)};
}
export function validateProposal(value:unknown,context:AgentContext):DecisionProposal{
  const result=decisionSchema.safeParse(value);
  if(!result.success)throw new ServiceError('INVALID_DECISION','The model response did not match the resident contract.',422);
  const proposal=result.data;
  const evidence=new Set(context.observations.map(o=>o.id));
  const targets=new Set([...context.places.map(p=>p.id),...context.nearbyAgents.map(a=>a.id),...context.notes.map(n=>n.id),context.agent.id]);
  const claims=new Set(context.claims.map(c=>c.id));
  if(!context.allowedActions.includes(proposal.action)||proposal.targetId!==null&&!targets.has(proposal.targetId)||proposal.goalId!==null&&!context.agent.goals.some(g=>g.id===proposal.goalId)||proposal.claimId!==null&&!claims.has(proposal.claimId))throw new ServiceError('ILLEGAL_DECISION','The model proposed something outside this resident’s knowledge.',422);
  if([...proposal.evidenceIds,...proposal.beliefUpdates.flatMap(b=>b.evidenceIds)].some(id=>!evidence.has(id))||proposal.beliefUpdates.some(b=>!claims.has(b.claimId)))throw new ServiceError('UNKNOWN_EVIDENCE','The model cited evidence this resident did not receive.',422);
  const error=validateDecisionProposal(proposal,context);if(error)throw new ServiceError('ILLEGAL_DECISION','The model proposed an illegal resident intention.',422);
  return proposal;
}
export type ModelResult={proposal:DecisionProposal;responseId:string;model:string;inputTokens:number;outputTokens:number;reasoningTokens:number;preflightTokens:number;durationMs:number;rawText:string;actualMicroUsd:number};
export class ModelDecisionError extends ServiceError{constructor(code:string,message:string,public audit:Record<string,unknown>){super(code,message,502);}}
export type MetaOptions={apiKey?:string;enabled?:boolean;projectBudgetMicroUsd?:number;fetcher?:typeof fetch;timeoutMs?:number;beforeRequest?:(kind:'count'|'generation')=>Promise<void>};

async function readJson(response:Response):Promise<unknown>{
  if(!response.ok){await response.body?.cancel();throw new ServiceError(response.status===429?'META_RATE_LIMITED':response.status===402?'META_CREDITS_REQUIRED':'META_UNAVAILABLE','Meta could not complete this decision. The town will record a fallback.',502);}
  const reader=response.body?.getReader();if(!reader)throw new ServiceError('EMPTY_RESPONSE','Meta returned no response.',502);
  let total=0,body='';const decoder=new TextDecoder();
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>65536)throw new ServiceError('RESPONSE_TOO_LARGE','The model response exceeded its limit.',502);body+=decoder.decode(value,{stream:true});}body+=decoder.decode();return JSON.parse(body);}finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}
}
export async function requestDecision(context:AgentContext,options:MetaOptions):Promise<ModelResult>{
  if(!options.enabled||!options.apiKey?.trim())throw new ServiceError('META_NOT_CONFIGURED','Live Meta reasoning is not connected. Use the clearly labeled rule-policy mode.',503);
  const visible=compactContext(context);
  const payload={model:MODEL,instructions:'You are one fictional resident in a secular microcosm. Use ONLY your supplied local knowledge. Choose one legal useful intention; a plan may fail physically. Unknown is not false. Cite observation IDs only. Keep speech and stated reason brief; they are self-reports, not hidden thoughts. Never invent resources, authority or unseen evidence. Output the strict JSON contract.',input:JSON.stringify(visible),text:{format:responseFormat},reasoning:{effort:'minimal'},max_output_tokens:OUTPUT_TOKEN_CAP,store:false};
  const controller=new AbortController(),started=Date.now();let timer:ReturnType<typeof setTimeout>|undefined;
  const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new ServiceError('META_TIMEOUT','The model decision timed out; its billing outcome may be unknown.',504));},Math.min(options.timeoutMs??60000,90000));});
  const post=async(path:string,kind:'count'|'generation')=>{await options.beforeRequest?.(kind);const response=await(options.fetcher??fetch)(`https://api.meta.ai/v1/responses${path}`,{method:'POST',headers:{Authorization:`Bearer ${options.apiKey}`, 'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal,redirect:'error'});return readJson(response);};
  try{return await Promise.race([(async()=>{
    const count=await post('/input_tokens','count') as {input_tokens?:unknown};
    if(typeof count.input_tokens!=='number'||!Number.isSafeInteger(count.input_tokens)||count.input_tokens<0||count.input_tokens>INPUT_TOKEN_CAP)throw new ServiceError('INPUT_TOKEN_LIMIT','This resident context exceeds the 2,000-token admission limit.',422);
    const result=await post('','generation') as {status?:string;id?:unknown;model?:unknown;output?:{type?:string;content?:{type?:string;text?:string}[]}[];usage?:{input_tokens?:number;output_tokens?:number;output_tokens_details?:{reasoning_tokens?:number}}};
    const usage=result.usage;
    const audit={responseId:typeof result.id==='string'?result.id:null,model:typeof result.model==='string'?result.model:MODEL,inputTokens:usage?.input_tokens??null,outputTokens:usage?.output_tokens??null,reasoningTokens:usage?.output_tokens_details?.reasoning_tokens??null,preflightTokens:count.input_tokens,durationMs:Date.now()-started,rawText:Array.isArray(result.output)?result.output.filter(o=>o.type==='message').flatMap(o=>o.content??[]).filter(c=>c.type==='output_text').map(c=>c.text??'').join(''):'',actualMicroUsd:usage&&Number.isSafeInteger(usage.input_tokens)&&Number.isSafeInteger(usage.output_tokens)?Math.ceil(usage.input_tokens!*1.25+usage.output_tokens!*4.25):undefined};
    try{
    if(result.status!=='completed'||typeof result.id!=='string'||!Array.isArray(result.output)||!usage||!Number.isSafeInteger(usage.input_tokens)||!Number.isSafeInteger(usage.output_tokens))throw new ServiceError('INCOMPLETE_DECISION','Meta did not return a complete decision and usage record.',502);
    const rawText=result.output.filter(o=>o.type==='message').flatMap(o=>o.content??[]).filter(c=>c.type==='output_text').map(c=>c.text??'').join('');
    let value:unknown;try{value=JSON.parse(rawText);}catch{throw new ServiceError('INVALID_DECISION','Meta did not return usable decision JSON.',422);}
    const proposal=validateProposal(value,visible);
    if(usage.input_tokens!>INPUT_TOKEN_CAP||usage.output_tokens!>OUTPUT_TOKEN_CAP||usage.input_tokens!<0||usage.output_tokens!<0)throw new ServiceError('USAGE_LIMIT_EXCEEDED','Provider usage exceeded the configured bounds. Live mode must be reviewed.',502);
    return {proposal,responseId:result.id,model:typeof result.model==='string'?result.model:MODEL,inputTokens:usage.input_tokens!,outputTokens:usage.output_tokens!,reasoningTokens:usage.output_tokens_details?.reasoning_tokens??0,preflightTokens:count.input_tokens,durationMs:Date.now()-started,rawText,actualMicroUsd:Math.ceil(usage.input_tokens!*1.25+usage.output_tokens!*4.25)};
    }catch(error){throw new ModelDecisionError(error instanceof ServiceError?error.code:'INVALID_DECISION',error instanceof ServiceError?error.message:'Meta did not return a usable decision.',audit);}
  })(),deadline]);}catch(error){if(error instanceof ServiceError)throw error;throw new ServiceError('META_TRANSPORT_FAILED','The decision could not be completed; its billing outcome may be unknown.',502);}finally{if(timer)clearTimeout(timer);controller.abort();}
}
