import type {ActorId,Goods,Point,RuleProvenance} from './contracts';
export type WorldAssetId='luminous-mushroom'|'rain-catcher'|'garden-bench';
export type WorldObjectProposal={kind:'world-object';assetId:WorldAssetId;name:string;description:string;position:Point;water:number};
export type WorldObject={id:string;assetId:WorldAssetId;name:string;description:string;position:Point;stock:Goods;introducedStep:number;sourceEventId:string;provenance:RuleProvenance;noticedBy:Partial<Record<ActorId,{step:number;eventId:string;stock:Goods}>>};
export type WorldObjectPreview={kind:'world-object';valid:boolean;errors:string[];proposal:WorldObjectProposal;effects:string[];affordances:string[];externalResources:Goods};
export type WorldObjectOperation={type:'world-object';id:string;proposal:WorldObjectProposal;provenance:RuleProvenance};
export type WorldObjectCommand={type:'object-interact';id:string;objectId:string;action:'inspect'|'collect';item:'water'|null;quantity:number};
