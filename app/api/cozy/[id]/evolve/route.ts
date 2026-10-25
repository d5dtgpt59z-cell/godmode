import {z} from 'zod';
import {authorized,cozyBody,cozyHandle,cozyService,json,cozyId,cozyRevision} from '@/lib/server/cozy-http';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return cozyHandle(async()=>{await authorized();const input=z.object({expectedRevision:cozyRevision}).strict().parse(await cozyBody(request));return json(await cozyService().evolve(cozyId.parse((await params).id),input.expectedRevision));});}
