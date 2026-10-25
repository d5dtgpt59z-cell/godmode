import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {Coordinator} from './coordinator';
import {SqlStore,validProjectBudget,type SqlDatabase} from './store';
import {ServiceError,errorResponse} from './errors';
import {PersistentWorldService,type TickSource} from './persistent-world';
import {MAX_HISTORY_TICK} from './limits';
type Bindings={DB?:D1Database;MODEL_API_KEY?:string;CREATOR_EMAIL?:string;GODMODE_LIVE_ENABLED?:string;GODMODE_PROJECT_BUDGET_MICRO_USD?:string;GODMODE_BACKGROUND_ENABLED?:string};
const bindings=env as unknown as Bindings;
let store:SqlStore|undefined;
export async function authorized(){
 if(import.meta.env.DEV)return;
 if(!bindings.CREATOR_EMAIL?.trim())throw new ServiceError('CREATOR_NOT_CONFIGURED','Creator access is not configured.',503);
 const {getChatGPTUser}=await import('../../app/chatgpt-auth');const user=await getChatGPTUser();
 if(user?.email.trim().toLowerCase()!==bindings.CREATOR_EMAIL.trim().toLowerCase())throw new ServiceError('CREATOR_FORBIDDEN','Sign in as this private preview’s creator.',403);
}
function projectBudget(){const raw=bindings.GODMODE_PROJECT_BUDGET_MICRO_USD;return raw&&/^\d+$/.test(raw)?Number(raw):undefined;}
function storage(){if(!bindings.DB)throw new ServiceError('STORAGE_NOT_CONFIGURED','Local town storage is not configured.',503);return store??=new SqlStore(bindings.DB as unknown as SqlDatabase);}
export function service(){return new Coordinator(storage(),{apiKey:bindings.MODEL_API_KEY,enabled:bindings.GODMODE_LIVE_ENABLED==='true',projectBudgetMicroUsd:projectBudget()});}
export function persistentService(){return new PersistentWorldService(storage(),Date.now,bindings.GODMODE_BACKGROUND_ENABLED==='true');}
/** The no-visitor path is valid only behind the confirmed owner-private Sites Dispatch boundary. */
export async function tickAuthorized():Promise<TickSource>{
 if(import.meta.env.DEV)return'local-test';
 const{getChatGPTUser}=await import('../../app/chatgpt-auth');const user=await getChatGPTUser();
 if(user){await authorized();return'owner';}
 if(!bindings.CREATOR_EMAIL?.trim()||bindings.GODMODE_BACKGROUND_ENABLED!=='true')throw new ServiceError('BACKGROUND_NOT_ENABLED','Unattended updates are not enabled for this private preview.',503);
 // Dispatch consumes and validates OAI-Sites-Authorization before invoking this owner-private Worker.
 // Do not read a client-supplied email, invent an application bearer, or make this Site public.
 return'service';
}
export async function status(){let access=false;try{await authorized();access=true;}catch{}const metaConfigured=access&&!!bindings.MODEL_API_KEY?.trim();const projectBudgetConfigured=validProjectBudget(projectBudget());const liveAvailable=metaConfigured&&bindings.GODMODE_LIVE_ENABLED==='true'&&projectBudgetConfigured;return{configured:liveAvailable,metaConfigured,liveAvailable,projectBudgetConfigured,reason:liveAvailable?undefined:'Live Meta is disabled. A verified account, explicit project credit cap and creator access are required. This prototype uses an explicit rule-policy baseline.',storage:!!bindings.DB,defaultMode:'rule-policy',localPrototype:true,eligibility:'unconfirmed'};}
export async function body(request:Request){
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)throw new ServiceError('INVALID_ORIGIN','Open this preview directly and try again.',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ServiceError('INVALID_CONTENT_TYPE','Use JSON for this operation.',415);
 const max=12*1024*1024;const reader=request.body?.getReader();if(!reader)throw new ServiceError('EMPTY_REQUEST','This request is empty.');let size=0,text='';const decoder=new TextDecoder();
 try{while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw new ServiceError('REQUEST_LIMIT','This recording exceeds the 12 MB limit.',413);text+=decoder.decode(value,{stream:true});}text+=decoder.decode();try{return JSON.parse(text) as unknown;}catch{throw new ServiceError('INVALID_JSON','This is not valid JSON.');}}finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}
}
export const revision=z.number().int().min(0),tick=z.number().int().min(0).max(MAX_HISTORY_TICK),runId=z.string().uuid();
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store'}});}
export async function handle(work:()=>Promise<Response>){try{return await work();}catch(error){if(error instanceof z.ZodError)return errorResponse(new ServiceError('INVALID_INPUT','Check the request fields and try again.'));return errorResponse(error);}}
