import {z} from 'zod';
import {cozyHandle,cozyService,json,cozyId} from '@/lib/server/cozy-http';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){return cozyHandle(async()=>{const raw=new URL(request.url).searchParams.get('beforeStep');const before=raw===null?Number.MAX_SAFE_INTEGER:z.number().int().nonnegative().parse(Number(raw));return json(await cozyService().archives(cozyId.parse((await params).id),before));});}
