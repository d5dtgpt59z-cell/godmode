import {cozyHandle,cozyService,json,cozyId} from '@/lib/server/cozy-http';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){return cozyHandle(async()=>json(await cozyService().export(cozyId.parse((await params).id))));}
