import {z} from 'zod';
import {authorized,cozyBody,cozyHandle,cozyService,json,cozyId,cozyRequestId,cozyRuleAuthoringBoundary} from '@/lib/server/cozy-http';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return cozyHandle(async()=>{await authorized();cozyRuleAuthoringBoundary(request);const input=z.object({requestId:cozyRequestId,recoveryOnly:z.boolean().optional().default(false)}).strict().parse(await cozyBody(request));return json(await cozyService().initiativePump(cozyId.parse((await params).id),input.requestId,input.recoveryOnly));});}
