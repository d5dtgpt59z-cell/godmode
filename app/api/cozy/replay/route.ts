import {authorized,cozyBody,cozyHandle,cozyService,json} from '@/lib/server/cozy-http';
export async function POST(request:Request){return cozyHandle(async()=>{await authorized();return json(await cozyService().replay(await cozyBody(request,12*1024*1024)));});}
