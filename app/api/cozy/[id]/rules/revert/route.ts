import {z} from 'zod';
import {authorized,cozyBody,cozyHandle,cozyService,json,cozyId,cozyRevision,cozyRequestId} from '@/lib/server/cozy-http';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return cozyHandle(async()=>{await authorized();const input=z.object({expectedRevision:cozyRevision,expectedRulesRevision:cozyRevision,commandId:cozyRequestId}).strict().parse(await cozyBody(request));return json(await cozyService().revert(cozyId.parse((await params).id),input.expectedRevision,input.expectedRulesRevision,input.commandId));});}
