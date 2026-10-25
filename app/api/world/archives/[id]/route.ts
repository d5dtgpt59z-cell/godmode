import {handle,json,persistentService,runId} from '@/lib/server/http';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>json(await persistentService().archive(runId.parse((await params).id))));}
