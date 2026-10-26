"use client";
import {useEffect,useRef,useState} from "react";
import CozyGame from "./cozy-game";
import type {CozySaveDTO} from "@/lib/server/cozy-contract";
import {canCreateForge,prepareForgeCreate,prepareForgePreview,readForgeAttempt,retainForgePreview,type ForgeAttempt,type ForgeReply} from "./world-forge-state";
import "./world-forge.css";

type ForgeStatus={worldForgeAvailable:boolean;worldForgeFalseReason:string|null};
type ExistingWorld={id:string;name:string;residents:number;paused:boolean};
const ATTEMPT_KEY="godmode-world-forge-attempt",PROMPT_KEY="godmode-world-forge-prompt";
const uuid=()=>crypto.randomUUID();
async function request<T>(path:string,body?:unknown):Promise<T>{
 const response=await fetch(path,body===undefined?{cache:"no-store"}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await response.json() as {error?:string|{message?:string};message?:string;code?:string};
 if(!response.ok){const error=new Error(typeof data.error==="string"?data.error:data.error?.message??data.message??"This request could not be completed.");Object.assign(error,{code:data.code,status:response.status});throw error;}
 return data as T;
}
function savedWorld(save:CozySaveDTO):ExistingWorld{return{id:save.id,name:save.state.world?.name??"Your neighborhood",residents:save.state.npcs.length,paused:save.clock.paused};}

export default function WorldForge(){
 const [playing,setPlaying]=useState(false),[entry,setEntry]=useState(0),[prompt,setPrompt]=useState("");
 const [status,setStatus]=useState<ForgeStatus|null>(null),[existing,setExisting]=useState<ExistingWorld|null>(null),[checking,setChecking]=useState(true);
 const [attempt,setAttempt]=useState<ForgeAttempt|null>(null),[reply,setReply]=useState<ForgeReply|null>(null),[busy,setBusy]=useState<"preview"|"create"|null>(null),[error,setError]=useState("");
 const inFlight=useRef(false),alive=useRef(true),promptDirty=useRef(false);
 const [previewTime,setPreviewTime]=useState(0);
 const persist=(next:ForgeAttempt)=>{setAttempt(next);try{sessionStorage.setItem(ATTEMPT_KEY,JSON.stringify(next));}catch{}};
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{let active=true;void(async()=>{
  let savedPrompt="",savedAttempt:ForgeAttempt|null=null;try{savedPrompt=sessionStorage.getItem(PROMPT_KEY)??"";savedAttempt=readForgeAttempt(sessionStorage.getItem(ATTEMPT_KEY));}catch{}
  const results=await Promise.allSettled([request<ForgeStatus>("/api/cozy/status"),(async()=>{let id:string|null=null;try{id=localStorage.getItem("godmode-cozy-save");}catch{}if(id&&/^[a-f0-9-]{36}$/i.test(id)){try{const result=await request<{save:CozySaveDTO|null}>("/api/cozy/"+id);if(result.save)return result.save;}catch{}}return(await request<{save:CozySaveDTO|null}>("/api/cozy")).save;})()]);
  if(!active)return;if(!promptDirty.current)setPrompt(savedPrompt);setAttempt(savedAttempt);const [availability,world]=results;if(availability.status==="fulfilled")setStatus(availability.value);else setError("World creation could not be checked. You can still return to an available saved world.");if(world.status==="fulfilled"&&world.value)setExisting(savedWorld(world.value));setChecking(false);
 })();return()=>{active=false;};},[entry]);
 useEffect(()=>{if(!reply)return;const timer=setInterval(()=>setPreviewTime(Date.now()),1000);return()=>clearInterval(timer);},[reply]);
 const changePrompt=(value:string)=>{promptDirty.current=true;setPrompt(value);setReply(null);setError("");try{sessionStorage.setItem(PROMPT_KEY,value);}catch{}};
 const preview=async()=>{
  if(inFlight.current||!status?.worldForgeAvailable)return;inFlight.current=true;setBusy("preview");setError("");setReply(null);
  try{const next=prepareForgePreview(attempt,prompt,uuid);persist(next);const result=await request<ForgeReply>("/api/cozy/forge/proposals",{requestId:next.requestId,prompt:next.prompt});if(!alive.current)return;persist(retainForgePreview(next,result));setReply(result);setPreviewTime(Date.now());if(result.proposal.status!=="ready"&&result.proposal.status!=="applied")setError(result.proposal.status==="generating"?"This saved request is still pending. Check it again using the same request.":"This saved request did not produce a ready blueprint. Its receipt is retained; edit the description to start a different request.");}
  catch(cause){if(alive.current){const code=(cause as {code?:string}).code;setError(code==="COZY_MODEL_PENDING"?"Muse is still working on this saved request. Check the same request again; no duplicate generation will be sent.":(cause as Error).message);}}
  finally{inFlight.current=false;if(alive.current)setBusy(null);}
 };
 const create=async(recover=false)=>{
  if(inFlight.current||!attempt||(!recover&&!canCreateForge(reply)))return;inFlight.current=true;setBusy("create");setError("");
  try{const next=prepareForgeCreate(attempt,uuid);persist(next);const result=await request<{save:CozySaveDTO}>("/api/cozy/forge/create",{draftId:next.draftId,proposalId:next.proposalId,commandId:next.createCommandId});if(!alive.current)return;localStorage.setItem("godmode-cozy-save",result.save.id);setExisting(savedWorld(result.save));setPlaying(true);}
  catch(cause){if(alive.current)setError((cause as Error).message+" The same creation receipt is retained for recovery.");}
  finally{inFlight.current=false;if(alive.current)setBusy(null);}
 };
 const continueWorld=()=>{if(!existing||inFlight.current)return;try{localStorage.setItem("godmode-cozy-save",existing.id);setPlaying(true);}catch{setError("This browser could not remember the saved world. Enable local storage before continuing.");}};
 const newRequest=()=>{setAttempt(null);setReply(null);setError("");try{sessionStorage.removeItem(ATTEMPT_KEY);}catch{}};
 const returnToEntry=()=>{setChecking(true);setStatus(null);setPlaying(false);setEntry(value=>value+1);setError("");};
 if(playing)return <CozyGame onCreateWorld={returnToEntry}/>;
 const applied=reply?.proposal.status==="applied";
 const sameAttempt=attempt?.prompt===prompt.trim(),ready=canCreateForge(reply,previewTime),expired=!!reply&&Date.parse(reply.proposal.expiresAt)<=previewTime,blueprint=reply?.proposal.preview;
 return <main className="world-forge"><div className="world-forge-console"><header><span className="world-forge-wordmark">GODMODE</span><span className="world-forge-local">a universe, beginning</span></header><section aria-labelledby="forge-title"><h1 id="forge-title">Describe your universe.</h1><p className="world-forge-intro">A place. Its people. What they want. What might happen.</p><form onSubmit={event=>{event.preventDefault();void preview();}}><div className="world-forge-prompt"><span aria-hidden="true">&gt;</span><textarea id="world-description" aria-label="Describe your universe" aria-describedby="forge-keys forge-scope" maxLength={1000} value={prompt} disabled={!!busy} onChange={event=>changePrompt(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();if(prompt.trim().length>=3)void preview();}}} placeholder="Describe a world you would like to spend time in…" autoFocus/></div><div className="world-forge-command-line"><button type="submit" disabled={checking||!!busy||!status?.worldForgeAvailable||prompt.trim().length<3}>{busy==="preview"?"Waiting for Muse…":sameAttempt?"Check saved request":"Preview with Muse"}<span aria-hidden="true">↵</span></button><small id="forge-keys">Enter to preview · Shift + Enter for a new line</small></div></form><p className="world-forge-scope" id="forge-scope">The current world has three resident slots in one fixed neighborhood. A blueprint can shape their names, personalities, priorities and supported rules. Requests beyond those mechanics remain possibilities.</p>
  {checking&&<p className="world-forge-status" role="status">Checking the doorway…</p>}{!checking&&status&&!status.worldForgeAvailable&&<div className="world-forge-availability"><p>Muse world creation is not connected yet.</p><p className="world-forge-quiet">Your description can stay here. Continue the saved world below to farm, meet neighbors and use direct controls without a model.</p><details><summary>Why creation is unavailable</summary><p>{status.worldForgeFalseReason??"Verified Meta access is required. No alternate model has been used."}</p></details></div>}{error&&<p className="world-forge-error" role="alert">{error}</p>}
  {blueprint&&<section className="world-forge-blueprint" aria-labelledby="forge-blueprint-title"><span className="world-forge-kicker">{reply?.proposal.source==="fixture"?"Recorded fixture blueprint":"Muse blueprint"} · review before creating</span><h2 id="forge-blueprint-title">{blueprint.worldName}</h2><p>{blueprint.premise}</p><div className="world-forge-residents">{blueprint.residents.map(resident=><div key={resident.id}><strong>{resident.name}</strong><span>{resident.traits.join(" · ")}</span></div>)}</div><p className="world-forge-quiet">Existing neighborhood · {blueprint.geometry.width} × {blueprint.geometry.height} tiles · terrain and art are not generated by this blueprint.</p>{blueprint.effects.length>0&&<ul>{blueprint.effects.map(effect=><li key={effect}>{effect}</li>)}</ul>}{blueprint.unsupportedRequests.length>0&&<div className="world-forge-possibilities"><h3>Still imagined</h3>{blueprint.unsupportedRequests.map((wish,index)=><p key={`${wish.title}:${index}`}><strong>{wish.title}</strong> — {wish.description}<small>Not an implemented mechanic.</small></p>)}</div>}{blueprint.warnings.map(warning=><p className="world-forge-warning" key={warning}>{warning}</p>)}{blueprint.errors.map(message=><p className="world-forge-error" key={message}>{message}</p>)}<button className="world-forge-create" disabled={(!ready&&!applied)||!!busy} onClick={()=>void create(applied)}>{busy==="create"?"Opening your world…":applied?"Open the created world":"Create this world"}<span>→</span></button><p className="world-forge-quiet">A separate paused save. Your earlier worlds remain intact.</p>{expired&&<><p className="world-forge-warning">This preview has expired. Review a new request before creating.</p><button className="world-forge-new-request" onClick={newRequest}>Start a new preview request</button></>}</section>}
  {reply&&reply.proposal.status!=="ready"&&reply.proposal.status!=="generating"&&<button className="world-forge-new-request" disabled={!!busy} onClick={newRequest}>Start a new preview request</button>}
  {!reply&&sameAttempt&&attempt?.createCommandId&&attempt.draftId&&attempt.proposalId&&<button className="world-forge-recover" disabled={!!busy} onClick={()=>void create(true)}>Recover the created world<span>→</span></button>}
 </section><footer>{existing&&<button className="world-forge-continue" disabled={!!busy} onClick={continueWorld}>Continue saved world<span>→</span><small>{existing.name} · {existing.residents} residents · saved {existing.paused?"paused":"running"}</small></button>}<span className="world-forge-footer-note">Local prototype · Built by Magnus</span></footer></div></main>;
}
