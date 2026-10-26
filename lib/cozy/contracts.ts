import type {WorldObject,WorldObjectCommand,WorldObjectOperation} from './world-object-contracts';
export const COZY_ENGINE_VERSION='cozy-engine-1';
export const COZY_CONTENT_VERSION='cozy-wheat-1';
export const COZY_V2_ENGINE_VERSION='cozy-engine-2';
export const COZY_V2_CONTENT_VERSION='cozy-cooperation-1';
export const COZY_V3_ENGINE_VERSION='cozy-engine-3';
export const COZY_V3_CONTENT_VERSION='cozy-personal-wren-1';
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
export type RuleProvenance={mode:'manual'|'meta'|'fixture'|'local-qwen';model?:string;proposalId?:string;sourceText?:string};
export type RuleHistory={revision:number;step:number;operationIndex:number;originStep:number;originHash:string;previous:RuleSet;next:RuleSet;patch:RulePatch;provenance:RuleProvenance;kind:'apply'|'revert'};
export type Memory={id:string;step:number;type:string;text:string;sourceIds:string[];actorId:ActorId|null;facts?:{harvestCount?:number;institutionId?:string;memberIds?:NpcId[]}};
export type ActorTask={kind:'setup'|'invite'|'food'|'attend'|'inspect'|'communicate'|'personal'|'activity';targetId:string;remainingSteps:number;reason:string;ruleRevision:number;phase?:'fetch'|'deliver'|'work';quantity?:number;sourceId?:PlaceId;attendanceSpot?:Point;proposalId?:string;institutionId?:string;searchIndex?:number;expiresAt?:number;personalAction?:PersonalAction;personalPlanId?:string;personalStepId?:string;activityId?:string;activityRole?:'invite'|'meet'|'step'|'pair';activityStepIndex?:number}|null;
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
 | {id:string;type:'festival-reset'}
 | PersonalCommand
 | WorldObjectCommand;
export type PersonalCommand={id:string;type:'share-idea';npcId:'wren';text:string};
export type CozyOperation=
 | {type:'command';command:CozyCommand}
 | {type:'advance';steps:number}
 | {type:'rules';id:string;patch:RulePatch;expectedRulesRevision:number;provenance:RuleProvenance}
 | {type:'revert';id:string;expectedRulesRevision:number;provenance:RuleProvenance}
 | {type:'npc-plan';id:string;plan:NpcPlan;provenance:RuleProvenance};
export type SocialOperation=
 | {type:'social-initiative';id:string;decision:SocialInitiativeDecision;provenance:RuleProvenance}
 | {type:'social-owner-decision';id:string;proposalId:string;decision:'approve'|'decline'};
export type PersonalOperation={type:'personal-decision';id:string;decision:PersonalDecision;provenance:RuleProvenance}|{type:'activity-program';id:string;program:ActivityBlueprint;provenance:RuleProvenance};
export type CozyOrigin={seed:number;branchId:string;checkpointState?:string;parentBranchId?:string;parentHash?:string;migration?:{fromEngine:string;fromContent:string;parentHash:string}};
export type CozyWorldState={version:1;engineVersion:typeof COZY_ENGINE_VERSION|typeof COZY_V2_ENGINE_VERSION|typeof COZY_V3_ENGINE_VERSION;contentVersion:typeof COZY_CONTENT_VERSION|typeof COZY_V2_CONTENT_VERSION|typeof COZY_V3_CONTENT_VERSION;seed:number;branchId:string;step:number;tick:number;day:number;player:Player;npcs:Npc[];places:Place[];plots:CropPlot[];rules:RuleSet;rulesRevision:number;ruleHistory:RuleHistory[];festival:Festival;flood:Flood;reservations:{actorId:ActorId;placeId:PlaceId;item:Good;quantity:number}[];ledger:Ledger;events:CozyEvent[];eventSeq:number;eventHead:string;commandIds:string[];nextId:number;operations:(CozyOperation|SocialOperation|PersonalOperation|WorldObjectOperation)[];origin:CozyOrigin;emergence?:EmergenceState;mind?:PersonalMind;activities?:ActivityState;worldObjects?:WorldObject[];world?:{name:string;premise:string;geometry:'cozy-neighborhood-1';blueprint:WorldBlueprint;provenance:RuleProvenance;sourceEventId:string}};
export type CozyRecording={format:'godmode-cozy';version:1;engineVersion:CozyWorldState['engineVersion'];contentVersion:CozyWorldState['contentVersion'];origin:CozyOrigin;operations:(CozyOperation|SocialOperation|PersonalOperation|WorldObjectOperation)[];finalStep:number;finalHash:string;eventHead:string};
export type RulePreview={valid:boolean;errors:string[];expectedRulesRevision:number;previous:RuleSet;next:RuleSet;changes:{field:string;from:unknown;to:unknown}[];warnings:string[];capsHash:string};
export type CozyViolation={code:string;message:string};
// One error identity is shared across the frozen implementation and the public facade.
export {CozyError} from './v1/contracts';

