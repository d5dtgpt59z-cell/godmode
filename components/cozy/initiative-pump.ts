/** Foreground request coordination only. This never shares the physics/command queue. */
export type InitiativeOutcome="idle"|"pending"|"applied"|"abstained"|"stale"|"rejected"|"unknown"|"failed"|"rate-limited";
export type PumpGate={saveId:string;living:boolean;recorded:boolean;paused:boolean;visible:boolean;enabled:boolean;eligible:boolean;pending:boolean;remainingTotal:number;hourCalls:number;hourLimit:number};
type Attempt={requestId:string|null;nextAt:number;recoveryOnly:boolean};
type Storage={getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void;removeItem:(key:string)=>void};
export type PumpRun<T>={saveId:string;requestId:string;value:T}|null;
const BACKOFF:Record<InitiativeOutcome,number>={idle:5_000,pending:3_000,applied:10_000,abstained:30_000,stale:10_000,rejected:30_000,unknown:130_000,failed:30_000,"rate-limited":60_000};
export class ForegroundInitiativePump{
 private busy=false;
 private attempts=new Map<string,Attempt>();
 constructor(private readonly uuid:()=>string,private readonly now:()=>number=Date.now,private readonly storage?:Storage){}
 private key(id:string){return"godmode-initiative-request:"+id;}
 private stored(id:string):Pick<Attempt,"requestId"|"recoveryOnly">{
  try{const raw=this.storage?.getItem(this.key(id));if(raw){const value=raw.startsWith("{")?JSON.parse(raw):{requestId:raw,recoveryOnly:false};if(typeof value.requestId==="string"&&/^[a-z0-9:-]{1,120}$/i.test(value.requestId)&&typeof value.recoveryOnly==="boolean")return value;}}catch{/* Invalid or unavailable storage must not invent a prior admission. */}
  return{requestId:null,recoveryOnly:false};
 }
 private persist(id:string,value:string|null,recoveryOnly=false){try{if(value)this.storage?.setItem(this.key(id),JSON.stringify({requestId:value,recoveryOnly}));else this.storage?.removeItem(this.key(id));}catch{/* In-memory recovery still works when storage is unavailable. */}}
 async run<T extends {initiative:{status:InitiativeOutcome}}>(gate:PumpGate,request:(saveId:string,requestId:string,recoveryOnly:boolean)=>Promise<T>):Promise<PumpRun<T>>{
  if(this.busy||!gate.living||gate.recorded||gate.paused||!gate.visible||!gate.enabled)return null;
  const attempt=this.attempts.get(gate.saveId)??{...this.stored(gate.saveId),nextAt:0};
  this.attempts.set(gate.saveId,attempt);
  const recovering=attempt.requestId!==null||gate.pending;
  if(this.now()<attempt.nextAt||(!recovering&&(!gate.eligible||gate.remainingTotal<=0||gate.hourCalls>=gate.hourLimit)))return null;
  // A fresh tab may know only that a server ticket exists. Its probe must never admit a new one.
  if(attempt.requestId===null)attempt.recoveryOnly=gate.pending;
  attempt.requestId??=this.uuid();const requestId=attempt.requestId;this.persist(gate.saveId,requestId,attempt.recoveryOnly);this.busy=true;
  try{
   const value=await request(gate.saveId,requestId,attempt.recoveryOnly);const status=value.initiative.status;
   attempt.nextAt=this.now()+BACKOFF[status];
   if(status!=="pending"){attempt.requestId=null;this.persist(gate.saveId,null);}
   return{saveId:gate.saveId,requestId,value};
  }catch(error){
   // A lost response or busy save may already have a durable ticket. Keep its ID.
   attempt.nextAt=this.now()+((error as {code?:string}).code==="COZY_INITIATIVE_DISABLED"?30_000:5_000);
   throw error;
  }finally{this.busy=false;}
 }
}
