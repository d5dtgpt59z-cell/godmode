import {z} from 'zod';
import {authorized,cozyBody,cozyHandle,cozyService,json,cozyRequestId,cozyId} from '@/lib/server/cozy-http';
export async function POST(request:Request){return cozyHandle(async()=>{await authorized();const input=z.object({draftId:cozyId,proposalId:cozyId,commandId:cozyRequestId}).strict().parse(await cozyBody(request));return json(await cozyService().forgeCreate(input.draftId,input.proposalId,input.commandId));});}
