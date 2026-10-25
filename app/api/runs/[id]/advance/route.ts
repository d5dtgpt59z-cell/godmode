import {z} from 'zod';
import {authorized,body,handle,json,revision,runId,service} from '@/lib/server/http';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return handle(async()=>{await authorized();const input=z.object({expectedRevision:revision,seconds:z.number().int().min(1).max(300).default(60)}).strict().parse(await body(request));return json(await service().advance(runId.parse((await context.params).id),input.expectedRevision,input.seconds));});}
