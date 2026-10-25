"""Text/JSON packaging only. Raster work lives in native Aseprite Lua."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT.parent.parent / 'public/assets/cozy'
data = {name: json.loads((PUBLIC / (name + '.json')).read_text()) for name in ['characters', 'foreground', 'map']}
template = r'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GODMODE · cozy asset room</title>
<style>*{box-sizing:border-box}body{margin:0;background:#203a35;color:#f3e8c7;font:15px/1.5 ui-monospace,monospace}main{max-width:1120px;margin:auto;padding:26px}h1{font:500 38px Georgia,serif;letter-spacing:-1px;margin:4px 0 7px}p{max-width:840px;color:#c9d1b7}label{display:inline-block;margin:0 18px 12px 0}select{background:#e8ddba;color:#294238;border:0;border-radius:4px;padding:6px;font:inherit}canvas{image-rendering:pixelated;image-rendering:crisp-edges}#world{width:100%;height:auto;display:block;border:6px solid #52644e;border-radius:8px}#roster{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:22px 0}.resident{background:#2d4b43;border:1px solid #496357;border-radius:8px;text-align:center;padding:14px}.resident canvas{width:96px;height:128px;display:block;margin:auto}.resident b{display:block;font-size:16px}.small{font-size:12px;color:#acbea5}#states{width:100%;height:auto;max-width:960px;background:#29433d;border-radius:6px}.tag{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#d3bd7b}a{color:#edce88}details{margin:20px 0}summary{cursor:pointer}pre{white-space:pre-wrap;font-size:12px;color:#c4d3ba}footer{border-top:1px solid #4d6654;margin-top:24px;padding-top:12px;color:#c1cdb1}@media(max-width:600px){main{padding:12px}#roster{grid-template-columns:repeat(2,1fr)}h1{font-size:29px}label{font-size:12px}}</style>
<main><div class="tag">Original production assets · local inspection room</div><h1>A small village, a new beginning.</h1><p>Animation and semantic-state preview. This page stages art assets; it is not a recording of gameplay or AI behavior.</p>
<label>Movement <select id="action"><option>walk</option><option>idle</option><option>carry</option><option>work</option><option>talk</option><option>rest</option></select></label>
<label>Facing <select id="facing"><option value="s">South</option><option value="w">West</option><option value="e">East</option><option value="n">North</option></select></label>
<label>Crop <select id="crop"><option>empty</option><option>planted</option><option>growing</option><option>ripe</option></select></label>
<label>Festival <select id="festival"><option>none</option><option>empty</option><option>ready</option></select></label>
<label>Goods <select id="goods"><option>grain</option><option>water</option><option>timber</option><option>bread</option></select></label>
<label><input id="mask" type="checkbox"> Ground mask</label>
<canvas id="world" width="512" height="384" aria-label="Native pixel village asset staging"></canvas>
<div id="roster"></div><p class="small" id="stats"></p><h2>State pieces</h2><canvas id="states" width="512" height="96"></canvas>
<details><summary>Production contract and provenance</summary><pre id="contract"></pre></details>
<footer>Background: original owned concept → two built-in image edits → native 512×384 nearest-neighbor normalization → 255 actual opaque colors → authored cottage footpath. Residents and state pieces: original native Aseprite construction. No outside artwork was sampled. No paid provider or Meta inference was used for these assets. Legacy game artwork is preserved.</footer></main>
<script>const DATA=__DATA__;
const $=id=>document.getElementById(id),ctx=$('world').getContext('2d'),stateCtx=$('states').getContext('2d');ctx.imageSmoothingEnabled=false;stateCtx.imageSmoothingEnabled=false;
const ids=['player','ada','mara','wren'],names={player:'You',ada:'Ada · baker',mara:'Mara · planner',wren:'Wren · courier'},cards={};
for(const id of ids){const el=document.createElement('div');el.className='resident';const can=document.createElement('canvas');can.width=24;can.height=32;el.append(can);const b=document.createElement('b');b.textContent=names[id];el.append(b);$('roster').append(el);cards[id]=can.getContext('2d');cards[id].imageSmoothingEnabled=false;}
const images={};Promise.all(['map','characters','foreground'].map(name=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[name]=im;resolve()};im.onerror=reject;im.src=name+'.png'}))).then(()=>requestAnimationFrame(draw)).catch(()=>{$('stats').textContent='Images could not load. Keep this viewer beside the three PNG files.'});
function sprite(c,atlas,key,x,y){const f=DATA[atlas].frames[key];if(!f)return;const r=f.frame;c.drawImage(images[atlas],r.x,r.y,r.w,r.h,Math.round(x-f.pixelAnchor.x),Math.round(y-f.pixelAnchor.y),r.w,r.h)}
function selectedFrame(key,t){const a=DATA.characters.animations[key];const durations=a.durations||a.frames.map(()=>a.duration);const total=durations.reduce((a,b)=>a+b,0);let v=t%total;for(let i=0;i<durations.length;i++){if(v<durations[i])return a.frames[i];v-=durations[i]}return a.frames[0]}
function draw(t){ctx.clearRect(0,0,512,384);ctx.drawImage(images.map,0,0);const crop=$('crop').value;for(const p of DATA.map.plots)sprite(ctx,'foreground','crop.'+crop,p.visualAnchor.x,p.visualAnchor.y);
const festival=$('festival').value;if(festival!=='none'){sprite(ctx,'foreground','festival.'+festival,232,268);if(festival==='ready')sprite(ctx,'foreground','bunting',232,256)}
if($('mask').checked){for(let y=0;y<24;y++)for(let x=0;x<32;x++){if(DATA.map.walkableRows[y][x]==='.'){ctx.fillStyle='rgba(60,235,165,.25)';ctx.fillRect(x*16,y*16,16,16)}}}
const spots={player:[168,228],mara:[72,140],ada:[424,112],wren:[376,268]};
for(const id of ids){const action=$('action').value,face=$('facing').value,key=selectedFrame(id+'.'+action+'.'+face,t),c=cards[id];c.clearRect(0,0,24,32);sprite(c,'characters',key,12,31);sprite(ctx,'characters',key,...spots[id]);if(action==='carry'){sprite(c,'foreground','carry.'+$('goods').value,12,25);sprite(ctx,'foreground','carry.'+$('goods').value,spots[id][0],spots[id][1]-6)}}
stateCtx.clearRect(0,0,512,96);stateCtx.fillStyle='#d3dfbf';stateCtx.font='8px monospace';const keys=['crop.empty','crop.planted','crop.growing','crop.ripe','festival.empty','festival.ready','gift','carry.grain','carry.water','carry.timber','carry.bread'];let x=20;for(let i=0;i<keys.length;i++){const k=keys[i],r=DATA.foreground.frames[k].frame;const width=Math.max(28,r.w+12);if(x+width>512)break;sprite(stateCtx,'foreground',k,x+Math.floor(width/2),58);stateCtx.fillText(k.replace('festival.','').replace('crop.','').replace('carry.',''),x,80);x+=width}
requestAnimationFrame(draw)}
$('stats').textContent='512×384 native world · 16px tiles · 4 residents · 288 poses · 96 clips · 24 named state frames (21 unique source cells)';
$('contract').textContent=JSON.stringify({cell:DATA.characters.meta.cell,feet:DATA.characters.frames['player.idle.s.0'].pixelAnchor,normalizedFeet:DATA.characters.frames['player.idle.s.0'].anchor,cargo:DATA.characters.meta.cargoPixelAnchor,bridge:[DATA.map.riverX,DATA.map.bridgeY],plots:DATA.map.plots,provenance:{builtInImageEditCalls:2,earlierConceptCall:1,nativeCharacterGenerationCalls:0,nativeStateGenerationCalls:0,thirdPartyReferencePixelsImported:0}},null,2);
</script></html>'''
qa = json.loads((ROOT / 'native-qa.json').read_text())
template = template.replace('255 actual opaque colors', str(qa['map']['actualOpaqueColors'])+' actual opaque colors')
template = template.replace('__DATA__', json.dumps(data, separators=(',', ':')).replace('<', '\\u003c'))
(PUBLIC / 'viewer.html').write_text(template)
print('Wrote self-contained data viewer with local PNG references.')
