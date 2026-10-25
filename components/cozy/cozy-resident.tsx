import {useState} from "react";
import type {ActorId,CozyWorldState,Npc,PersonalPlanStep,PersonalStatus} from "@/lib/cozy/contracts";
import {memorySummary,needsSummary,personName,provenanceLabel,relationshipLabel,taskLabel} from "./social-presentation";
import {ResidentSocialNotes} from "./cozy-emergence";

export function ResidentPortrait({id,name,small=false}:{id:ActorId;name:string;small?:boolean}){
 return <span className={"cozy-resident-portrait"+(small?" small":"")}>
  {/* The generated cast portraits use nearest-neighbor rendering. */}
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img src={`/assets/cozy/portraits/${id}-neutral.png?v=cast-4`} alt={small?"":`${name}'s portrait`} draggable={false}/>
 </span>;
}

const statusCopy:Record<PersonalStatus,string>={imagined:"An idea for someday",proposed:"Thinking it through",attempted:"Trying it now",suspended:"Set aside for a moment",blocked:"Something is missing",completed:"A small plan, finished",abandoned:"Letting this one go"};
export const personalStatusLabel=(status:PersonalStatus)=>statusCopy[status];
const stepStatusCopy:Record<PersonalStatus,string>={imagined:"Not started",proposed:"Next",attempted:"Underway",suspended:"On hold",blocked:"Blocked",completed:"Done",abandoned:"Stopped"};
export function personalStepLabel(state:CozyWorldState,step:PersonalPlanStep){
 const destination=state.places.find(place=>place.id===step.targetId)?.name??state.worldObjects?.find(object=>object.id===step.targetId)?.name??(state.plots.some(plot=>plot.id===step.targetId)?"the wheat field":state.npcs.find(npc=>npc.id===step.targetId)?.name??(step.targetId==="player"?"you":null));
 return step.action==="inspect"?`Take a closer look${destination?` at ${destination}`:""}`:step.action==="rest"?"Take a little rest":step.action==="eat"?"Eat something from the bag":step.action==="seek-meal"?"Look for a real meal":step.action==="approach"?`Walk over to ${destination??"a familiar place"}`:step.action==="talk"?`Have a word with ${destination??"a neighbor"}`:step.action==="cooperate"?"Help with the shared preparations":"Wait and see";
}

export function PersonalNotes({state}:{state:CozyWorldState}){
 const mind=state.mind;if(!mind)return null;const name=personName(state,mind.npcId);const plan=mind.plan,aspirations=[...mind.aspirations].reverse();
 return <section className="cozy-personal-notes"><span className="cozy-eyebrow">A page from {name}’s notebook</span><h3>On {name}’s mind.</h3><p className="cozy-note-caption">Private notes · what {name} hopes, believes and is trying. These are not words you have overheard.</p>
  {mind.regulation&&<p className="cozy-personal-aside">{mind.regulation.need==="food"?"First, something to eat. A bigger plan can wait.":"First, a little rest. A bigger plan can wait."}</p>}
  {plan&&<div className="cozy-personal-plan"><span className="cozy-note-date">{personalStatusLabel(plan.status)} · {provenanceLabel(plan.provenance)}</span><h4>{plan.summary}</h4><ol className="cozy-plan-steps">{plan.steps.map(step=><li key={step.id} data-state={step.status}><span className="cozy-step-mark" aria-hidden="true">{step.status==="completed"?"✓":step.status==="attempted"?"›":"·"}</span><span>{personalStepLabel(state,step)}<small>{stepStatusCopy[step.status]}</small></span></li>)}</ol>{plan.blockedReason&&<p className="cozy-personal-aside">{plan.blockedReason}</p>}</div>}
  {aspirations.length?aspirations.map(aspiration=><div className="cozy-aspiration" key={aspiration.id}><span className="cozy-note-date">{personalStatusLabel(aspiration.status)} · {provenanceLabel(aspiration.provenance)}</span><h4>{aspiration.title}</h4><p>{aspiration.description}</p>{aspiration.motivation&&<p className="cozy-aspiration-motive">{aspiration.motivation}</p>}{aspiration.requestedCapability&&<p className="cozy-missing-mechanic">A wish that needs a new game mechanic: {aspiration.requestedCapability}. It has not been made possible.</p>}</div>):<p className="cozy-personal-aside">No longer-term wish has been written down yet. {name} can notice, imagine, or decide to wait.</p>}
  {mind.beliefs.length>0&&<details className="cozy-notebook-fold"><summary>What {name} thinks is true</summary>{[...mind.beliefs].reverse().slice(0,6).map(belief=><div className="cozy-belief" key={belief.id}><span className="cozy-note-date">{belief.status==="contradicted"?"Contradicted by evidence":belief.status==="tentative"?"Still uncertain":`Supported in ${name}’s notes`} · {belief.kind==="testimony"?`Heard from ${belief.sourceId?personName(state,belief.sourceId):"someone"}`:belief.kind==="inference"?`${name}’s interpretation`:"Seen firsthand"}</span>{belief.previousClaim&&<p><s>{belief.previousClaim}</s></p>}<p>{belief.status==="contradicted"?<s>{belief.claim}</s>:belief.claim}</p></div>)}</details>}
  <details className="cozy-notebook-fold"><summary>The kind of neighbor {name} is</summary><p>Drawn to {Object.entries(mind.values).sort(([,left],[,right])=>right-left).slice(0,2).map(([value])=>value).join(" and ")}. Prefers {mind.preferences.food==="bread"?"a little bread":"wheat"}.</p>{Object.values(mind.relationships).filter(relationship=>relationship.actorId!=="wren").map(relationship=><div className="cozy-memory" key={relationship.actorId}>{personName(state,relationship.actorId)}<small>{relationship.basis==="seeded"?"A first impression":"Built from shared moments"} · {relationship.trust>=75?"Trusted":relationship.trust>=50?"Getting acquainted":relationship.trust>=25?"Cautious":"Keeping a distance"}</small></div>)}</details>
  {mind.pastPlans.length>0&&<details className="cozy-notebook-fold"><summary>Earlier attempts</summary>{[...mind.pastPlans].reverse().slice(0,4).map(previous=><div className="cozy-memory" key={previous.id}>{previous.summary}<small>{personalStatusLabel(previous.status)}</small></div>)}</details>}
 </section>;
}