export type CooperativeCharter={venue:Venue;grainTarget:number;seedFloor:number};
export type SocialResponse={stance:'join'|'conditional'|'decline';conditions:('witness-harvest'|'needs-rest'|'needs-food'|'trust'|'protect-seeds')[];reason:string;evidenceIds:string[];decidedStep:number;eventId:string;provenance:'deterministic-policy'};
export type SocialProposal={id:string;kind:'cooperative-charter';capability:'shared-gathering';authorId:NpcId;name:string;purpose:string;charter:CooperativeCharter;createdStep:number;revision:number;status:'awaiting-responses'|'formed'|'declined'|'expired';deliveries:Partial<Record<NpcId,{step:number;eventId:string;sourceId:ActorId;knownMemberIds?:NpcId[]}>>;responses:Partial<Record<NpcId,SocialResponse>>;institutionId:string|null;provenance:RuleProvenance;sourceIds:string[]};
export type InstitutionPractice={kind:'contribute-grain'|'prepare-venue'|'invite-neighbor';resource:'grain'|'timber'|null;quantity:number};
export type Institution={id:string;proposalId:string;name:string;purpose:string;founderId:NpcId;leaderId:NpcId;members:NpcId[];formedStep:number;status:'waiting-permission'|'active'|'waiting-resources'|'resting';permission:'pending'|'approved'|'declined';practices:InstitutionPractice[];resourceAccount:{kind:'festival';festivalId:number;venue:Venue;grainTarget:number;seedFloor:number};history:string[]};
export type EmergenceState={version:1;proposals:SocialProposal[];institutions:Institution[];actors:Record<NpcId,{lastInitiativeStep:number;initiativeCount:number;intentRevision:number;heardProposalIds:string[];knownPermissions:Record<string,{permission:Institution['permission'];eventId:string;step:number}>}>;history:string[]};
export type InitiativeContext={version:1;npcId:NpcId;step:number;triggerKey:string;intentHash:string;npc:{name:string;traits:string[];needs:Npc['needs'];goals:Npc['goals'];trust:number;affinity:number;inventory:Goods};observations:Memory[];nearbyActors:{id:ActorId;position:Point}[];neighbors:{id:NpcId;name:string;homeId:PlaceId}[];observedPlaces:{id:PlaceId;position:Point;stock:Goods|null}[];observedFestival:NpcContext['festival'];knownProposals:{id:string;authorId:NpcId;name:string;purpose:string;charter:CooperativeCharter;ownResponse:SocialResponse|null;heardEventId:string}[];institutions:{id:string;name:string;members:NpcId[];permission:Institution['permission'];status:Institution['status']}[];capability:{kind:'shared-gathering';venues:Venue[];grainTarget:{min:2;max:6};seedFloor:{min:0;max:3}};eligibility:{canPropose:boolean;canShare:boolean;nextEligibleStep:number};};
/** Fixed, nullable wire fields make this usable as a strict model JSON schema. */
export type SocialInitiativeDecision={npcId:NpcId;triggerKey:string;intentHash:string;action:'propose'|'share'|'wait'|'inspect';proposalId:string|null;targetId:string|null;name:string|null;purpose:string|null;charter:CooperativeCharter|null;reason:string;evidenceIds:string[]};
export type InitiativeOpportunity={npcId:NpcId;triggerKey:string;intentHash:string;context:InitiativeContext};

