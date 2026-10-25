import {z} from 'zod';
import {cozyBody,cozyHandle,cozyService,json,cozyId,cozyRequestId,tickAuthorized} from '@/lib/server/cozy-http';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return cozyHandle(async()=>{const source=await tickAuthorized();const input=z.object({maxSeconds:z.number().min(0.1).max(60).default(1),requestId:cozyRequestId.optional()}).strict().parse(await cozyBody(request));return json(await cozyService().tick(cozyId.parse((await params).id),source,input.maxSeconds,input.requestId));});}
