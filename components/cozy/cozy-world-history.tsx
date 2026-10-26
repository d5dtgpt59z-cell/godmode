import type {CozyWorldState} from '@/lib/cozy/contracts';
import {observedEvidence,observedHistory} from './cozy-history';

export function WorldHistory({state,imported=false}:{state:CozyWorldState;imported?:boolean}){
 const moments=observedHistory(state,8,imported);
 return <details className="cozy-notebook-fold"><summary>Moments you noticed<span>{moments.length?'From your own observations':'The day is still beginning'}</span></summary>
  <p className="cozy-note-caption">Things you saw or heard. Your neighbors’ private thoughts stay in their own notebooks.</p>
  {imported&&<p className="cozy-note-caption">Imported recording. Its claimed model sources have not been independently verified.</p>}
  {!moments.length&&<p>Plant something, speak to a neighbor, or explore. Your own observations will collect here.</p>}
  <ol style={{listStyle:'none',padding:0}}>{moments.map(moment=>{
   const linked=observedEvidence(state,moment.id,imported);
   return <li key={moment.id} style={{padding:'14px 0',borderTop:'1px solid var(--cozy-line, #d2c19c)'}}>
    <span className="cozy-note-date">{moment.time}</span><h4 style={{margin:'6px 0'}}>{moment.title}</h4><p style={{whiteSpace:'pre-wrap',margin:'6px 0'}}>{moment.detail}</p>
    {(linked.moments.length>0||linked.unavailable)&&<details className="cozy-notebook-fold"><summary>Earlier moments linked to this</summary>
     {linked.moments.map(source=><div className="cozy-memory" key={source.id}>{source.title}<small>{source.detail}</small></div>)}
     {linked.unavailable&&<p className="cozy-note-caption">Some linked evidence is private or belongs to an earlier saved segment.</p>}
     <p className="cozy-note-caption">These links come from the saved event. Nearby events in time are not assumed to be its causes.</p>
    </details>}
    {moment.source!=='Recorded simulation'&&<span className="cozy-source-tag">{moment.source}</span>}
   </li>;
  })}</ol>
 </details>;
}