export type PersonalAction='inspect'|'rest'|'eat'|'seek-meal'|'approach'|'talk'|'cooperate'|'wait';
export type PersonalStatus='imagined'|'proposed'|'attempted'|'suspended'|'blocked'|'completed'|'abandoned';
export type PersonalRelationship={actorId:ActorId;trust:number;affinity:number;helpfulness:number;basis:'seeded'|'observed';lastInteractionStep:number|null;evidenceIds:string[]};
export type PersonalBelief={id:string;subject:string;claim:string;expectedValue:number|null;confidence:number;kind:'observation'|'testimony'|'inference';status:'tentative'|'supported'|'contradicted';sourceId:ActorId|null;observedStep:number;updatedStep:number;evidenceIds:string[];previousClaim?:string};
export type Aspiration={id:string;title:string;description:string;motivation:string;requestedCapability:string|null;capabilityRequestId:string|null;status:PersonalStatus;createdStep:number;updatedStep:number;provenance:RuleProvenance;evidenceIds:string[];history:string[]};
export type CapabilityRequest={id:string;aspirationId:string;capability:string;status:'requested';createdStep:number;reason:string;evidenceIds:string[]};
export type PersonalPlanStep={id:string;action:PersonalAction;targetId:string|null;durationSteps:number;speech:string|null;status:PersonalStatus;startedStep:number|null;completedStep:number|null;resultEventIds:string[];blockedReason:string|null};
export type PersonalPlan={id:string;aspirationId:string|null;summary:string;status:PersonalStatus;steps:PersonalPlanStep[];currentStep:number;createdStep:number;updatedStep:number;blockedReason:string|null;provenance:RuleProvenance;evidenceIds:string[]};
export type PersonalMind={version:1;npcId:'wren';values:{care:number;curiosity:number;belonging:number;autonomy:number};preferences:{food:'bread'|'grain';restPlaceId:'wren-home'};relationships:Record<ActorId,PersonalRelationship>;beliefs:PersonalBelief[];aspirations:Aspiration[];capabilityRequests:CapabilityRequest[];plan:PersonalPlan|null;pastPlans:PersonalPlan[];history:string[];lastDecisionStep:number;intentRevision:number;observationCursor:number;nextReconsiderStep:number;foodSearchBackoffUntil:number;lastConsideredTrigger:string|null;cooperativePlanStep?:{planId:string|null;stepId:string|null;startSeq:number};regulation:null|{need:'food'|'rest';startedStep:number;suspendedPlanId:string|null};};
export type PersonalDecision={npcId:'wren';triggerKey:string;intentHash:string;action:PersonalAction|'imagine'|'plan'|'reconsider'|'compose';aspirationId:string|null;aspiration:{title:string;description:string;motivation:string;requestedCapability:string|null}|null;plan:{summary:string;steps:{action:PersonalAction;targetId:string|null;durationSteps:number;speech:string|null}[]}|null;targetId:string|null;speech:string|null;belief:{subject:string;claim:string;confidence:number;expectedValue:number|null}|null;reason:string;evidenceIds:string[];program?:ActivityBlueprint|null};
export type PersonalContext={kind:'personal';version:1;npcId:'wren';step:number;triggerKey:string;intentHash:string;self:{name:string;position:Point;needs:Npc['needs'];inventory:Goods;values:PersonalMind['values'];preferences:PersonalMind['preferences']};relationships:PersonalRelationship[];beliefs:PersonalBelief[];aspirations:Aspiration[];capabilityRequests:CapabilityRequest[];plan:PersonalPlan|null;observations:Memory[];nearbyActors:{id:ActorId;name:string;position:Point}[];contacts:{id:ActorId;name:string;homeId:PlaceId}[];observedPlaces:{id:PlaceId;stock:Goods}[];observedObjects?:{id:string;name:string;description:string;position:Point;assetId:string;affordances:string[];observedStock:Goods;evidenceId:string;observedStep:number}[];knownPlaces:{id:string;position:Point}[];cooperation:{institutionId:string;permission:Institution['permission']}[];affordances:{action:PersonalAction;constraints:string}[];activityCapabilities?:{version:string;available:boolean;programSlotsRemaining:number;activeProgram:boolean;actions:string[];gestures:string[];venues:string[];participants:NpcId[];targetAffordances?:ActivityTargetAffordance[]};eligibility:{canImagine:boolean;aspirationSlotsRemaining:number;nextEligibleStep:number};triggers:string[];};
export type PersonalOpportunity={npcId:'wren';triggerKey:string;intentHash:string;context:PersonalContext};

