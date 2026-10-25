import {z} from 'zod';
import {authorized,body,handle,json,persistentService,revision} from '@/lib/server/http';
export async function GET(){return handle(async()=>json(await persistentService().get()));}
export async function POST(request:Request){return handle(async()=>{await authorized();const input=z.object({seed:z.number().int().min(0).max(2147483647).default(1)}).strict().parse(await body(request));return json(await persistentService().create(input.seed),201);});}
export async function PATCH(request:Request){return handle(async()=>{await authorized();const input=z.object({expectedRevision:revision,paused:z.boolean().optional(),pace:z.number().min(0.01).max(1).optional()}).strict().parse(await body(request));return json(await persistentService().settings(input.expectedRevision,input));});}
