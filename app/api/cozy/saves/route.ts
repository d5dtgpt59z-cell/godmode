import {cozyHandle,cozyService,json} from "@/lib/server/cozy-http";
/** Read-only metadata. Sites Dispatch enforces this project's owner-private audience. */
export async function GET(){return cozyHandle(async()=>{const rows=await cozyService().store.db.prepare("SELECT id,parent_id AS parentId,created_at AS createdAt,mode,paused,slot,json_extract(state_json,'$.step') AS step FROM godmode_cozy_saves ORDER BY created_at DESC,id DESC LIMIT 50").all<{id:string;parentId:string|null;createdAt:string;mode:string;paused:number;slot:string|null;step:number}>();return json({saves:rows.results});});}
