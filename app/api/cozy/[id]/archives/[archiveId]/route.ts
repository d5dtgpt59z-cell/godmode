import {cozyHandle,cozyService,json,cozyId} from '@/lib/server/cozy-http';
export async function GET(_request:Request,{params}:{params:Promise<{id:string;archiveId:string}>}){return cozyHandle(async()=>{const input=await params;return json(await cozyService().archive(cozyId.parse(input.id),cozyId.parse(input.archiveId)));});}
