import {z} from 'zod';
import {authorized,body,handle,json,service} from '@/lib/server/http';
export async function POST(request:Request){return handle(async()=>{await authorized();const input=z.object({seed:z.number().int().min(0).max(2147483647).default(1),mode:z.enum(['rule-policy','live','fixture']).default('rule-policy')}).strict().parse(await body(request));return json(await service().create(input.seed,input.mode),201);});}
