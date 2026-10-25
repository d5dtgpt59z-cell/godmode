export const COZY_ENGINE_VERSION='cozy-engine-1';
export const COZY_CONTENT_VERSION='cozy-wheat-1';
export const COZY_STEP_MS=100;
export const MAX_ADVANCE_STEPS=36_000;
export const NPC_IDS=['ada','mara','wren'] as const;
export type NpcId=typeof NPC_IDS[number];
export type ActorId=NpcId|'player';
export type Good='grain'|'water'|'timber'|'bread';
export type Goods=Record<Good,number>;
export type Point={x:number;y:number};
export type PlaceId='player-home'|'ada-home'|'mara-home'|'wren-home'|'well'|'woodpile'|'bakery'|'square'|'market';
export type Venue='square'|'market';
export type Organizer='player'|'villagers';
export type RuleSet={organizer:Organizer;venue:Venue;foodTarget:number;seedReserve:number;flood:{enabled:boolean;zone:'low-path';durationSteps:number}};
export type RulePatch=Partial<Omit<RuleSet,'flood'>> & {flood?:Partial<RuleSet['flood']>};
export type RuleProvenance={mode:'manual'|'meta'|'fixture';model?:string;proposalId?:string;sourceText?:string};
export type RuleHistory={revision:number;step:number;operationIndex:number;originStep:number;originHash:string;previous:RuleSet;next:RuleSet;patch:RulePatch;provenance:RuleProvenance;kind:'apply'|'revert'};
export type Memory={id:string;step:number;type:string;text:string;sourceIds:string[];actorId:ActorId|null};
export type ActorTask={kind:'setup'|'invite'|'food'|'attend'|'inspect';targetId:string;remainingSteps:number;reason:string;ruleRevision:number;phase?:'fetch'|'deliver'|'work';quantity?:number;sourceId?:PlaceId;attendanceSpot?:Point}|null;
export type Actor={id:ActorId;name:string;x:number;y:number;path:Point[];inventory:Goods;action:string;task:ActorTask;memories:Memory[]};
export type Npc=Actor&{id:NpcId;homeId:PlaceId;traits:string[];needs:{hunger:number;energy:number;social:number};goals:{id:'help'|'belong'|'understand';label:string;weight:number}[];trust:number;affinity:number;giftCount:number;harvestsSeen:number;fieldVerified?:boolean;resting?:boolean;lastDecisionStep:number;festivalAccepted:boolean;knownFestival:boolean;lastGiftStep:number;reason:string;overrideUntil?:number;festivalObservation?:{id:number;venue:Venue;phase:Festival['phase'];food:number;setupDone:boolean;step:number}};
export type NpcPlan={npcId:NpcId;action:'bring-food'|'set-up'|'invite'|'attend'|'inspect'|'return-home'|'wait';targetId:string|null;quantity:number;durationSteps:number;reason:string;speech:string;evidenceIds:string[]};
export type NpcContext={step:number;npc:{id:NpcId;name:string;traits:string[];inventory:Goods;trust:number;affinity:number;position:Point;needs:Npc['needs'];goals:Npc['goals']};memories:Memory[];nearbyActors:{id:ActorId;position:Point}[];places:{id:PlaceId;name:string;position:Point;stock:Goods|null}[];festival:Pick<Festival,'id'|'venue'|'phase'|'food'|'setupDone'>|null;rules:RuleSet;rulesRevision:number};
export type Player=Actor&{id:'player';harvests:number;gifts:number};
export type Place={id:PlaceId;name:string;kind:string;position:Point;stock:Goods};
export type CropPlot={id:string;position:Point;phase:'empty'|'planted'|'growing'|'ripe';plantedAt:number|null;wateredAt:number|null;readyAt:number|null;harvestCount:number;plantedBy:'player'|null};
export type Festival={id:number;phase:'planning'|'gathering'|'celebrating'|'complete';venue:Venue;food:number;setupDone:boolean;setupOwner:ActorId|null;foodReserved:Partial<Record<ActorId,number>>;invitations:Partial<Record<NpcId,{source:ActorId;step:number}>>;participants:NpcId[];startedAt:number|null;completedAt:number|null;announced:boolean};
export type Flood={active:boolean;startedAt:number|null;expiresAt:number|null;ruleRevision:number;egress:ActorId[]};
export type CozyEvent={id:string;seq:number;step:number;tick:number;type:string;actorId:ActorId|null;audience:ActorId[];payload:Record<string,unknown>;sourceIds:string[];rulesRevision:number;prevHash:string;hash:string};
export type Ledger={initial:Goods;environment:Goods;produced:Goods;consumed:Goods;waste:Goods};
export type CozyCommand=
 | {id:string;type:'move';target:Point}
 | {id:string;type:'stop'}
 | {id:string;type:'plant'|'water'|'harvest';plotId:string}
 | {id:string;type:'collect';placeId:PlaceId;item:Good;quantity:number}
 | {id:string;type:'gift';npcId:NpcId;item:Good;quantity:number}
 | {id:string;type:'talk';npcId:NpcId}
 | {id:string;type:'festival';task:'food'|'setup';quantity?:number}
 | {id:string;type:'invite';npcId:NpcId}
 | {id:string;type:'festival-reset'};
export type CozyOperation=
 | {type:'command';command:CozyCommand}
 | {type:'advance';steps:number}
 | {type:'rules';id:string;patch:RulePatch;expectedRulesRevision:number;provenance:RuleProvenance}
 | {type:'revert';id:string;expectedRulesRevision:number;provenance:RuleProvenance}
 | {type:'npc-plan';id:string;plan:NpcPlan;provenance:RuleProvenance};
export type CozyOrigin={seed:number;branchId:string;checkpointState?:string;parentBranchId?:string;parentHash?:string};
export type CozyWorldState={version:1;engineVersion:typeof COZY_ENGINE_VERSION;contentVersion:typeof COZY_CONTENT_VERSION;seed:number;branchId:string;step:number;tick:number;day:number;player:Player;npcs:Npc[];places:Place[];plots:CropPlot[];rules:RuleSet;rulesRevision:number;ruleHistory:RuleHistory[];festival:Festival;flood:Flood;reservations:{actorId:ActorId;placeId:PlaceId;item:Good;quantity:number}[];ledger:Ledger;events:CozyEvent[];eventSeq:number;eventHead:string;commandIds:string[];nextId:number;operations:CozyOperation[];origin:CozyOrigin};
export type CozyRecording={format:'godmode-cozy';version:1;engineVersion:typeof COZY_ENGINE_VERSION;contentVersion:typeof COZY_CONTENT_VERSION;origin:CozyOrigin;operations:CozyOperation[];finalStep:number;finalHash:string;eventHead:string};
export type RulePreview={valid:boolean;errors:string[];expectedRulesRevision:number;previous:RuleSet;next:RuleSet;changes:{field:string;from:unknown;to:unknown}[];warnings:string[];capsHash:string};
export type CozyViolation={code:string;message:string};
export class CozyError extends Error{constructor(public code:string,message:string){super(message);this.name='CozyError';}}
