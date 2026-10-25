"use client";

export function worldTime(tick:number):string {
  const hour=(12+Math.floor(tick/3600))%24;
  return `${hour%12||12}:${String(Math.floor(tick/60)%60).padStart(2,"0")} ${hour<12?"am":"pm"}`;
}

export default function WorldClock({tick,day,saved,playing,pace,speed,disabled,onToggle,onPace,onSpeed}:{
  tick:number;day:number;saved:boolean;playing:boolean;pace:number;speed:number;disabled:boolean;
  onToggle:()=>void;onPace:()=>void;onSpeed:()=>void;
}) {
  const hour=(12+Math.floor(tick/3600))%24;
  return <div className="time-controls">
    <button className="round-button play-button" disabled={disabled} onClick={onToggle} aria-label={playing?"Pause world":"Play world"} title={saved?"Changes the saved world’s actual clock":"Play this separate experiment"}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{playing?<><path d="M7 4v16M17 4v16"/></>:<path d="m7 4 13 8-13 8V4Z"/>}</svg>
    </button>
    <div className="clock"><strong>{worldTime(tick)}</strong><span>Day {day}{hour>=20||hour<6?" · Night":" · Bellwether"}</span></div>
    <button className="speed-button" disabled={disabled} onClick={saved?onPace:onSpeed}
      aria-label={saved?`World pace ${pace===1?"Normal, one simulated second per real second":"Slow, one simulated second per ten real seconds"}. Change pace.`:`Experiment playback speed ${speed} times. Change speed.`}
      title={saved?`${pace} simulated seconds per real second`:`${12*speed} simulated seconds per playback update`}>{saved?(pace===1?"Normal":"Slow"):`${speed}×`}</button>
  </div>;
}
