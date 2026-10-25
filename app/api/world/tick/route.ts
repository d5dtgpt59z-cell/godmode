import {z} from 'zod';
import {body,handle,json,persistentService,tickAuthorized} from '@/lib/server/http';
export async function POST(request:Request){return handle(async()=>{const source=await tickAuthorized();const input=z.object({maxSeconds:z.number().int().min(1).max(60).default(60)}).strict().parse(await body(request));return json(await persistentService().tick(source,input.maxSeconds));});}