export default function ResidentPage({state,npc,onGift,onTalk,onShareIdea,onInspect,ideaDraft="",onIdeaDraft}:{state:CozyWorldState;npc:Npc;onGift:()=>void;onTalk:()=>void;onShareIdea?:(text:string)=>void;onInspect:()=>void;ideaDraft?:string;onIdeaDraft?:(text:string)=>void}){
 const [writing,setWriting]=useState(!!ideaDraft),personal=!!state.mind&&npc.id==="wren";
 const step=personal?state.mind?.plan?.steps[state.mind.plan.currentStep]:null;
 const activity=personal&&state.mind?.regulation?state.mind.regulation.need==="food"?"Looking after a hungry stomach":"Taking a needed rest":step?.status==="attempted"?personalStepLabel(state,step):taskLabel(state,npc);
 return <><header className="cozy-resident-heading"><ResidentPortrait id={npc.id} name={npc.name}/><div><span className="cozy-eyebrow">Your neighbor</span><h2>{npc.name}</h2><p className="cozy-resident-role">{npc.traits[0]}</p><small>{relationshipLabel(npc)}</small></div></header><p className="cozy-resident-doing">{activity}</p><ul className="cozy-needs" aria-label={`${npc.name}'s current needs`}>{needsSummary(npc).map(need=><li key={need}>{need}</li>)}</ul>
  <div className="cozy-resident-actions"><button className="cozy-action" onClick={onTalk}>Have a chat<span>→</span></button><button className="cozy-action secondary" onClick={onGift} disabled={state.player.inventory.grain<1}>Offer a little wheat</button></div>
  {personal&&onShareIdea&&<><button className="cozy-action secondary" aria-expanded={writing} onClick={()=>setWriting(value=>!value)}>Tell {npc.name} an idea<span>✧</span></button>{writing&&<form className="cozy-form cozy-idea-form" onSubmit={event=>{event.preventDefault();if(ideaDraft.trim().length>=3)onShareIdea(ideaDraft.trim());}}><label htmlFor="cozy-shared-idea">What might you like to see happen?</label><textarea id="cozy-shared-idea" maxLength={500} value={ideaDraft} onChange={event=>onIdeaDraft?.(event.target.value)} placeholder="An idea, a question, a possibility…"/><p className="cozy-muted">You will walk over and tell {npc.name} in person. {npc.name} can consider it, question it, or leave it alone. Sharing an idea does not add a new game mechanic.</p><button className="cozy-action" disabled={ideaDraft.trim().length<3}>Walk over &amp; share</button></form>}</>}
  {personal?<PersonalNotes state={state}/>:<ResidentSocialNotes state={state} npc={npc}/>}
  <details className="cozy-notebook-fold"><summary>A few things {npc.name} remembers</summary>{npc.memories.slice(-7).reverse().map(memory=><div className="cozy-memory" key={memory.id}>{memorySummary(state,memory)}</div>)}{!npc.memories.length&&<p>The day is still new.</p>}</details>
  <button className="cozy-inspect-link" onClick={onInspect}>Developer inspection</button>
 </>;
}
