import {z} from 'zod';
import {authorized,cozyBody,cozyHandle,cozyService,json,cozyId,cozyRequestId,cozyNpc} from '@/lib/server/cozy-http';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return cozyHandle(async()=>{await authorized();const input=z.object({requestId:cozyRequestId,npcId:cozyNpc}).strict().parse(await cozyBody(request));return json(await cozyService().modelProposal(cozyId.parse((await params).id),input.requestId,'npc',{npcId:input.npcId}));});}
