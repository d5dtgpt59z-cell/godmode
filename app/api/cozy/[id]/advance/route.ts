import {z} from 'zod';
import {authorized,cozyBody,cozyHandle,cozyService,json,cozyId,cozyRevision,cozyRequestId} from '@/lib/server/cozy-http';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return cozyHandle(async()=>{await authorized();const input=z.object({expectedRevision:cozyRevision,commandId:cozyRequestId,steps:z.number().int().min(1).max(600)}).strict().parse(await cozyBody(request));return json(await cozyService().advance(cozyId.parse((await params).id),input.expectedRevision,input.steps,input.commandId));});}
