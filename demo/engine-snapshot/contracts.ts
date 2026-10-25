/** GODMODE's serializable, renderer-independent simulation contracts. */
export const ENGINE_VERSION = 'godmode-engine-1';
export const CONTENT_VERSION = 'bellwether-1';
export const EPOCH_SECONDS = 300;
export const HORIZON_SECONDS = 21_600;
export const AGENT_IDS = ['iona','bram','leda','kitt','moss','ada','tomas','orin','june','nell','pip','sela','rook','mara','dara','vale','wren','ivo','elin','bo','fenn','joss','tavi','una'] as const;
export type AgentId = typeof AGENT_IDS[number];
export type Good = 'grain' | 'water' | 'timber' | 'bread';
export type Goods = Record<Good, number>;
export type Point = { x: number; y: number };
export type Action = 'move'|'work'|'collect'|'deliver'|'give'|'request'|'eat'|'inspect'|'talk'|'read'|'wait';
export type Provenance = 'rule'|'meta'|'fallback';
export type WorldMode = 'scenario'|'persistent';
export type Stance = 'believe'|'doubt'|'reject';
export type DecisionProposal = {
  action: Action; targetId: string|null; item: Good|null; quantity: number; duration: number;
  claimId: string|null; utterance: string; goalId: string|null; evidenceIds: string[];
  beliefUpdates: {claimId:string;stance:Stance;confidence:number;evidenceIds:string[]}[];
  reason: string;
};
export type Belief = {claimId:string;stance:Stance;confidence:number;evidenceIds:string[];updatedAt:number};
export type Observation = {id:string;eventId:string;tick:number;channel:'saw'|'heard'|'read'|'self';text:string;claimId:string|null;sourceId:string|null;details?:{placeId?:string;stock?:Goods}};
export type Relationship = {trust:number;affinity:number;evidenceIds:string[]};
export type Goal = {id:string;label:string;weight:number};
export type Intent = {action:Action;targetId:string|null;item:Good|null;quantity:number;startedAt:number;expiresAt:number;phase:string;path:Point[];sourceId:string|null;offerId:string|null;reason:string;evidenceIds:string[];utterance:string;claimId:string|null};
export type Agent = {
  id:AgentId;name:string;role:string;homeId:string;traits:string[];capabilities:string[];
  x:number;y:number;inventory:Goods;needs:{hunger:number;fatigue:number};fed:boolean;
  intent:Intent|null;action:string;knownPlaces:string[];observations:Observation[];memories:string[];
  beliefs:Record<string,Belief>;relationships:Partial<Record<AgentId,Relationship>>;goals:Goal[];
  decisions:{rule:number;meta:number;fallback:number};contributions:{deliveries:number;workSeconds:number;shared:number};
  moveProgress:number;lastSocialAt:number;
};
export type Place = {id:string;name:string;kind:string;x:number;y:number;stock:Goods;ownerId:AgentId|null;allowed:AgentId[]|null;capacity:number};
export type Claim = {id:string;text:string;subjectId:string|null;kind:'fact'|'expectation';predicate:string;value:number|string|null};
export type Note = {id:string;recipientId:AgentId;claimId:string;deliveredAt:number;readAt:number|null};
export type Offer = {id:string;fromId:AgentId;toId:AgentId;item:Good;quantity:number;createdAt:number;expiresAt:number;status:'pending'|'accepted'|'declined'|'expired';request:boolean};
export type Reservation = {id:string;agentId:AgentId;placeId:string;item:Good;quantity:number;expiresAt:number};
export type SimEvent = {id:string;seq:number;branchId:string;tick:number;phase:string;type:string;actorId:string|null;audience:AgentId[];payload:Record<string,unknown>;sourceIds:string[];prevHash:string;hash:string};
export type AgentContext = {
  mode?:WorldMode;
  agent:{id:AgentId;name:string;role:string;traits:string[];capabilities:string[];x:number;y:number;inventory:Goods;needs:Agent['needs'];fed:boolean;goals:Goal[];currentAction:string;contributions:Agent['contributions']};
  tick:number;time:string;places:{id:string;name:string;kind:string;x:number;y:number;stock:Goods|null;accessible:boolean}[];
  nearbyAgents:{id:AgentId;name:string;role:string}[];observations:Observation[];beliefs:Belief[];
  relationships:{agentId:AgentId;trust:number;affinity:number}[];notes:{id:string;read:boolean}[];
  offers:Offer[];claims:Claim[];allowedActions:Action[];
};
export type DecisionTicket = {id:string;agentId:AgentId;triggerKind:'bootstrap'|'heartbeat'|'event';snapshotTick:number;effectiveTick:number;context:AgentContext;requestHash:string;status:'pending'|'resolved';proposal:DecisionProposal|null;provenance:Provenance;failure:string|null};
export type Intervention = {id:string;type:'rain'|'resourceDrop'|'message';targetId?:string|null;claimId?:string|null};
export type QueuedIntervention = Intervention & {effectiveTick:number};
export type Ledger = {initial:Goods;external:Goods;environment:Goods;produced:Goods;recipeConsumed:Goods;eaten:Goods;waste:Goods};
export type RecordingOperation =
  | {type:'advance';seconds:number;rulePolicy:boolean}
  | {type:'intervention';command:Intervention}
  | {type:'decision';ticketId:string;proposal:DecisionProposal;provenance:Provenance;failure:string|null};
