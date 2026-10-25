import {z} from 'zod';
import {authorized,cozyBody,cozyHandle,cozyService,json,cozyId,cozyRequestId,cozyRuleAuthoringBoundary} from '@/lib/server/cozy-http';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){return cozyHandle(async()=>json(await cozyService().get(cozyId.parse((await params).id))));}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return cozyHandle(async()=>{await authorized();cozyRuleAuthoringBoundary(request);const input=z.object({requestId:cozyRequestId,prompt:z.string().trim().min(3).max(1000)}).strict().parse(await cozyBody(request));return json(await cozyService().modelProposal(cozyId.parse((await params).id),input.requestId,'rules',{prompt:input.prompt}));});}
