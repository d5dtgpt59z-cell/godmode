import {cozyHandle,cozyStatus,json} from '@/lib/server/cozy-http';
export async function GET(){return cozyHandle(async()=>json(await cozyStatus()));}
