import { AGENT_IDS, type Agent, type AgentId, type Claim, type Goods, type Place, type WorldState } from './contracts';

export const emptyGoods = (): Goods => ({grain:0,water:0,timber:0,bread:0});
export const WORLD_WIDTH = 64;
export const WORLD_HEIGHT = 48;
export const RIVER_X = 32;
export const FORD_Y = 24;
export const PUBLIC_PLACE_IDS = ['granary','timber-yard','bakery','well','inn','market','square','supper','noticeboard','bridge'];
const porters:AgentId[] = ['bram','leda','kitt','moss'];
const makePlace = (id:string,name:string,kind:string,x:number,y:number,stock:Partial<Goods>={},ownerId:AgentId|null=null,allowed:AgentId[]|null=null):Place => ({id,name,kind,x,y,stock:{...emptyGoods(),...stock},ownerId,allowed,capacity:100});
export function createPlaces():Place[] {
  return [
    makePlace('granary','The Granary','granary',15,10,{grain:6},'iona',['iona',...porters,'ada','tomas','elin']),
    makePlace('timber-yard','Timber Yard','timber',14,34,{timber:8},'orin',['orin','june','nell','pip','ada','tomas',...porters]),
    makePlace('bakery','Bellwether Bakery','bakery',44,15,{bread:2},'ada',null),
    makePlace('well','The Catchment Well','well',22,29,{water:2},'sela',null),
    makePlace('inn','The Lantern Inn','inn',22,20,{bread:2},'rook',null),
    makePlace('market','Market Stalls','market',44,23,{},'mara',null),
    makePlace('square','Meeting Square','square',43,27),
    makePlace('supper','The Supper Table','supper',47,31),
    makePlace('noticeboard','Public Noticeboard','noticeboard',40,26),
    makePlace('bridge','Bridge Worksite','bridge',31,24),
    makePlace('home-1','Willow House','home',46,34,{bread:1},'bo',['bo','joss','una']),
    makePlace('home-2','Green Door House','home',53,34,{bread:1},'fenn',['fenn','tavi','elin']),
    makePlace('home-3','East Cottage','home',56,21,{},'ada',['ada','tomas','moss','mara','dara']),
    makePlace('home-4','South Cottage','home',44,39,{},'vale',['vale','wren','ivo']),
    makePlace('home-5','Timber Cottage','home',20,39,{},'orin',['leda','kitt','orin','june','sela']),
    makePlace('home-6','West Cottage','home',9,25,{},'iona',['iona','bram','nell','pip','rook']),
  ];
}
const jobs:Record<AgentId,{role:string;at:string;home:string;traits:string[];capabilities:string[]}> = {
  iona:{role:'Granary keeper',at:'granary',home:'home-6',traits:['careful','values accurate records'],capabilities:['keeper']},
  bram:{role:'Porter',at:'granary',home:'home-6',traits:['helpful','trusts colleagues'],capabilities:['porter']},
  leda:{role:'Porter',at:'well',home:'home-5',traits:['practical','checks supplies'],capabilities:['porter']},
  kitt:{role:'Porter',at:'timber-yard',home:'home-5',traits:['generous','enjoys conversation'],capabilities:['porter']},
  moss:{role:'Porter',at:'bakery',home:'home-3',traits:['patient','keeps promises'],capabilities:['porter']},
  ada:{role:'Baker',at:'bakery',home:'home-3',traits:['resourceful','feeds neighbors'],capabilities:['baker']},
  tomas:{role:'Baker',at:'bakery',home:'home-3',traits:['methodical','wants a shared supper'],capabilities:['baker']},
  orin:{role:'Timber worker',at:'timber-yard',home:'home-5',traits:['steady','protects shared supplies'],capabilities:['timber']},
  june:{role:'Timber worker',at:'timber-yard',home:'home-5',traits:['cooperative','prefers action'],capabilities:['timber']},
  nell:{role:'Builder',at:'bridge',home:'home-6',traits:['determined','values safe routes'],capabilities:['builder']},
  pip:{role:'Builder',at:'bridge',home:'home-6',traits:['curious','trusts evidence'],capabilities:['builder']},
  sela:{role:'Well tender',at:'well',home:'home-5',traits:['observant','shares water fairly'],capabilities:['water']},
  rook:{role:'Innkeeper',at:'inn',home:'home-6',traits:['welcoming','likes local news'],capabilities:['host']},
  mara:{role:'Market clerk',at:'market',home:'home-3',traits:['skeptical','checks claims'],capabilities:['clerk']},
  dara:{role:'Stallholder',at:'market',home:'home-3',traits:['sociable','worries about shortages'],capabilities:['merchant']},
  vale:{role:'Stallholder',at:'market',home:'home-4',traits:['reserved','likes fairness'],capabilities:['merchant']},
  wren:{role:'Courier',at:'square',home:'home-4',traits:['curious','labels hearsay'],capabilities:['courier']},
  ivo:{role:'Bell keeper',at:'noticeboard',home:'home-4',traits:['punctual','brings people together'],capabilities:['bell']},
  elin:{role:'Supper cook',at:'supper',home:'home-2',traits:['generous','plans ahead'],capabilities:['cook']},
  bo:{role:'Householder',at:'home-1',home:'home-1',traits:['protective','helps trusted neighbors'],capabilities:['neighbor']},
  fenn:{role:'Householder',at:'home-2',home:'home-2',traits:['thoughtful','questions rumors'],capabilities:['neighbor']},
  joss:{role:'Householder',at:'home-1',home:'home-1',traits:['outgoing','offers help'],capabilities:['neighbor']},
  tavi:{role:'Householder',at:'home-2',home:'home-2',traits:['energetic','seeks company'],capabilities:['neighbor']},
  una:{role:'Householder',at:'home-1',home:'home-1',traits:['patient','cares for the group'],capabilities:['neighbor']},
};
export function createAgents(places:Place[]):Agent[] {
  const occupied=new Set<string>();
  return AGENT_IDS.map((id,index) => {
    const job=jobs[id];const place=places.find(p=>p.id===job.at)!;
    const offsets=[[0,0],[-1,0],[0,1],[1,0],[0,-1],[-1,-1],[1,1],[-2,0],[0,2]];
    const offset=offsets.find(([dx,dy])=>place.x+dx!==RIVER_X&&!occupied.has(`${place.x+dx},${place.y+dy}`))!;
    const x=place.x+offset[0],y=place.y+offset[1];occupied.add(`${x},${y}`);
    const social=['host','merchant','courier','bell'].some(c=>job.capabilities.includes(c));
    const goals = [{id:'meal',label:'Have a meal before supper',weight:55+(index*7)%31},{id:'community',label:job.capabilities.includes('builder')?'Repair the crossing':job.capabilities.includes('baker')?'Bake bread for the town':social?'Keep neighbors informed and connected':'Help the town prepare supper',weight:job.capabilities.includes('baker')?92:65+(index*5)%26},{id:'understand',label:social?'Hear different accounts and decide whom to trust':'Check important claims before repeating them',weight:35+(index*11)%41}];
    const friend=AGENT_IDS[(index+3)%AGENT_IDS.length],uncertain=AGENT_IDS[(index+11)%AGENT_IDS.length];
    return {id,name:id[0].toUpperCase()+id.slice(1),role:job.role,homeId:job.home,traits:job.traits,capabilities:job.capabilities,x,y,inventory:emptyGoods(),needs:{hunger:42+(index*11)%31,fatigue:8+(index*3)%18},fed:false,intent:null,action:'Looking around',knownPlaces:[...PUBLIC_PLACE_IDS,job.home],observations:[],memories:[],beliefs:{},relationships:{[friend]:{trust:55+(index*7)%31,affinity:40+(index*11)%41,evidenceIds:[]},[uncertain]:{trust:25+(index*3)%26,affinity:35+(index*5)%26,evidenceIds:[]}},goals,decisions:{rule:0,meta:0,fallback:0},contributions:{deliveries:0,workSeconds:0,shared:0},moveProgress:index%5,lastSocialAt:-1800};
  });
}
export function createClaims():Claim[] {
  return [
    {id:'granary-twelve',text:'The granary contains twelve sacks of grain.',subjectId:'granary',kind:'fact',predicate:'stock:grain',value:12},
    {id:'granary-empty',text:'The granary has no grain left.',subjectId:'granary',kind:'fact',predicate:'stock:grain',value:0},
    {id:'ford-closed',text:'The low ford is blocked by water.',subjectId:'bridge',kind:'fact',predicate:'fordBlocked',value:1},
    {id:'neighbors-will-help',text:'Neighbors will help finish the crossing.',subjectId:'bridge',kind:'expectation',predicate:'cooperation',value:null},
  ];
}
export function mayCollect(agentId:AgentId, place:Place):boolean {return place.allowed===null || place.allowed.includes(agentId) || place.ownerId===agentId;}
export function isWalkable(world:Pick<WorldState,'width'|'height'|'crossing'|'tick'>,x:number,y:number):boolean {
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<1||y<1||x>=world.width-1||y>=world.height-1)return false;
  if(x!==RIVER_X)return true;
  return y===FORD_Y && (world.crossing.bridgeBuilt||world.tick>=world.crossing.blockedUntil);
}
