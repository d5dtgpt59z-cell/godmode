import {authorized,body,handle,json,service} from '@/lib/server/http';
export async function POST(request:Request){return handle(async()=>{await authorized();return json(await service().replay(await body(request)));});}
