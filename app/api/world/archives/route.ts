import {handle,json,persistentService} from '@/lib/server/http';
export async function GET(){return handle(async()=>json(await persistentService().archives()));}
