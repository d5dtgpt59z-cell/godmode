import {z} from 'zod';
import {authorized,body,handle,json,revision,runId,service,tick} from '@/lib/server/http';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return handle(async()=>{await authorized();const input=z.object({expectedRevision:revision,tick}).strict().parse(await body(request));return json(await service().rewind(runId.parse((await context.params).id),input.expectedRevision,input.tick));});}
