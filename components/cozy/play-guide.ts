import type {CozyWorldState} from "@/lib/cozy/contracts";
export type PlayHint={text:string;action:"plant"|"water"|"harvest"|"gift"|"well"|"neighbors"|"direct"|"activity"|"mind"};
/** Advice reads the current world; it never fabricates progress or starts an action. */
export function nextPlayHint(state:CozyWorldState):PlayHint{
 const active=state.activities?.programs.some(program=>["proposed","inviting","meeting","running"].includes(program.status));
 if(active)return{text:"An invitation is unfolding. Open the journal to see their choices.",action:"activity"};
 if(state.player.harvests<1){
  if(state.plots.some(plot=>plot.phase==="ripe"))return{text:"Golden wheat is ready. Choose Harvest, then click the crop.",action:"harvest"};
  if(state.plots.some(plot=>plot.phase==="planted"))return state.player.inventory.water>0?{text:"Give the planted wheat a drink. Choose Water, then click it.",action:"water"}:{text:"Your can is empty. Collect water at the well.",action:"well"};
  if(state.plots.some(plot=>plot.phase==="growing"))return{text:"The wheat is growing. Meet a neighbor while you wait.",action:"neighbors"};
  if(state.plots.some(plot=>plot.phase==="empty")&&state.player.inventory.grain>0)return{text:"Try one seed. Choose Plant, then click an empty garden bed.",action:"plant"};
 }
 if(state.player.harvests>0&&state.player.gifts===0&&state.player.inventory.grain>0)return{text:"Offer a little wheat to a neighbor. Their answer is their own.",action:"gift"};
 if(state.mind?.plan&&["proposed","attempted","suspended","blocked"].includes(state.mind.plan.status))return{text:`See what ${state.npcs.find(npc=>npc.id==="wren")?.name??"your neighbor"} is trying, and what gets in the way.`,action:"mind"};
 return state.engineVersion==="cozy-engine-3"?{text:"Try a what-if: Town rules → Direct changes. No Muse needed.",action:"direct"}:{text:"Meet a neighbor, or try an exact change in Town rules.",action:"direct"};
}
