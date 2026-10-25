import {z} from 'zod';
import {authorized,cozyBody,cozyHandle,cozyService,json,cozyId} from '@/lib/server/cozy-http';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return cozyHandle(async()=>{await authorized();const input=z.object({otherSaveId:cozyId}).strict().parse(await cozyBody(request));return json(await cozyService().compare(cozyId.parse((await params).id),input.otherSaveId));});}
