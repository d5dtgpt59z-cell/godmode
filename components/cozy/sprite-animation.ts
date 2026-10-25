export type SpriteClip={frames:string[];duration:number;durations?:number[]};

/** Preserve authored pose holds, including a brief blink after a long open-eye idle. */
export function sampleSpriteFrame(clip:SpriteClip|undefined,elapsedMs:number):string|undefined{
 if(!clip?.frames.length)return undefined;
 const fallback=Number.isFinite(clip.duration)&&clip.duration>0?clip.duration:150;
 const durations=clip.frames.map((_,i)=>{const value=clip.durations?.[i];return value&&Number.isFinite(value)&&value>0?value:fallback;});
 let elapsed=Math.max(0,Number.isFinite(elapsedMs)?elapsedMs:0)%durations.reduce((sum,duration)=>sum+duration,0);
 for(let i=0;i<durations.length;i++){if(elapsed<durations[i])return clip.frames[i];elapsed-=durations[i];}
 return clip.frames[0];
}
