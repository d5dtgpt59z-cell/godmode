/* Deterministic visualization of exported cozy-engine states, not a product UI capture.
 * Focus/hold camera principle adapted from installed ui-focus-zoom registry source.
 * Physical coordinates/resources are read-only. No render-only actor position offsets.
 */
window.createCozyFilm=function(id){
 const D=window.COZY_CAPTURE,A=window.COZY_ATLASES,W=1920,H=1080,canvas=document.getElementById('cozy-world'),ctx=canvas.getContext('2d'),world=document.createElement('canvas'),images={};world.width=512;world.height=384;const wc=world.getContext('2d');
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),mix=(a,b,t)=>a+(b-a)*t,ease=t=>t<.5?2*t*t:1-(-2*t+2)**2/2;
 const B=D.summary.beats,sourceEvents=window.COZY_EVENTS;
 function sprite(c,atlas,key,x,y){const f=A[atlas].frames[key];if(!f)return;const r=f.frame;c.imageSmoothingEnabled=false;c.drawImage(images[atlas],r.x,r.y,r.w,r.h,Math.round(x-f.pixelAnchor.x),Math.round(y-f.pixelAnchor.y),r.w,r.h)}
 function sampled(list,step){let lo=0,hi=list.length-1;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(list[m].step<=step)lo=m;else hi=m-1}const a=list[lo],b=list[Math.min(lo+1,list.length-1)];return{a,b,t:a.step===b.step?0:clamp((step-a.step)/(b.step-a.step),0,1)}}
 function position(a,b,f){const points=[{x:a.x,y:a.y}];if(a.x!==b.x&&a.y!==b.y){const corner=(a.path||[]).find(p=>(p.x===a.x&&p.y===b.y)||(p.x===b.x&&p.y===a.y));if(corner)points.push(corner)}points.push({x:b.x,y:b.y});const lens=points.slice(1).map((p,i)=>Math.abs(p.x-points[i].x)+Math.abs(p.y-points[i].y)),total=lens.reduce((a,b)=>a+b,0);if(!total)return{x:a.x,y:a.y,face:'s',moving:false};let d=f*total;for(let i=0;i<lens.length;i++){if(d<=lens[i]||i===lens.length-1){const p=points[i],q=points[i+1],t=lens[i]?d/lens[i]:0;return{x:mix(p.x,q.x,t),y:mix(p.y,q.y,t),face:q.x===p.x?q.y>p.y?'s':'n':q.x>p.x?'e':'w',moving:true}}d-=lens[i]}return{x:b.x,y:b.y,face:'s',moving:false}}
 function frame(person,action,face,time){const a=A.characters.animations[person+'.'+action+'.'+face]||A.characters.animations[person+'.idle.s'];const ds=a.durations||a.frames.map(()=>a.duration);let t=(time*1000)%ds.reduce((a,b)=>a+b,0);for(let i=0;i<ds.length;i++){if(t<ds[i])return a.frames[i];t-=ds[i]}return a.frames[0]}
 const shots=[
  {at:0,end:5,a:0,b:35,c:{x:256,y:192,z:3}},
  {at:5,end:10,hold:'mara-response',c:{x:110,y:150,z:4.8}},
  {at:10,end:15,a:B['mara-response'].step,b:B.planted.step,c:{x:195,y:138,z:5.7},land:'planted'},
  {at:15,end:19.8,a:B.watered.step,b:B.ripe.step-1,c:{x:195,y:138,z:5.7}},
  {at:19.8,end:21,hold:'ripe',c:{x:195,y:138,z:5.7}},
  {at:21,end:26,hold:'harvested',c:{x:195,y:138,z:5.7}},
  {at:26,end:31,hold:'ada-response',c:{x:352,y:128,z:4.8}},
  {at:31,end:36,hold:'wren-response',c:{x:170,y:245,z:4.8}},
  {at:36,end:43,hold:'rule-applied',c:{x:256,y:205,z:3}},
  {at:43,end:48,a:B['rule-applied'].step,b:Math.min(D.summary.setup.step,D.summary.food.step)-8,c:{x:270,y:210,z:3.5}},
  {at:48,end:53,a:Math.min(D.summary.setup.step,D.summary.food.step)-8,b:Math.max(D.summary.setup.step,D.summary.food.step)+8,c:{x:220,y:240,z:4.3}},
  {at:53,end:58,a:Math.max(D.summary.setup.step,D.summary.food.step)+8,b:B['festival-complete'].step,c:{x:220,y:245,z:4.5}},
  {at:58,end:67,a:B['before-rule'].step,b:D.summary.primary.step,c:{x:232,y:268,z:3}},
  {at:67,end:72,a:B['festival-complete'].step,b:D.summary.primary.step,c:{x:248,y:220,z:3.2}},
 ];
 function drawState(list,step,time,camera,region,held){const pair=held?{a:B[held].state,b:B[held].state,t:0}:sampled(list,step),s=pair.a;wc.clearRect(0,0,512,384);wc.drawImage(images.map,0,0);
  for(const p of s.plots){const meta=A.map.plots.find(q=>q.id===p.id);if(p.phase==='growing')sprite(wc,'foreground','soil.wet',meta.visualAnchor.x,meta.visualAnchor.y);sprite(wc,'foreground','crop.'+p.phase,meta.visualAnchor.x,meta.visualAnchor.y)}
  const venue=A.map.places.find(p=>p.id===s.festival.venue),table=A.map.festivalVisualAnchors?.[s.festival.venue]||{x:venue.position.x*16+8,y:venue.position.y*16+12};
  const owner=[s.player,...s.npcs].find(a=>a.id===s.festival.setupOwner),workingAtTable=owner?.task?.phase==='work'&&!owner.path.length&&Math.abs(owner.x-venue.position.x)+Math.abs(owner.y-venue.position.y)<=1.25,ready=s.festival.setupDone&&(s.festival.food>=s.rules.foodTarget||['celebrating','complete'].includes(s.festival.phase));if(workingAtTable||s.festival.setupDone){sprite(wc,'foreground',ready?'festival.ready':'festival.empty',table.x,table.y);if(s.festival.setupDone)sprite(wc,'foreground','bunting',table.x,table.y-12)}
  const actors=[s.player,...s.npcs],next=[pair.b.player,...pair.b.npcs];
  const paints=[];for(let i=0;i<actors.length;i++){const a=actors[i],b=next[i],at=position(a,b,pair.t),goods=Object.entries(a.inventory).find(([_,n])=>n>0)?.[0],speaking=sourceEvents.some(e=>e.type==='npc_dialogue'&&e.actorId===a.id&&e.step===s.step),work=a.task&&a.task.phase==='work'&&!a.path.length,action=at.moving?goods?'carry':'walk':work?'work':speaking?'talk':a.action.toLowerCase().includes('rest')?'rest':'idle';const x=at.x*16+8,y=at.y*16+12;paints.push({y,paint:()=>{sprite(wc,'characters',frame(a.id,action,at.face,time),x,y);if(action==='carry'&&goods)sprite(wc,'foreground','carry.'+goods,x,y-6)}})}
  paints.sort((a,b)=>a.y-b.y);for(const p of paints)p.paint();
  if(time>=15&&time<16.1)sprite(wc,'foreground','fx.water.'+Math.floor(((time-15)/.13)%4),A.map.plots[0].visualAnchor.x,A.map.plots[0].visualAnchor.y);
  if(time>=21&&time<22.1)sprite(wc,'foreground','fx.harvest.'+Math.floor(((time-21)/.13)%4),A.map.plots[0].visualAnchor.x,A.map.plots[0].visualAnchor.y);
  const r=region||{x:0,y:0,w:W,h:H},sw=r.w/camera.z,sh=r.h/camera.z;ctx.save();ctx.beginPath();ctx.rect(r.x,r.y,r.w,r.h);ctx.clip();ctx.fillStyle='#193d32';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.imageSmoothingEnabled=false;ctx.drawImage(world,Math.round(camera.x-sw/2),Math.round(camera.y-sh/2),sw,sh,r.x,r.y,r.w,r.h);ctx.restore();return s;
 }
 function render(time){const sh=shots.find(s=>time>=s.at&&time<s.end)||shots.at(-1),i=shots.indexOf(sh),t=clamp((time-sh.at)/(sh.end-sh.at),0,1);let camera=sh.c;if(i&&time-sh.at<.7&&time<58){const p=shots[i-1].c,k=ease(clamp((time-sh.at)/.7,0,1));camera={x:mix(p.x,sh.c.x,k),y:mix(p.y,sh.c.y,k),z:mix(p.z,sh.c.z,k)}}let step=sh.hold?B[sh.hold].step:mix(sh.a,sh.b,t);if(sh.land&&t>.35)step=B[sh.land].step;if(time>=58&&time<67)step=mix(B['before-rule'].step,D.summary.primary.step,clamp((time-58)/5,0,1));ctx.fillStyle='#193d32';ctx.fillRect(0,0,W,H);let state;
  if(time>=58&&time<67){state=drawState(D.branchSnapshots,step,time,sh.c,{x:0,y:0,w:960,h:H});const right=drawState(D.primarySnapshots,step,time,sh.c,{x:960,y:0,w:960,h:H});const phase={planning:'Still planning',gathering:'Gathering',celebrating:'Celebrating',complete:'Festival complete'};document.getElementById('phase-left').textContent=phase[state.festival.phase];document.getElementById('phase-right').textContent=phase[right.festival.phase];document.getElementById('outcome-right').textContent=right.festival.phase==='complete'?'3 arrivals · 3 grain shared · 1 timber used':'Arrivals: '+right.festival.participants.length+' · setup '+(right.festival.setupDone?'complete':'in progress');ctx.fillStyle='#f3e3b9';ctx.fillRect(957,0,6,H)}else state=drawState(D.primarySnapshots,step,time,camera,undefined,sh.hold||(sh.land&&t>.35?sh.land:undefined));
  document.getElementById('sim-step').textContent='Recorded step '+Math.floor(step)+' · '+(step*.1).toFixed(1)+'s simulated';
 }
 const ready=Promise.all(['map','characters','foreground'].map(name=>new Promise((resolve,reject)=>{const image=new Image;image.onload=()=>{images[name]=image;resolve()};image.onerror=reject;image.src='assets/'+name+'.png'}))).then(()=>document.fonts.ready).then(()=>{const tl=gsap.timeline({paused:true}),driver={time:0};tl.to(driver,{time:72,duration:72,ease:'none',onUpdate:()=>render(driver.time)},0);for(const [sel,start]of [['#mara-receipt .paper',5],['#plant-caption .caption',10],['#water-caption .caption',15],['#harvest-caption .caption',21],['#ada-receipt .paper',26],['#wren-receipt .paper',31],['#rule-receipt .paper',36],['#bid-caption .caption',43],['#work-caption .caption',48],['#festival-caption .caption',53],['#comparison-caption .caption',58],['#end-caption .caption',67]])tl.fromTo(sel,{y:24,opacity:0},{y:0,opacity:1,duration:.35,ease:'power2.out'},start);window.addEventListener('hf-seek',e=>render(e.detail.time));render(0);window.__timelines=window.__timelines||{};window.__timelines[id]=tl});window.__hf=window.__hf||{};window.__hf.buildReady=window.__hf.buildReady||{};window.__hf.buildReady[id]=ready;
};
