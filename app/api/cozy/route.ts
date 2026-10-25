import {z} from 'zod';
import {authorized,cozyBody,cozyHandle,cozyService,json} from '@/lib/server/cozy-http';
export async function GET(){return cozyHandle(async()=>json(await cozyService().get()));}
export async function POST(request:Request){return cozyHandle(async()=>{await authorized();const input=z.object({seed:z.number().int().min(0).max(2147483647).default(137),fresh:z.boolean().default(false)}).strict().parse(await cozyBody(request));return json(await cozyService().create(input.seed,input.fresh),201);});}
