import {handle,json,runId,service} from '@/lib/server/http';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){return handle(async()=>json(await service().get(runId.parse((await context.params).id))));}
