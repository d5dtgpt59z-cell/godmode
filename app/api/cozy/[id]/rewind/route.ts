import {z} from 'zod';
import {authorized,cozyBody,cozyHandle,cozyService,json,cozyId,cozyRevision,cozyStep} from '@/lib/server/cozy-http';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return cozyHandle(async()=>{await authorized();const input=z.object({expectedRevision:cozyRevision,step:cozyStep}).strict().parse(await cozyBody(request));return json(await cozyService().rewind(cozyId.parse((await params).id),input.expectedRevision,input.step));});}