export type SocialGesture='dance'|'embrace'|'kiss';
export type ActivityStep={action:'approach'|'meet'|'communicate'|'collect'|'exchange'|'consume'|'rest'|'observe'|'gesture';actorId:NpcId|null;targetId:string|null;item:Good|null;quantity:number|null;gesture:SocialGesture|null;text:string|null;durationSteps:number};
export type ActivityTargetAffordance={targetId:string;collect:Good[];rest:boolean};
export type ActivityBlueprint={name:string;purpose:string;organizerId:NpcId;participants:NpcId[];venue:Venue;steps:ActivityStep[]};
export type ActivityPreview={valid:boolean;errors:string[];warnings:string[];program:ActivityBlueprint|null;capabilitiesHash:string;effects:{requiresIndividualConsent:true;requestedParticipants:NpcId[];changes:string[]}};
export type ActivityResponse={status:'accepted'|'declined'|'withdrawn'|'unreached';reason:string;step:number;eventId:string;provenance:'deterministic-policy'};
export type ActivityOutcome={stepIndex:number;actorId:NpcId;targetId:NpcId|null;outcome:'completed'|'declined'|'blocked';reason:string;eventId:string};
export type ActivityProgram=ActivityBlueprint&{id:string;status:'proposed'|'inviting'|'meeting'|'running'|'completed'|'blocked'|'cancelled';createdStep:number;currentStep:number;responses:Partial<Record<NpcId,ActivityResponse>>;meetingSpots:Partial<Record<NpcId,Point>>;outcomes:ActivityOutcome[];history:string[];provenance:RuleProvenance;sourceIds:string[];stepAssigned:boolean;stepPending:NpcId[];pairQueue:[NpcId,NpcId][];activePair:null|{left:NpcId;right:NpcId;gesture:SocialGesture;remainingSteps:number;started:boolean;expiresAt:number;consentEventIds:string[]};};
export type ActivityRelationship={trust:number;affinity:number;familiarity:number;evidenceIds:string[];lastInteractionStep:number|null};
export type ActivityState={version:1;programs:ActivityProgram[];preferences:Record<NpcId,Record<SocialGesture,number>>;relationships:Record<string,ActivityRelationship>;cooldowns:Record<string,number>};
export type WorldResidentProfile={id:NpcId;name:string;traits:string[];goals:{help:number;belong:number;understand:number}};
export type WorldBlueprint={name:string;premise:string;seed:number;residents:WorldResidentProfile[];wrenValues:PersonalMind['values'];rules:{organizer:Organizer;venue:Venue;foodTarget:number;seedReserve:number;flood:{enabled:boolean;durationSteps:number}};unsupportedRequests:{title:string;description:string;capability:string}[]};
export type WorldBlueprintPreview={kind:'world-blueprint';valid:boolean;errors:string[];warnings:string[];blueprint:WorldBlueprint|null;worldName:string;premise:string;geometry:{id:'cozy-neighborhood-1';width:32;height:24;generated:false};residents:WorldResidentProfile[];wrenValues:PersonalMind['values'];rules:WorldBlueprint['rules'];unsupportedRequests:WorldBlueprint['unsupportedRequests'];effects:string[]};
