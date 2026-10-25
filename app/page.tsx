"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TownStage from "@/components/town-stage";
import WorldGuide from "@/components/world-guide";
import WorldClock, { worldTime } from "@/components/world-clock";
import type { Agent, Intervention, ObserverView, SimEvent, WorldState } from "@/lib/sim/contracts";

type Run = { id: string; revision: number; historyStartTick: number; mode: string; state: WorldState; view: ObserverView; playback: boolean; parentId: string | null; provenance: { label: string; modelCallsThisRequest: number }; budget: { generationAttempts: number; spentMicroUsd: number } };
type SavedWorld = {revision:number;paused:boolean;pace:number;run:Run;clock:{dueSeconds:number;lastWallAt:string;lastTickAt:string|null;lastBackgroundTickAt:string|null;pendingJobId:string|null;lastError:string|null};background:{writerEnabled:boolean;serviceTickVerified:boolean;lastRunAt:string|null;notice:string};history:{id:string;tick_before:number;actual_seconds:number|null;source:"owner"|"service"|"local-test";status:string;completed_at:string|null}[]};
type WorldResponse = {world:SavedWorld|null};
type Tool = "rain" | "resourceDrop" | "message" | null;
type Panel = "resident" | "place" | "census" | "chronicle" | "history" | "compare" | "world" | "about" | null;
const ROOT = "/api/runs";
const time = worldTime;
const dayAt = (tick:number) => Math.floor((tick+21600)/86400)+1;
const human = (text: string) => text.replace(/[_.-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
const goods = (items: Record<string, number>) => Object.entries(items).filter(([, n]) => n > 0).map(([name, n]) => `${n} ${name}`).join(" · ") || "Empty hands";

async function request<T>(url: string, body?: unknown, method:"POST"|"PATCH"="POST"): Promise<T> {
  const response = await fetch(url, body === undefined ? { cache: "no-store" } : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json() as { error?: string | { message?: string }; message?: string };
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : data.error?.message || data.message || "The town could not finish that operation.");
  return data as T;
}

function Icon({ kind, size = 20 }: { kind: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    rain: <><path d="M5 13a4 4 0 0 1 0-8 5 5 0 0 1 9-1 4 4 0 1 1 2 9H5Z"/><path d="m6 16-1 3m7-3-1 3m7-3-1 3"/></>,
    resourceDrop: <><path d="m3 8 8-4 8 4v10l-8 4-8-4V8Z"/><path d="m3 8 8 4 8-4M11 12v10M7 6l8 4"/></>,
    message: <><rect x="2" y="5" width="19" height="14" rx="1"/><path d="m3 6 9 7 8-7"/></>,
    people: <><circle cx="8" cy="7" r="3"/><path d="M2 20v-4a6 6 0 0 1 12 0v4M16 4a3 3 0 0 1 0 6m1 3a5 5 0 0 1 5 5v2"/></>,
    history: <><path d="M4 6a9 9 0 1 1-1 9M4 2v5H0M11 5v7l5 3"/></>,
    book: <><path d="M12 5C8 2 4 3 2 4v16c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-6-1-10 1v16"/></>,
    branch: <><path d="M6 4v10a5 5 0 0 0 10 0V9M6 14V4M13 8l3-3 3 3"/><circle cx="6" cy="3" r="2"/><circle cx="6" cy="21" r="2"/></>,
    eye: <><path d="M1 12c6-10 16-10 22 0-6 10-16 10-22 0Z"/><circle cx="12" cy="12" r="3"/></>,
    play: <path d="m7 4 13 8-13 8V4Z"/>,
    pause: <><path d="M7 4v16M17 4v16"/></>,
    close: <path d="m5 5 14 14M19 5 5 19"/>,
    download: <><path d="M12 2v13m-5-5 5 5 5-5M3 17v5h18v-5"/></>,
    upload: <><path d="M12 17V4m-5 5 5-5 5 5M3 17v5h18v-5"/></>,
    follow: <><circle cx="12" cy="12" r="6"/><path d="M12 0v6m0 12v6M0 12h6m12 0h6"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind] ?? paths.eye}</svg>;
}

export default function Home() {
  const [run, setRun] = useState<Run | null>(null);
  const [savedWorld,setSavedWorld] = useState<SavedWorld|null>(null);
  const [previousExperiment,setPreviousExperiment] = useState<string|null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(2);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [follow, setFollow] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [recipient, setRecipient] = useState("wren");
  const [claim, setClaim] = useState("granary-twelve");
  const [lens, setLens] = useState<string | null>(null);
  const [status, setStatus] = useState<{ configured: boolean; storage: boolean } | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [seed, setSeed] = useState(137);
  const [historyTick, setHistoryTick] = useState(0);
  const [playback, setPlayback] = useState<Run | null>(null);
  const [comparison, setComparison] = useState<Run | null>(null);
  const [aligned, setAligned] = useState<{ original: Run; current: Run } | null>(null);
  const [verified, setVerified] = useState<string | null>(null);
  const [guide, setGuide] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const current = useRef<Run | null>(null);
  const saved = useRef<SavedWorld|null>(null);
  const clockBusy = useRef(false);
  const currentTick = useRef<Promise<void>|null>(null);
  const firstPlay = useRef(true);
  const busyRef = useRef(false);
  const inFlight = useRef(false);
  useEffect(()=>{busyRef.current=busy;},[busy]);

  const remember = useCallback((next: Run) => {
    current.current = next; setRun(next);
    localStorage.setItem("godmode-current-run", next.id);
    if(next.id!==saved.current?.run.id){localStorage.setItem("godmode-previous-experiment",next.id);setPreviousExperiment(next.id);}
  }, []);
  const receiveWorld = useCallback((world:SavedWorld,select=false)=>{
    const watching=select||current.current?.id===world.run.id;
    saved.current=world;setSavedWorld(world);
    localStorage.setItem("godmode-saved-world-run",world.run.id);
    if(watching){remember(world.run);setPlaying(!world.paused);}
  },[remember]);
  const setClock = useCallback(async(settings:{paused?:boolean;pace?:number})=>{
    if(clockBusy.current)return;
    clockBusy.current=true;setBusy(true);setError("");
    try{
      await currentTick.current;
      const head=saved.current;if(!head)throw new Error("The saved world is not ready.");
      const result=await request<WorldResponse>("/api/world",{expectedRevision:head.revision,...settings},"PATCH");
      if(!result.world)throw new Error("The saved world could not be found.");
      receiveWorld(result.world);
    }catch(e){setError((e as Error).message);const latest=await request<WorldResponse>("/api/world").catch(()=>null);if(latest?.world)receiveWorld(latest.world);}
    finally{clockBusy.current=false;setBusy(false);}
  },[receiveWorld]);
  const startPlaying = useCallback(async()=>{
    setStarted(true);
    if(current.current?.id===saved.current?.run.id){const pace=firstPlay.current?1:saved.current!.pace;firstPlay.current=false;await setClock({paused:false,pace});}
    else setPlaying(true);
  },[setClock]);
  const pausePlaying = useCallback(async()=>{
    if(current.current?.id===saved.current?.run.id&&!saved.current?.paused)await setClock({paused:true});
    else{setPlaying(false);await currentTick.current;}
  },[setClock]);
  const togglePlaying = useCallback(()=>{if(current.current?.id===saved.current?.run.id){if(saved.current?.paused)void startPlaying();else void pausePlaying();}else{setStarted(true);setPlaying(value=>!value);}},[startPlaying,pausePlaying]);
  const flash = useCallback((text: string) => { setNotice(text); window.setTimeout(() => setNotice(""), 6500); }, []);
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      setStatus(await request("/api/status"));
      const previous=localStorage.getItem("godmode-current-run");
      let response=await request<WorldResponse>("/api/world");
      if(!response.world)response=await request<WorldResponse>("/api/world",{seed:137});
      if(!response.world)throw new Error("The saved world could not be created.");
      if(previous&&previous!==response.world.run.id)localStorage.setItem("godmode-previous-experiment",previous);
      setPreviousExperiment(localStorage.getItem("godmode-previous-experiment"));
      if(!localStorage.getItem("godmode-tour-v1")){
        if(!response.world.paused)response=await request<WorldResponse>("/api/world",{expectedRevision:response.world.revision,paused:true},"PATCH");
        setGuide(0);
      }else setStarted(true);
      receiveWorld(response.world! ,true);setHistoryTick(response.world!.run.state.tick);
      setZoom(window.innerWidth < 720 ? 1 : window.innerWidth < 1300 ? 2 : 3);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }, [receiveWorld]);
  useEffect(() => { const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer); }, [load]);

  useEffect(() => {
    if (!playing || playback) return;
    const timer = setInterval(async () => {
      const head = current.current;
      if (!head || inFlight.current || busyRef.current || clockBusy.current || head.state.ended) { if (head?.state.ended) setPlaying(false); return; }
      inFlight.current = true;
      const tick=async()=>{try {
        if(head.id===saved.current?.run.id){const result=await request<WorldResponse>("/api/world/tick",{maxSeconds:60});if(result.world)receiveWorld(result.world);}
        else remember(await request<Run>(`${ROOT}/${head.id}/advance`, { expectedRevision: head.revision, seconds: 12 * speed }));
      }catch(e){setPlaying(false);setError((e as Error).message);}
      finally{inFlight.current=false;currentTick.current=null;}};
      currentTick.current=tick();
    }, 1000);
    return () => clearInterval(timer);
  }, [playing, speed, playback, remember,receiveWorld]);

  useEffect(()=>{
    const poll=async()=>{if(inFlight.current||clockBusy.current||busyRef.current)return;try{const result=await request<WorldResponse>("/api/world");if(result.world)receiveWorld(result.world);}catch{ /* Keep the last confirmed state; writes surface actionable errors. */ }};
    const timer=setInterval(()=>void poll(),15000);return()=>clearInterval(timer);
  },[receiveWorld]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches("input,select,textarea,button,a,[contenteditable]")) return;
      if (event.code === "Space") { event.preventDefault(); if (!playback&&!busyRef.current) togglePlaying(); }
      if (event.key === "Escape") { setTool(null); setPanel(null); setFollow(null); }
      if (event.key.toLowerCase() === "c") setPanel(p => p === "census" ? null : "census");
      if (event.key.toLowerCase() === "j") setPanel(p => p === "chronicle" ? null : "chronicle");
      if (event.key.toLowerCase() === "h") { void pausePlaying();setHistoryTick(current.current?.state.tick??0);setPanel(p => p === "history" ? null : "history"); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [playback,togglePlaying,pausePlaying]);

  const active = playback ?? run;
  const view = active?.view;
  const watchingSaved=!!run&&run.id===savedWorld?.run.id;
  const historyMinimum=run?.historyStartTick??0;
  const historyMaximum=Math.max(historyMinimum,Math.floor((run?.state.tick??0)/300)*300);
  const agent = view?.agents.find(a => a.id === selected);
  const place = view?.places.find(p => p.id === placeId);
  const observeAgent = (id: string) => { setSelected(id); setPlaceId(null); setPanel("resident"); };
  const intervene = async (type: Exclude<Tool, null>, targetId?: string) => {
    const head = current.current;
    if (!head || playback || busy || inFlight.current) return;
    setBusy(true); setError("");
    try {
      const commandId = crypto.randomUUID();
      const command: Intervention = { id: commandId, type, targetId: type === "message" ? recipient : targetId ?? (type === "rain" ? "well" : "square"), ...(type === "message" ? { claimId: claim } : {}) };
      remember(await request<Run>(`${ROOT}/${head.id}/command`, { expectedRevision: head.revision, commandId, command }));
      setTool(null);
      flash(type === "rain" ? "Rain scheduled. Watch the well and the crossing." : type === "resourceDrop" ? "Four loaves scheduled for delivery. Who will notice first?" : "Note scheduled. Delivery, reading and belief are separate events.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const selectPlace = (id: string) => {
    if (tool === "resourceDrop") { void intervene(tool, id); return; }
    if (tool === "rain") { void intervene(tool, "well"); return; }
    setPlaceId(id); setSelected(null); setPanel("place");
  };
  const newRun = async (mode = "rule-policy") => {
    setPlaying(false); setBusy(true); setError("");
    try { await currentTick.current;const next = await request<Run>(ROOT, { seed, mode }); remember(next);setPlaying(false); setPlayback(null); setComparison(null);setAligned(null); setVerified(null); setSelected(null); setFollow(null); setPanel(null); setStarted(false); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const rewind = async () => {
    if (!current.current || busy) return;
    await pausePlaying();const head=current.current!;setBusy(true); setError("");
    try { const tick=Math.min(Math.floor(head.state.tick/300)*300,Math.max(head.historyStartTick??0,historyTick));const result = await request<Run>(`${ROOT}/${head.id}/rewind`, { expectedRevision: head.revision, tick }); setPlayback(result);setHistoryTick(tick); setVerified(null); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const fork = async () => {
    if (!current.current || busy) return;
    await pausePlaying();const head=current.current!;setBusy(true); setError("");
    try { const next = await request<Run>(`${ROOT}/${head.id}/fork`, { expectedRevision: head.revision, ...(playback ? { tick: playback.state.tick } : {}) }); setComparison(head); remember(next); setPlayback(null);setPlaying(false);setAligned(null);setStarted(true); setPanel(null); flash("A separate branch. Your saved world and its history are preserved."); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const download = async () => {
    if (!run) return;
    try {
      const data = await request<unknown>(`${ROOT}/${run.id}/export`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = `godmode-${run.id.slice(0,8)}.json`; a.click(); URL.revokeObjectURL(url);
      flash("Recording exported, including provenance and replay inputs.");
    } catch (e) { setError((e as Error).message); }
  };
  const verify = async () => {
    if (!run) return; setBusy(true); setError("");
    try {
      const recording = await request<unknown>(`${ROOT}/${run.id}/export`);
      const result = await request<{ verified: boolean; finalHash: string; modelCalls: number }>("/api/replay", recording);
      setVerified(result.verified ? `Exact replay verified · ${result.modelCalls} model calls · ${result.finalHash}` : "Replay verification failed.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const importRun = async (file?: File) => {
    if (!file) return; setPlaying(false); setBusy(true); setError("");
    try { if (file.size > 12 * 1024 * 1024) throw new Error("Choose a recording smaller than 12 MB.");await currentTick.current; const data = JSON.parse(await file.text()) as unknown; remember(await request<Run>("/api/import", data));setPlaying(false); setPlayback(null); setPanel("history"); flash("Imported recording. No new inference was run."); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const chronicle = view?.events.filter(e => !selected || e.actorId === selected || e.audience.includes(selected as Agent["id"])).slice(-65).reverse() ?? [];
  const eventText = (event: SimEvent) => {
    const payload = event.payload;
    for (const key of ["utterance", "text", "reason", "message", "description"]) if (typeof payload[key] === "string" && payload[key]) return payload[key] as string;
    return human(event.type) + (payload.item ? ` · ${String(payload.quantity ?? "")} ${String(payload.item)}` : "");
  };
  const claims = view?.claims ?? [];
  const guideStep = (step: number) => {
    void pausePlaying(); setStarted(true); setGuide(step); setTool(null);
    if (step === 0) { setPanel(null); setLens(null); }
    if (step === 1) { setPanel("resident"); setSelected("ada"); setFollow("ada"); }
    if (step === 2) { setPanel(null); setTool("rain"); }
    if (step === 3) { setLens(claims[0]?.id ?? null); setPanel("census"); }
    if (step === 4) { setPanel("history"); setHistoryTick(historyMaximum); }
    if (step === 5) { setPanel("world"); }
  };
  const closeGuide = (completed=false) => { setGuide(null); setTool(null); setPanel(null); setFollow(null); setStarted(true); localStorage.setItem("godmode-tour-v1", "seen");if(completed)void startPlaying(); };
  const compare = async () => {
    if (!run || !comparison || busy || inFlight.current) return;
    await pausePlaying();setBusy(true); setError("");
    try {
      const [parentHead,currentHead]=await Promise.all([request<Run>(`${ROOT}/${comparison.id}`),request<Run>(`${ROOT}/${current.current!.id}`)]);
      const tick = Math.floor(Math.min(parentHead.state.tick, currentHead.state.tick) / 300) * 300;
      if(tick<Math.max(parentHead.historyStartTick??0,currentHead.historyStartTick??0))throw new Error("These active history segments do not overlap. Open a retained archive to compare an earlier period.");
      const [original, continuation] = await Promise.all([
        request<Run>(`${ROOT}/${parentHead.id}/rewind`, { expectedRevision: parentHead.revision, tick }),
        request<Run>(`${ROOT}/${currentHead.id}/rewind`, { expectedRevision: currentHead.revision, tick }),
      ]);
      setAligned({ original, current:continuation }); setPanel("compare");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const returnToSaved = async()=>{
    setBusy(true);setError("");setPlaying(false);
    try{await currentTick.current;const result=await request<WorldResponse>("/api/world");if(!result.world)throw new Error("The saved world could not be found.");receiveWorld(result.world,true);setPlayback(null);setPanel(null);setSelected(null);setFollow(null);setStarted(true);setVerified(null);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const openPrevious = async()=>{
    if(!previousExperiment)return;setBusy(true);setError("");setPlaying(false);
    try{await currentTick.current;remember(await request<Run>(`${ROOT}/${previousExperiment}`));setPlaying(false);setPlayback(null);setPanel(null);setStarted(true);setComparison(null);setAligned(null);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const showHistory=()=>{void pausePlaying();setHistoryTick(historyMaximum);setPanel(p=>p==="history"?null:"history");};
  const lastSavedJob=savedWorld?.history.find(job=>job.status==="completed");
  const stamp=(value:string|null|undefined)=>value?new Date(value).toLocaleString():"Not recorded yet";
  const historyValue=Math.min(historyMaximum,Math.max(historyMinimum,historyTick));

  return <main className="game-shell"
    onMouseDownCapture={e=>{if(!(e.target instanceof HTMLCanvasElement))e.stopPropagation();}}
    onMouseUpCapture={e=>{if(!(e.target instanceof HTMLCanvasElement))e.stopPropagation();}}
    onPointerDownCapture={e=>{if(!(e.target instanceof HTMLCanvasElement))e.stopPropagation();}}
    onPointerUpCapture={e=>{if(!(e.target instanceof HTMLCanvasElement))e.stopPropagation();}}>
    {view && <TownStage view={view} selectedId={selected} followId={follow} claimId={lens} zoom={zoom}
      onAgent={observeAgent} onPlace={selectPlace} onGround={() => { if (tool === "rain") void intervene("rain"); else if (tool === "resourceDrop") void intervene("resourceDrop", "square"); else { setSelected(null); setPlaceId(null); if (panel === "resident" || panel === "place") setPanel(null); } }} onReady={() => setReady(true)} />}

    <header className="game-header">
      <button className="wordmark" onClick={() => setPanel(p => p === "about" ? null : "about")} aria-label="About GODMODE"><span className="wordmark-mark">g.</span><span>GODMODE<small>a living microcosm</small></span></button>
      <WorldClock tick={view?.tick??0} day={active?.state.persistent?.day??1} saved={watchingSaved} playing={watchingSaved?!savedWorld?.paused:playing} pace={savedWorld?.pace??0.1} speed={speed} disabled={!run||busy||!!playback||run.state.ended} onToggle={togglePlaying} onPace={()=>{firstPlay.current=false;void setClock({pace:savedWorld?.pace===1?0.1:1});}} onSpeed={()=>setSpeed(s=>s===1?2:s===2?4:1)}/>
      <nav className="top-tools" aria-label="World tools">
        <button className={panel === "census" ? "active" : ""} title="Residents (C)" aria-label="View all 24 residents" onClick={() => setPanel(p => p === "census" ? null : "census")}><Icon kind="people"/><span>24</span></button>
        <button className={panel === "history" ? "active" : ""} title="History (H)" onClick={showHistory}><Icon kind="history"/><span>History</span></button>
        <button className={panel === "chronicle" ? "active" : ""} title="Chronicle (J)" onClick={() => setPanel(p => p === "chronicle" ? null : "chronicle")}><Icon kind="book"/><span>Chronicle</span></button>
        <button title="How to play" aria-label="Open tutorial" onClick={() => guideStep(0)}><span className="guide-help-icon">?</span><span>Guide</span></button>
        <button className={panel==="world"?"active":""} title="Saved world and background updates" aria-label="Saved world clock and update status" onClick={()=>setPanel(p=>p==="world"?null:"world")}><Icon kind="eye"/><span>World</span></button>
      </nav>
    </header>

    {!ready && !error && <div className="loading-world"><span className="loading-firefly"/><p>{run ? "Opening the town…" : "Finding your saved world…"}</p></div>}
    {error && <div className="error-message" role="alert"><strong>One moment.</strong><p>{error}</p><button onClick={() => { setError(""); if (!run) void load(); }}> {run ? "Dismiss" : "Try again"}</button></div>}
    {notice && <div className="world-notice" role="status">{notice}</div>}

    {ready && !started && guide === null && !run?.state.ended && <section className="opening-note">
      <span className="eyebrow">Bellwether, a continuing little world</span>
      <h1>A small world.<br/><em>Its own ideas.</em></h1>
      <p>Twenty-four people with days to live. Watch them work, rest and return tomorrow. Change one condition. See what follows.</p>
      <button className="primary-button" onClick={()=>void startPlaying()}>Let’s explore <span>↗</span></button>
      <small>{run?.mode === "live" ? "Live Meta reasoning" : "Rule-policy baseline · no AI inference"}</small>
    </section>}

    {view && <aside className="world-status" aria-label="World status"><span><i className="status-light"/>{playback ? "Recorded playback" : run?.provenance.label ?? "Rule-policy baseline"}</span><span>{view.metrics.fed}/24 have eaten{active?.state.mode==="persistent"?" today":""}</span><span>{view.crossing.bridgeBuilt ? "Footbridge complete" : view.crossing.blockedUntil > view.tick ? "Ford flooded" : "Ford open"}</span><button className="text-button" onClick={()=>setPanel("world")}>{watchingSaved?`World saved · ${savedWorld?.paused?"paused":"clock running"}`:"Separate experiment · return to saved world"}</button>{watchingSaved&&<button className="text-button" onClick={()=>setPanel("world")}>{savedWorld?.background.serviceTickVerified?"Background receipt recorded · details":"Background schedule unverified · details"}</button>}{!watchingSaved&&<button className="text-button" disabled={busy} onClick={()=>void returnToSaved()}>Return to saved world →</button>}</aside>}

    <div className="camera-tools" aria-label="Camera controls"><button aria-label="Zoom out" onClick={() => setZoom(v => Math.max(1, v - 1))}>−</button><span>{zoom}×</span><button aria-label="Zoom in" onClick={() => setZoom(v => Math.min(5, v + 1))}>+</button>{follow && <button className="stop-follow" onClick={() => setFollow(null)}>Stop following</button>}</div>

    <footer className="intervention-dock" aria-label="Interventions">
      <div className="dock-label">Change a condition<small>then let the town respond</small></div>
      {(["rain", "resourceDrop", "message"] as const).map(kind => <button key={kind} className={`intervention-button ${tool === kind ? "selected" : ""}`} disabled={!run || !!playback || busy || run.state.ended} onClick={() => { void pausePlaying();setTool(t => t === kind ? null : kind); setPanel(null); }}><Icon kind={kind} size={23}/><span>{kind === "rain" ? "Weather" : kind === "resourceDrop" ? "Supplies" : "A note"}</span></button>)}
      <button className={`lens-button ${lens ? "selected" : ""}`} onClick={() => { if (lens) setLens(null); else { setLens(claims[0]?.id ?? null); setPanel("census"); } }} title="Trace a belief"><Icon kind="eye"/><span>Belief lens</span></button>
    </footer>

    {tool && <section className="intervention-card">
      <button className="close-button" aria-label="Cancel intervention" onClick={() => setTool(null)}><Icon kind="close" size={16}/></button>
      <span className="eyebrow">An outside intervention</span>
      <h2>{tool === "rain" ? "A change in the weather." : tool === "resourceDrop" ? "A little more to go around." : "A piece of information."}</h2>
      {tool === "rain" ? <><p>Rain adds four pails to the well. It also floods the low ford for ninety minutes. Who changes their plans?</p><button className="primary-button" disabled={busy || (view?.interventionCounts.rain ?? 0) >= 1} onClick={() => void intervene("rain")}>{(view?.interventionCounts.rain ?? 0) >= 1 ? "Weather event already used" : "Schedule rain"}</button></> : tool === "resourceDrop" ? <><p>Deliver four loaves from the outside reserve. Choose a place in the town, or deliver to the meeting square.</p><div className="inline-detail">Outside reserve <strong>{view?.externalBread ?? 0} loaves</strong></div><button className="primary-button" disabled={busy || (view?.externalBread ?? 0) < 4} onClick={() => void intervene("resourceDrop", "square")}>Deliver to the square</button></> : <><p>An anonymous note enters through an ordinary delivery. Reading it does not mean believing it.</p><label>Recipient<select value={recipient} onChange={e => setRecipient(e.target.value)}>{view?.agents.map(a => <option key={a.id} value={a.id}>{a.name} · {a.role}</option>)}</select></label><label>The note says<select value={claim} onChange={e => setClaim(e.target.value)}>{claims.map(c => <option key={c.id} value={c.id}>{c.text}</option>)}</select></label><button className="primary-button" disabled={busy || (view?.interventionCounts.message ?? 0) >= 3} onClick={() => void intervene("message")}>Deliver the note</button></>}
    </section>}

    {panel && <section className={`field-notebook ${panel === "chronicle" ? "chronicle-panel" : ""}`} aria-label={human(panel)}>
      <button className="close-button" aria-label="Close notebook" onClick={() => setPanel(null)}><Icon kind="close" size={18}/></button>
      <span className="eyebrow">Field notes / {panel === "resident" ? "one individual" : human(panel)}</span>

      {panel==="world"&&savedWorld&&<>
        <h2>A world with tomorrow.</h2>
        <p>Bellwether is saved on the server. Its people work, rest at night and return to a new day. Their history stays with them.</p>
        <div className="fact-row"><span>Saved world</span><strong>Day {savedWorld.run.state.persistent?.day??1} · {time(savedWorld.run.state.tick)}</strong></div>
        <div className="fact-row"><span>Actual clock</span><strong>{savedWorld.paused?"Paused":"Unpaused"}</strong></div>
        <label>World pace<select value={savedWorld.pace===1?"1":"0.1"} disabled={busy} onChange={e=>{firstPlay.current=false;void setClock({pace:Number(e.target.value)});}}><option value="0.1">Slow · 1 world second / 10 real seconds</option><option value="1">Normal · 1 world second / 1 real second</option></select></label>
        <button className="primary-button" disabled={busy} onClick={()=>{firstPlay.current=false;void setClock({paused:!savedWorld.paused});}}>{savedWorld.paused?"Resume saved world":"Pause saved world"}</button>
        {!watchingSaved&&<button className="secondary-button" disabled={busy} onClick={()=>void returnToSaved()}>Return to saved world →</button>}
        <p className="microcopy">Pause and pace change the saved clock for everyone viewing this world. Opening a page or reading its status does not advance it.</p>
        <h3>Updates while you are away</h3>
        <p>{savedWorld.background.serviceTickVerified?"An unattended service update was recorded. Future scheduled execution is not yet confirmed here.":"Background schedule unverified. This browser updates the world while you watch; unattended updates need a separately verified schedule."}</p>
        <div className="fact-row"><span>Last saved update</span><strong>{stamp(savedWorld.clock.lastTickAt)}</strong></div>
        <div className="fact-row"><span>Update source</span><strong>{lastSavedJob?lastSavedJob.source==="service"?"Background service":lastSavedJob.source==="owner"?"Signed-in owner":"Local test":"None recorded"}</strong></div>
        <div className="fact-row"><span>Last background update</span><strong>{stamp(savedWorld.clock.lastBackgroundTickAt)}</strong></div>
        <div className="fact-row"><span>Awaiting catch-up</span><strong>{savedWorld.clock.dueSeconds} world seconds</strong></div>
        {savedWorld.clock.lastError&&<p role="status">Last update needs attention: {human(savedWorld.clock.lastError)}.</p>}
        <p className="microcopy">Updates consume at most 60 owed seconds per server tick. Owed time is not shown as completed world history.</p>
        <h3>Kept history</h3><p>Older segments are archived before the active history is checkpointed. Separate branches preserve this main world.</p>
        <a className="secondary-button" href="/api/world/archives" target="_blank" rel="noreferrer">View retained history segments ↗</a>
        {previousExperiment&&previousExperiment!==run?.id&&<button className="secondary-button" disabled={busy} onClick={()=>void openPrevious()}>Open previous experiment</button>}
      </>}

      {panel === "resident" && agent && <>
        <div className="resident-title"><div className="portrait" style={{ backgroundImage: "url(/assets/contact-characters.png)", backgroundPosition: `${-view!.agents.indexOf(agent) * 21 * 3}px 0`, backgroundSize: "1512px 396px" }}/><div><h2>{agent.name}</h2><p>{agent.role}</p></div></div>
        <p className="current-action">{agent.action}</p>
        <button className="text-button" onClick={() => setFollow(f => f === agent.id ? null : agent.id)}><Icon kind="follow" size={14}/>{follow === agent.id ? "Stop following" : `Follow ${agent.name}`}</button>
        <div className="fact-row"><span>Carrying</span><strong>{goods(agent.inventory)}</strong></div>
        <div className="fact-row"><span>Meal</span><strong>{agent.fed ? "Has eaten" : "Not yet"}</strong></div>
        <h3>What matters to {agent.name}</h3><ul className="goal-list">{agent.goals.map(goal => <li key={goal.id}>{goal.label}<span>{goal.weight}</span></li>)}</ul>
        <h3>Current stated reason</h3><blockquote>{agent.intent?.reason || "No decision has been committed yet."}</blockquote><p className="microcopy">A declared reason, checked against this person’s evidence.</p>
        <h3>Recent memories</h3><div className="memory-list">{agent.observations.slice(-6).reverse().map(o => <details key={o.id}><summary>{o.text}</summary><p>{time(o.tick)} · {o.channel} · {o.id}</p><small>Source: {o.eventId}</small></details>)}</div>
        <h3>Beliefs</h3>{Object.values(agent.beliefs).length ? Object.values(agent.beliefs).map(b => <div className="belief-entry" key={b.claimId}><button onClick={() => setLens(lens === b.claimId ? null : b.claimId)}>{claims.find(c => c.id === b.claimId)?.text ?? b.claimId}</button><span>{b.stance} · {b.confidence}/100 subjective confidence</span><small>{b.evidenceIds.length} source reference{b.evidenceIds.length === 1 ? "" : "s"}</small></div>) : <p className="muted">No tracked claim adopted yet.</p>}
        <h3>Relationships</h3>{Object.entries(agent.relationships).map(([id, relation]) => <div className="fact-row" key={id}><button className="text-button" onClick={() => observeAgent(id)}>{view!.agents.find(a => a.id === id)?.name ?? id}</button><span>trust {relation?.trust} · affinity {relation?.affinity}</span></div>)}
        <p className="provenance-note">Decisions: {agent.decisions.rule} rule · {agent.decisions.meta} Meta · {agent.decisions.fallback} fallback</p>
      </>}

      {panel === "place" && place && <><h2>{place.name}</h2><p>{human(place.kind)}</p><h3>Actual stock</h3>{Object.entries(place.stock).map(([item,n]) => <div className="fact-row" key={item}><span>{item}</span><strong>{n}</strong></div>)}<p className="microcopy">Observer view. Residents learn quantities by seeing, reading or being told.</p>{place.id === "bridge" && <><h3>Footbridge</h3><p>{view!.crossing.bridgeBuilt ? "Complete. Raised passage and faster traversal." : `${Math.round(view!.metrics.bridgeProgress * 100)}% complete. Timber and actual worker contributions required.`}</p></>}<h3>Nearby</h3>{view!.agents.filter(a => Math.abs(a.x-place.x)+Math.abs(a.y-place.y) < 5).map(a => <button className="resident-link" key={a.id} onClick={() => observeAgent(a.id)}><strong>{a.name}</strong><span>{a.action}</span></button>)}</>}

      {panel === "census" && <><h2>Twenty-four lives.</h2><p>Each with their own memories, information and priorities.</p>{lens && <label className="lens-select">Tracing a claim<select value={lens} onChange={e => setLens(e.target.value)}>{claims.map(c => <option key={c.id} value={c.id}>{c.text}</option>)}</select><small>○ believes · ◇ doubts · × rejects. Lines show recorded communication, not proved causation.</small></label>}<div className="census-list">{view?.agents.map(a => <button key={a.id} onClick={() => observeAgent(a.id)}><span className={`census-dot ${a.fed ? "fed" : ""}`}/><span><strong>{a.name}</strong><small>{a.role}</small></span><em>{lens && a.beliefs[lens] ? a.beliefs[lens].stance : a.action}</em></button>)}</div></>}

      {panel === "chronicle" && <><h2>The town, as it happened.</h2><div className="panel-actions"><button className="text-button" onClick={() => setSelected(null)}>Everyone</button>{selected && <span>Following {selected}</span>}</div><ol className="chronicle-list">{chronicle.map(e => <li key={e.id}><time>{time(e.tick)}</time><div><span>{view!.agents.find(a => a.id === e.actorId)?.name ?? "The world"}</span><p>{eventText(e)}</p><details><summary>Evidence record</summary><code>{e.id}</code><p>{human(e.type)} · {e.audience.length} in audience</p><small>{e.sourceIds.length ? `Sources: ${e.sourceIds.join(", ")}` : "Direct event"}</small></details></div></li>)}</ol></>}

      {panel === "history" && <><h2>Another way through.</h2><p>Replay the recorded past, then branch from a settled moment.</p>{historyMinimum>0&&<p className="microcopy">This active segment begins at day {dayAt(historyMinimum)}, {time(historyMinimum)}. Earlier history is preserved in <a href="/api/world/archives" target="_blank" rel="noreferrer">retained archives ↗</a>.</p>}<label>Recorded time <strong>{time(historyValue)}</strong><input type="range" min={historyMinimum} max={historyMaximum} step="300" value={historyValue} onChange={e => setHistoryTick(Number(e.target.value))}/></label><button className="primary-button" disabled={busy} onClick={() => void rewind()}>View this moment</button>{playback && <button className="text-button" onClick={() => { setPlayback(null); setSelected(null); }}>Return to the latest state</button>}<button className="secondary-button" disabled={busy || (playback?playback.state.tick:run?.state.tick??0)%300!==0} onClick={() => void fork()}><Icon kind="branch" size={16}/>Branch from {playback ? time(playback.state.tick) : "here"}</button>{comparison && <button className="text-button" onClick={() => void compare()}>Compare with the preserved world →</button>}<h3>Verify the record</h3><p className="microcopy">Rebuild this history with model calls disabled and compare its state hash.</p><button className="secondary-button" disabled={busy} onClick={() => void verify()}>Verify exact replay</button>{verified && <p className="verification-result">{verified}</p>}<div className="panel-actions"><button onClick={() => void download()}><Icon kind="download" size={16}/>Export</button><button onClick={() => fileInput.current?.click()}><Icon kind="upload" size={16}/>Import</button></div></>}

      {panel === "compare" && aligned && <><h2>Two continuations.</h2><p>Observed differences under these recorded conditions. Fresh model choices can also vary.</p><table className="comparison-table"><thead><tr><th>At {time(aligned.current.state.tick)}</th><th>Original</th><th>Current</th></tr></thead><tbody><tr><td>Recorded time</td><td>{time(aligned.original.state.tick)}</td><td>{time(aligned.current.state.tick)}</td></tr><tr><td>Residents fed</td><td>{aligned.original.view.metrics.fed}/24</td><td>{aligned.current.view.metrics.fed}/24</td></tr><tr><td>Bridge</td><td>{aligned.original.view.crossing.bridgeBuilt ? "Built" : "Unfinished"}</td><td>{aligned.current.view.crossing.bridgeBuilt ? "Built" : "Unfinished"}</td></tr><tr><td>Meta decisions</td><td>{aligned.original.view.metrics.metaDecisions}</td><td>{aligned.current.view.metrics.metaDecisions}</td></tr><tr><td>Supplies delivered</td><td>{aligned.original.view.interventionCounts.resourceDrop * 4}</td><td>{aligned.current.view.interventionCounts.resourceDrop * 4}</td></tr></tbody></table><p className="microcopy">Both records are aligned to the same simulated time. This comparison is descriptive.</p><button className="secondary-button" onClick={() => setPanel("history")}>Return to history</button></>}

      {panel === "about" && <><h2>GODMODE</h2><p className="intro-copy">A small world.<br/>Its own ideas.</p><p>A living microcosm by Ryan Morrison / Built by Magnus. Observe 24 people, change a condition and follow the consequences.</p><h3>This build</h3><p>{run?.provenance.label ?? "Preparing a run"}. Meta reasoning is {status?.configured ? "configured" : "not connected"}. No model response is fabricated.</p><p className="microcopy">Local prototype begun October 25, 2026. Hackathon eligibility remains unconfirmed. Final submission is held.</p><a className="secondary-button" href="/assets/viewer.html" target="_blank" rel="noreferrer">Explore the sprite sheets ↗</a>{savedWorld&&!watchingSaved&&<button className="secondary-button" disabled={busy} onClick={()=>void returnToSaved()}>Return to saved world</button>}{previousExperiment&&previousExperiment!==run?.id&&<button className="secondary-button" disabled={busy} onClick={()=>void openPrevious()}>Open previous experiment</button>}<p className="microcopy">The saved world continues through day and night. These separate six-hour experiments preserve its main record.</p><label>New afternoon seed<input type="number" min="0" max="2147483647" value={seed} onChange={e => setSeed(Number(e.target.value))}/></label><button className="secondary-button" disabled={busy} onClick={() => void newRun()}>Start a new rule-policy afternoon</button><button className="secondary-button" disabled={busy || !status?.configured} onClick={() => void newRun("live")}>{status?.configured ? "Start a live Meta afternoon" : "Live Meta awaits verified access"}</button><p className="microcopy">Space: pause · WASD/arrows: camera · C: residents · J: chronicle · H: history · Escape: close</p></>}
    </section>}

    {run?.state.ended && !playback && panel === null && <section className="ending-note"><span className="eyebrow">An afternoon recorded</span><h2>The town made its choices.</h2><p>{run.view.metrics.fed} of 24 residents ate. {run.view.crossing.bridgeBuilt ? "They built a raised footbridge." : "The crossing remains a ford."}</p><button className="primary-button" onClick={() => { setHistoryTick(0); setPanel("history"); }}>Rewind. Try another condition.</button></section>}
    {ready && guide !== null && <WorldGuide step={guide} onStep={guideStep} onClose={closeGuide}/>}
    <input type="file" accept="application/json,.json" ref={fileInput} hidden onChange={e => { void importRun(e.target.files?.[0]); e.target.value = ""; }}/>
    <span className="build-credit">BUILT BY MAGNUS <span>·</span> LOCAL PROTOTYPE</span>
  </main>;
}
