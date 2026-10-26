import type {ActivityBlueprint,ActivityStep,CozyWorldState,Good,NpcId,Point,SocialGesture,Venue} from "@/lib/cozy/contracts";
import type {WorldAssetId,WorldObjectProposal} from "@/lib/cozy/world-object-contracts";
import {getWorldObjectCapabilities} from "@/lib/cozy/world-objects";

export type DirectStep={key:string;action:ActivityStep["action"];actorId:NpcId|"all";targetId:string;item:Good;quantity:number;gesture:SocialGesture;text:string;seconds:number};
export type DirectActivity={name:string;purpose:string;organizerId:NpcId;participants:NpcId[];venue:Venue;steps:DirectStep[]};
export const activityActions:Record<ActivityStep["action"],string>={meet:"Meet at the gathering place",approach:"Walk over to someone or somewhere",communicate:"Say something aloud",collect:"Collect real supplies",exchange:"Offer owned goods to someone",consume:"Eat or drink owned supplies",rest:"Take a little rest",observe:"Look closely at a place",gesture:"Ask for a shared gesture"};
export const goodsNames:Record<Good,string>={grain:"wheat",water:"water",timber:"timber",bread:"bread"};
export function describeActivityStep(state:CozyWorldState,step:ActivityStep){
 const target=state.npcs.find(npc=>npc.id===step.targetId)?.name??state.places.find(place=>place.id===step.targetId)?.name??state.worldObjects?.find(object=>object.id===step.targetId)?.name??(state.plots.some(plot=>plot.id===step.targetId)?"the wheat field":"the meeting place");
 const goods=step.item?`${step.quantity??0} ${goodsNames[step.item]}`:"supplies";
 return step.action==="meet"?"Meet at the chosen place":step.action==="approach"?`Walk over to ${target}`:step.action==="communicate"?`Say “${step.text??""}”`:step.action==="collect"?`Collect ${goods} from ${target}`:step.action==="exchange"?`Offer ${goods} to ${target}`:step.action==="consume"?`${step.item==="water"?"Drink":"Eat"} ${goods}`:step.action==="rest"?`Rest ${step.targetId?`at ${target}`:"where they met"}`:step.action==="observe"?`Look closely at ${target}`:`${step.gesture==="dance"?"Dance":step.gesture==="embrace"?"Embrace":"Kiss"} · each person chooses`;
}
export function blankDirectStep(key:string,organizerId:NpcId,action:ActivityStep["action"]="meet"):DirectStep{return{key,action,actorId:["approach","exchange","communicate"].includes(action)?organizerId:"all",targetId:"",item:"water",quantity:1,gesture:"dance",text:"",seconds:3};}
export function directTargets(state:CozyWorldState,organizerId:NpcId){return[...state.places.map(place=>({id:place.id,name:place.name})),...state.plots.map((plot,index)=>({id:plot.id,name:`Wheat bed ${index+1}`})),...(state.worldObjects??[]).filter(object=>object.noticedBy[organizerId]).map(object=>({id:object.id,name:object.name}))];}
export function buildDirectActivity(value:DirectActivity):{kind:"activity";program:ActivityBlueprint}{
 if(value.name.trim().length<3||value.purpose.trim().length<3)throw new Error("Give this moment a name and a purpose.");
 if(value.participants.length<2||value.participants.length>3||!value.participants.includes(value.organizerId))throw new Error("Choose two or three neighbors, including the organizer.");
 if(value.steps.length<1||value.steps.length>6)throw new Error("Plan one to six supported steps.");
 const steps=value.steps.map(draft=>{
  const step:ActivityStep={action:draft.action,actorId:draft.actorId==="all"?null:draft.actorId,targetId:null,item:null,quantity:null,gesture:null,text:null,durationSteps:Math.round(draft.seconds*10)};
  if(!Number.isInteger(draft.seconds)||draft.seconds<1||draft.seconds>30)throw new Error("Each step needs one to thirty seconds, after travel.");
  if(step.actorId&&!value.participants.includes(step.actorId))throw new Error("A step names someone who is not invited.");
  if(draft.action==="meet")step.actorId=null;
  else if(draft.action==="gesture"){step.gesture=draft.gesture;if(step.actorId)step.targetId=draft.targetId||null;}
  else if(draft.action==="communicate"){if(!draft.text.trim())throw new Error("Write the actual words for the speaking step.");step.text=draft.text.trim();}
  else if(draft.action==="consume"){step.item=draft.item;step.quantity=draft.quantity;}
  else if(["collect","exchange"].includes(draft.action)){step.targetId=draft.targetId||null;step.item=draft.item;step.quantity=draft.quantity;}
  else step.targetId=draft.targetId||null;
  if(["approach","collect","exchange","observe"].includes(draft.action)&&!step.targetId)throw new Error("Choose a destination for every step that needs one.");
  if(["approach","exchange"].includes(draft.action)&&!step.actorId)throw new Error("Choose one person for this step.");
  if(draft.action==="gesture"&&step.actorId&&!step.targetId)throw new Error("Choose the other person for this gesture.");
  return step;
 });
 return{kind:"activity",program:{name:value.name.trim(),purpose:value.purpose.trim(),organizerId:value.organizerId,participants:[...value.participants],venue:value.venue,steps}};
}
/** Pick a real legal tile near a player-selected landmark; this never invents terrain. */
export function directPlacement(state:CozyWorldState,anchorId:string):Point|null{
 const anchor=state.places.find(place=>place.id===anchorId)?.position??state.player;
 return(getWorldObjectCapabilities(state).legalPositions??[]).filter(point=>[state.player,...state.npcs].every(actor=>Math.abs(point.x-actor.x)+Math.abs(point.y-actor.y)>=1)).sort((left,right)=>(Math.abs(left.x-anchor.x)+Math.abs(left.y-anchor.y))-(Math.abs(right.x-anchor.x)+Math.abs(right.y-anchor.y))||left.y-right.y||left.x-right.x)[0]??null;
}
export function buildDirectObject(state:CozyWorldState,value:{assetId:WorldAssetId;name:string;description:string;anchorId:string;water:number}):{kind:"world-object";object:WorldObjectProposal}{
 if(value.name.trim().length<3||value.description.trim().length<3)throw new Error("Give the object a name and a short description.");
 const position=directPlacement(state,value.anchorId);if(!position)throw new Error("There is no clear legal spot near this landmark.");
 return{kind:"world-object",object:{kind:"world-object",assetId:value.assetId,name:value.name.trim(),description:value.description.trim(),position,water:value.assetId==="rain-catcher"?value.water:0}};
}
