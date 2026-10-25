import type {CozyWorldState,NpcId,Point} from "@/lib/cozy/contracts";

export type InteractionTrack={point:Point;targetNpcId:NpcId|null;routeTarget:Point|null;lastRouteStep:number;routeCount:number;startedStep:number};
export type ApproachDecision={kind:"deliver";point:Point}|{kind:"route";point:Point}|{kind:"wait"}|{kind:"expired"};
const distance=(left:Point,right:Point)=>Math.abs(left.x-right.x)+Math.abs(left.y-right.y);
/** Re-plan on meaningful target movement, never on each physical tick. */
export function interactionApproach(state:CozyWorldState,track:InteractionTrack):ApproachDecision{
 const target=track.targetNpcId?state.npcs.find(npc=>npc.id===track.targetNpcId):track.point;
 if(!target)return{kind:"expired"};
 const point={x:target.x,y:target.y};
 if(distance(state.player,point)<=1.25)return{kind:"deliver",point};
 if(state.step-track.startedStep>=1200||track.routeCount>=12)return{kind:"expired"};
 const sinceRoute=state.step-track.lastRouteStep;
 if(!state.player.path.length&&sinceRoute>=5)return{kind:"route",point};
 if(track.targetNpcId&&track.routeTarget&&sinceRoute>=20&&distance(track.routeTarget,point)>=2)return{kind:"route",point};
 return{kind:"wait"};
}
