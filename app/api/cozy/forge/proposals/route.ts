import {z} from 'zod';
import {authorized,cozyBody,cozyHandle,cozyService,json,cozyRequestId} from '@/lib/server/cozy-http';
export async function POST(request:Request){return cozyHandle(async()=>{await authorized();const input=z.object({requestId:cozyRequestId,prompt:z.string().trim().min(3).max(1000)}).strict().parse(await cozyBody(request));return json(await cozyService().forgePreview(input.requestId,input.prompt));});}
