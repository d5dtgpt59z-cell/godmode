import type {WorldBlueprint,WorldBlueprintPreview} from "@/lib/cozy/contracts";

export type ForgeProposal={id:string;status:string;source:"meta"|"fixture";prompt:string;payload:WorldBlueprint|null;preview:WorldBlueprintPreview|null;errorCode:string|null;createdAt:string;expiresAt:string};
export type ForgeReply={draftId:string;proposal:ForgeProposal};
export type ForgeAttempt={version:1;prompt:string;requestId:string;draftId:string|null;proposalId:string|null;createCommandId:string|null};
const idPattern=/^[A-Za-z0-9._:-]{1,100}$/;
const nullableId=(value:unknown)=>value===null||typeof value==="string"&&idPattern.test(value);

export function readForgeAttempt(raw:string|null):ForgeAttempt|null{
 try{const value=JSON.parse(raw??"null");if(value?.version===1&&typeof value.prompt==="string"&&value.prompt.length>=3&&value.prompt.length<=1000&&typeof value.requestId==="string"&&idPattern.test(value.requestId)&&nullableId(value.draftId)&&nullableId(value.proposalId)&&nullableId(value.createCommandId))return{version:1,prompt:value.prompt,requestId:value.requestId,draftId:value.draftId,proposalId:value.proposalId,createCommandId:value.createCommandId};}catch{}
 return null;
}
/** Retry exactly the same request after uncertainty; an edited prompt is a new explicit attempt. */
export function prepareForgePreview(previous:ForgeAttempt|null,prompt:string,uuid:()=>string):ForgeAttempt{
 const text=prompt.trim();if(text.length<3||text.length>1000)throw new Error("Describe your universe in 3–1000 characters.");
 return previous?.prompt===text?previous:{version:1,prompt:text,requestId:uuid(),draftId:null,proposalId:null,createCommandId:null};
}
export function retainForgePreview(attempt:ForgeAttempt,reply:ForgeReply):ForgeAttempt{
 if(reply.proposal.prompt.trim()!==attempt.prompt||!idPattern.test(reply.draftId)||!idPattern.test(reply.proposal.id))throw new Error("This blueprint does not match the saved world request.");
 return{...attempt,draftId:reply.draftId,proposalId:reply.proposal.id};
}
export function prepareForgeCreate(attempt:ForgeAttempt,uuid:()=>string):ForgeAttempt{
 if(!attempt.draftId||!attempt.proposalId)throw new Error("Review a saved blueprint before creating a world.");
 return{...attempt,createCommandId:attempt.createCommandId??uuid()};
}
export function canCreateForge(reply:ForgeReply|null,now=Date.now()){
 return!!reply&&reply.proposal.status==="ready"&&!!reply.proposal.payload&&reply.proposal.preview?.kind==="world-blueprint"&&reply.proposal.preview.valid&&Date.parse(reply.proposal.expiresAt)>now;
}
