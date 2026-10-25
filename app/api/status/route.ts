import {handle,json,status} from '@/lib/server/http';
export async function GET(){return handle(async()=>json(await status()));}
