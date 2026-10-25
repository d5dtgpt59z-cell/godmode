"use client";

import {useEffect,useId,useRef,useState} from "react";
import type {ActorId} from "../../lib/cozy/contracts";
import "./cozy-dialogue.css";

export type CozyDialogueProps={
 speakerId:ActorId;
 speakerName:string;
 /** Spoken text from the recorded dialogue event, rendered without rewriting. */
 text:string;
 onContinue:()=>void;
 /** Number of queued lines after this one. */
 remaining?:number;
 expression?:string;
};

function Portrait({speakerId,speakerName,expression}:{speakerId:ActorId;speakerName:string;expression:string}){
 const [attempt,setAttempt]=useState(expression==="neutral"?1:0);
 const initials=speakerName.trim().split(/\s+/).map(part=>part[0]).slice(0,2).join("");
 const source=`/assets/cozy/portraits/${speakerId}-${attempt===0?expression:"neutral"}.png?v=cast-4`;
 return <div className="cozy-speech-portrait" aria-hidden="true">
  {attempt<2
   // Native pixel portraits use nearest-neighbor scaling; no responsive image resampling.
   // eslint-disable-next-line @next/next/no-img-element
   ?<img src={source} alt="" draggable={false} onError={()=>setAttempt(value=>Math.min(2,value+1))}/>
   :<span className="cozy-speech-initials">{initials}</span>}
 </div>;
}

/** Presentation only. The parent owns the event queue and gates world input. */
export default function CozyDialogue({speakerId,speakerName,text,onContinue,remaining=0,expression="neutral"}:CozyDialogueProps){
 const id=useId(),continueButton=useRef<HTMLButtonElement>(null);
 const safeExpression=/^[a-z][a-z0-9-]{0,31}$/.test(expression)?expression:"neutral";
 const more=Number.isFinite(remaining)?Math.max(0,Math.floor(remaining)):0;
 useEffect(()=>{continueButton.current?.focus({preventScroll:true});},[speakerId,text]);

 return <section className="cozy-speech-box" role="dialog" aria-labelledby={`${id}-speaker`} aria-describedby={`${id}-text`} data-speaker={speakerId}>
  <div className="cozy-speech-person">
   <Portrait key={`${speakerId}:${safeExpression}`} speakerId={speakerId} speakerName={speakerName} expression={safeExpression}/>
   <h2 className="cozy-speech-name" id={`${id}-speaker`}>{speakerName}</h2>
  </div>
  <div className="cozy-speech-content">
   <div className="cozy-speech-scroll" tabIndex={0} aria-label="Spoken dialogue">
    <p className="cozy-speech-text" id={`${id}-text`} aria-live="polite" aria-atomic="true">{text}</p>
   </div>
   <div className="cozy-speech-footer">
    <span className="cozy-speech-hint"><span className="cozy-speech-key-hint">Enter / Space</span><span className="cozy-speech-touch-hint">Tap to continue</span>{more>0&&<span className="cozy-speech-remaining"> · {more} more</span>}</span>
    <button ref={continueButton} className="cozy-speech-continue" type="button" onClick={onContinue}>Continue <span aria-hidden="true">▸</span></button>
   </div>
  </div>
 </section>;
}