export type Checkpoint = {tick:number;eventSeq:number;eventHash:string;stateHash:string};
export type WorldState = {
  mode:WorldMode;persistent:{day:number;lastDawn:number|null;totalMeals:number;eventWindowStart:number;eventWindowCount:number}|null;
  version:1;engineVersion:string;contentVersion:string;seed:number;branchId:string;parentBranchId:string|null;
  tick:number;settledTick:number;phase:'bootstrap'|'running'|'barrier'|'finished';width:number;height:number;agents:Agent[];places:Place[];
  claims:Claim[];notes:Note[];offers:Offer[];reservations:Reservation[];events:SimEvent[];eventSeq:number;eventHead:string;checkpoints:Checkpoint[];
  tickets:DecisionTicket[];queuedInterventions:QueuedIntervention[];heartbeatCount:Record<AgentId,number>;eventDecisionCount:number;
  triggers:Partial<Record<AgentId,string[]>>;decisionCount:number;externalBread:number;interventionCounts:{rain:number;resourceDrop:number;message:number};
  weather:{rainingUntil:number;rainStartedAt:number|null};crossing:{x:number;y:number;blockedUntil:number;bridgeBuilt:boolean;workSeconds:number;materialsUsed:boolean};
  oven:{startedAt:number|null;finishesAt:number|null;workerId:AgentId|null};ledger:Ledger;blocked:boolean;ended:boolean;
  nextId:number;operations:RecordingOperation[];origin:WorldOrigin;
};
export type WorldOrigin = {seed:number;branchId:string;parentBranchId:string|null;mode?:WorldMode;checkpointState?:string;priorArchiveHash?:string};
export type Recording = {version:1;engineVersion:string;contentVersion:string;origin:WorldOrigin;operations:RecordingOperation[];finalTick:number;finalHash:string;eventHead:string;checkpoints:Checkpoint[]};
export type AdvanceOptions = {rulePolicy?:boolean};
export type ObserverView = Pick<WorldState,'tick'|'phase'|'width'|'height'|'agents'|'places'|'events'|'notes'|'offers'|'claims'|'weather'|'crossing'|'externalBread'|'interventionCounts'|'blocked'|'ended'|'checkpoints'|'persistent'> & {branchId:string;worldMode:WorldMode;mode:'rule'|'live'|'hybrid';metrics:{fed:number;population:number;breadConsumed:number;bridgeProgress:number;decisions:number;metaDecisions:number;fallbackDecisions:number}};
export type InvariantViolation = {code:string;message:string};
