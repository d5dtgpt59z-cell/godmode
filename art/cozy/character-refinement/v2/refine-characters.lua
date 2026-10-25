-- Original character-only native authoring. Does not execute the old combined builder.
local ROOT='/Users/ryanmorrison/Documents/Codex/2026-10-25/visit-https-cerebralvalley-ai-e-meta/outputs/godmode/art/cozy'
local OUT=ROOT..'/character-refinement/v2';local P=dofile(ROOT..'/pixel-core.lua')
local function rgb(h)return app.pixelColor.rgba(tonumber(h:sub(1,2),16),tonumber(h:sub(3,4),16),tonumber(h:sub(5,6),16),255)end
local C={ink=rgb('303b38'),cream=rgb('fff0ce'),white=rgb('fff8e5'),gold=rgb('e9bd66'),steel=rgb('91aba5'),leather=rgb('563f34'),leatherhi=rgb('a67a50')}
local people={
 {id='player',name='You',skin={'a97555','dca57a','f6d4a2','e1a087'},hair={'47382e','795332','ba8854'},cloth={'294c57','4d8590','8fc4c4'},pants={'777966','b2b09a'},accent='e4bd70',eye='495e4b',kind='jacket'},
 {id='ada',name='Ada',skin={'b07959','e3ae85','ffe0b2','e9a795'},hair={'623c2e','a85d3c','e39b62'},cloth={'405b6a','678c9c','a3bdc3'},pants={'495c70','7d96a5'},accent='ebd7af',eye='685d3e',kind='apron'},
 {id='mara',name='Mara',skin={'a97866','dba992','f4cfb0','dc9e92'},hair={'666a70','b2bcb7','f2ead2'},cloth={'3c5a4d','7e9f79','b8c79c'},pants={'69444f','b3757d'},accent='d4b375',eye='5c655b',kind='skirt'},
 {id='wren',name='Wren',skin={'724a37','ad7851','dca576','bd7e65'},hair={'303331','4e483b','88704e'},cloth={'805e37','c09758','f0d08a'},pants={'345b5d','669392'},accent='b85f57',eye='493f37',kind='satchel'},
}
for _,v in ipairs(people)do for _,k in ipairs({'skin','hair','cloth','pants'})do for i,h in ipairs(v[k])do v[k][i]=rgb(h)end end;v.accent=rgb(v.accent);v.eye=rgb(v.eye)end
local function spans(im,rows,c,dy)for _,r in ipairs(rows)do P.line(im,r[2],r[1]+(dy or 0),r[3],r[1]+(dy or 0),c)end end
local function softHand(im,x,y,v)P.line(im,x,y,x+1,y,v.skin[2]);P.line(im,x-1,y+1,x+1,y+1,v.skin[2]);P.p(im,x,y+2,v.skin[1]);P.p(im,x-1,y+1,v.skin[3])end
local function boot(im,x,bottom,v,near)
 P.line(im,x,bottom-3,x+2,bottom-3,v.pants[near and 2 or 1]);P.line(im,x,bottom-2,x+2,bottom-2,C.leather)
 P.line(im,x-1,bottom-1,x+3,bottom-1,near and C.leatherhi or C.leather);P.line(im,x,bottom,x+3,bottom,C.leather);P.p(im,x-1,bottom-1,near and C.gold or C.leatherhi)
end
local function actor(v,action,face,f)
 local im=P.image(24,32);local moving=action=='walk'or action=='carry';local side=face=='e'or face=='w';local back=face=='n';local carry=action=='carry';local work=action=='work';local talk=action=='talk';local rest=action=='rest'
 local bob=moving and f%2 or 0;local swing=moving and ({-1,1,1,-1})[f+1]or 0;local skin,hair,cloth=v.skin,v.hair,v.cloth
 -- Rounded, directional legs. One boot remains planted at native y30 in every walk frame.
 local lx,rx,lb,rb=9,14,30,30
 if moving then
  if side then lx=({8,10,14,12})[f+1];rx=({14,12,9,11})[f+1];lb=({29,28,30,28})[f+1];rb=({30,30,29,30})[f+1]
  else lx=({9,10,9,10})[f+1];rx=({14,13,14,13})[f+1];lb=({30,30,29,28})[f+1];rb=({29,28,30,30})[f+1]end
 end
 P.poly(im,{{10,22},{12,22},{lx+2,lb-2},{lx,lb-2},{lx,26}},v.pants[1]);P.poly(im,{{13,22},{15,22},{rx+2,rb-2},{rx,rb-2},{rx,26}},v.pants[2]);P.line(im,lx,25,lx+1,lb-3,v.pants[2]);boot(im,lx,lb,v,false);boot(im,rx,rb,v,true)
 if v.kind=='apron'or v.kind=='skirt'then
  P.poly(im,{{9,20+bob},{16,20+bob},{18,25},{17,26},{7,26},{6,25}},v.pants[1]);P.poly(im,{{9,21+bob},{12,21+bob},{10,25},{7,25}},v.pants[2]);P.line(im,13,23,14,25,v.pants[2]);P.line(im,8,26,16,26,v.pants[1])
 end
 -- Sloped shoulder line, nipped waist, curved hem; silhouettes differ by costume.
 if side then P.poly(im,{{10,14+bob},{15,15+bob},{17,18+bob},{16,22+bob},{14,24},{9,23},{8,19+bob}},cloth[1]);P.poly(im,{{10,15+bob},{14,16+bob},{15,21+bob},{13,23},{9,22}},cloth[2]);P.line(im,10,16+bob,10,20+bob,cloth[3])
 else P.poly(im,{{10,14+bob},{14,14+bob},{17,16+bob},{18,19+bob},{16,22+bob},{14,24},{9,23},{7,21+bob},{6,18+bob},{8,15+bob}},cloth[1]);P.poly(im,{{9,15+bob},{13,15+bob},{15,18+bob},{15,22+bob},{11,23},{8,21+bob},{7,18+bob}},cloth[2]);P.line(im,8,17+bob,9,16+bob,cloth[3]);P.line(im,8,18+bob,8,20+bob,cloth[3]);P.p(im,9,22+bob,cloth[3])end
 P.line(im,11,14+bob,13,14+bob,skin[1]);P.line(im,11,15+bob,13,15+bob,C.cream)
 -- Sleeves taper through elbow clusters into small rounded palms, never box columns.
 local ly,ry=17+bob+(carry and 0 or swing),17+bob-(carry and 0 or swing)
 if side then P.poly(im,{{11,16+bob},{14,17+bob},{15,20+bob},{13,22+bob},{11,21+bob},{10,18+bob}},cloth[1]);P.line(im,11,17+bob,11,19+bob,cloth[3]);if not carry then softHand(im,13,22+bob-swing,v)end
 else
  P.poly(im,{{7,16+bob},{8,17+bob},{7,ly+4},{5,ly+5},{4,ly+3},{5,ly+1}},cloth[1]);P.line(im,5,ly+2,6,ly+1,cloth[3]);P.poly(im,{{17,16+bob},{18,17+bob},{20,ry+3},{19,ry+5},{17,ry+4},{16,ry+1}},cloth[1]);P.p(im,18,ry+1,cloth[2]);if not carry then softHand(im,5,ly+4,v);softHand(im,18,ry+4,v)end
 end
 -- Individual tailoring is visible as form, not palette swapping.
 if v.kind=='jacket'then
  if not back then P.line(im,10,16+bob,11,18+bob,C.cream);P.line(im,14,16+bob,13,18+bob,C.cream);P.line(im,12,18+bob,12,22+bob,cloth[1]);P.p(im,13,20+bob,C.gold);P.line(im,8,20+bob,10,20+bob,cloth[1]);P.p(im,8,19+bob,cloth[3])else P.line(im,9,17+bob,14,17+bob,cloth[3]);P.line(im,10,22+bob,14,23,cloth[1])end
 elseif v.kind=='apron'then
  if not back then P.poly(im,{{11,16+bob},{14,16+bob},{15,21},{17,24},{16,25},{8,25},{8,23},{10,20}},v.accent);P.line(im,11,17+bob,11,20,C.white);P.line(im,9,23,10,21,C.cream);P.line(im,10,24,15,24,C.cream);P.line(im,11,21,14,21,cloth[1]);P.line(im,11,22,14,22,C.cream)else P.line(im,9,16+bob,14,22,v.accent);P.line(im,15,16+bob,10,22,v.accent);P.ellipse(im,10,22,2,1,C.cream);P.ellipse(im,14,22,2,1,v.accent)end
  if not carry then P.line(im,4,ly+3,7,ly+3,C.cream);P.line(im,17,ry+3,20,ry+3,v.accent)end
 elseif v.kind=='skirt'then
  P.poly(im,{{9,15+bob},{11,16+bob},{12,19+bob},{13,16+bob},{15,15+bob},{14,18+bob},{12,21+bob},{10,19+bob}},v.accent);P.p(im,13,21,C.gold);P.line(im,8,24,10,24,v.pants[2]);P.line(im,14,24,16,25,v.pants[2])
 else
  P.line(im,8,15+bob,17,22,C.leather);P.line(im,9,15+bob,18,22,C.leatherhi);P.poly(im,{{17,20},{20,21},{21,24},{19,26},{16,25},{15,22}},C.leather);P.poly(im,{{17,21},{19,21},{20,24},{17,25},{16,23}},C.leatherhi);P.line(im,17,21,19,21,C.gold);P.p(im,18,23,C.gold);P.poly(im,{{9,14+bob},{15,14+bob},{16,16+bob},{13,17+bob},{10,16+bob}},v.accent);P.poly(im,{{15,15+bob},{17,16+bob},{18,20},{15,19}},v.accent);P.line(im,10,15+bob,13,16+bob,rgb('e3917d'))
 end
 -- A fuller upper hair mass and softly stepped cheeks produce a 3/4 top-down head.
 spans(im,{{2,10,14},{3,8,16},{4,7,17},{5,6,18},{6,6,18},{7,6,18},{8,6,18},{9,7,17},{10,7,17},{11,8,16},{12,9,15},{13,10,14}},hair[1],bob)
 spans(im,{{3,9,14},{4,8,16},{5,7,16},{6,7,15},{7,7,14},{8,8,14}},hair[2],bob);P.line(im,9,4+bob,12,3+bob,hair[3]);P.line(im,8,5+bob,10,5+bob,hair[3])
 if back then
  P.ellipse(im,12,8+bob,5,5,hair[2]);P.ellipse(im,10,6+bob,3,3,hair[3]);P.line(im,8,10+bob,10,12+bob,hair[1]);P.line(im,13,13+bob,16,10+bob,hair[1]);P.line(im,11,11+bob,14,10+bob,hair[2])
 elseif side then
  spans(im,{{6,13,16},{7,12,17},{8,12,18},{9,12,18},{10,12,18},{11,13,17},{12,14,17},{13,14,16}},skin[2],bob);P.line(im,13,7+bob,15,6+bob,skin[3]);P.line(im,13,8+bob,13,10+bob,skin[3]);P.p(im,19,9+bob,skin[2]);P.p(im,18,10+bob,skin[1]);P.p(im,17,11+bob,skin[4]);P.line(im,16,13+bob,17,12+bob,skin[1]);P.ellipse(im,11,10+bob,1,2,skin[1]);P.p(im,11,9+bob,skin[3])
  if rest or(action=='idle'and f==1)then P.line(im,16,9+bob,17,9+bob,v.eye)else P.p(im,16,8+bob,C.white);P.p(im,17,8+bob,v.eye);P.p(im,17,9+bob,v.eye)end
  P.poly(im,{{11,5+bob},{16,5+bob},{17,7+bob},{15,6+bob},{14,8+bob},{12,7+bob}},hair[2]);P.line(im,11,5+bob,13,4+bob,hair[3])
 else
  spans(im,{{6,10,15},{7,9,16},{8,8,16},{9,8,16},{10,8,16},{11,9,15},{12,10,14},{13,11,13}},skin[2],bob);P.line(im,9,7+bob,10,6+bob,skin[3]);P.line(im,8,8+bob,8,9+bob,skin[3]);P.line(im,11,12+bob,13,12+bob,skin[1]);P.p(im,12,11+bob,skin[3]);P.p(im,8,10+bob,skin[4]);P.p(im,16,10+bob,skin[4]);P.line(im,15,12+bob,16,11+bob,skin[1])
  if rest or(action=='idle'and f==1)then P.line(im,9,9+bob,10,9+bob,v.eye);P.line(im,14,9+bob,15,9+bob,v.eye)else for _,x in ipairs({9,14})do P.p(im,x,8+bob,C.white);P.p(im,x+1,8+bob,v.eye);P.p(im,x+1,9+bob,v.eye)end end
  P.poly(im,{{8,5+bob},{14,4+bob},{16,5+bob},{15,7+bob},{13,6+bob},{11,7+bob},{10,6+bob},{8,8+bob}},hair[2]);P.line(im,9,5+bob,12,4+bob,hair[3])
  if talk and f==1 then P.p(im,12,12+bob,v.eye);P.p(im,12,13+bob,skin[4])end
 end
 -- Four unmistakable silhouettes: soft cap, round bun, falling braid and springy curls.
 if v.id=='player'then
  P.poly(im,{{8,3+bob},{10,2+bob},{15,2+bob},{18,4+bob},{18,6+bob},{7,6+bob},{6,5+bob}},cloth[1]);P.poly(im,{{9,3+bob},{14,3+bob},{16,4+bob},{16,5+bob},{8,5+bob}},cloth[2]);P.line(im,9,3+bob,13,3+bob,cloth[3]);if not back then P.line(im,11,6+bob,20,6+bob,cloth[1]);P.line(im,12,5+bob,19,5+bob,cloth[2]);P.p(im,17,4+bob,C.gold)end
 elseif v.id=='ada'then
  P.ellipse(im,11,3+bob,3,2,hair[1]);P.ellipse(im,10,2+bob,2,1,hair[2]);P.line(im,9,2+bob,11,2+bob,hair[3]);P.p(im,14,5+bob,C.cream);P.line(im,7,8+bob,7,11+bob,hair[2]);P.p(im,8,12+bob,hair[3])
 elseif v.id=='mara'then
  for i=0,4 do local x=(back and 10 or 6)+i%2;local y=10+bob+i*2;P.ellipse(im,x,y,1,2,hair[1]);P.p(im,x,y-1,hair[3]);P.p(im,x+1,y,hair[2])end;P.line(im,7,19+bob,8,19+bob,v.accent);P.p(im,7,20+bob,hair[2]);P.line(im,8,4+bob,11,3+bob,hair[3]);P.p(im,15,4+bob,hair[3])
 else
  for _,p in ipairs({{8,4},{10,3},{13,3},{16,3},{18,5},{7,7}})do P.ellipse(im,p[1],p[2]+bob,2,2,hair[1]);P.line(im,p[1]-1,p[2]-1+bob,p[1],p[2]-1+bob,hair[2]);P.p(im,p[1]-1,p[2]-1+bob,hair[3])end
  if back then P.ellipse(im,16,9+bob,2,3,hair[1]);P.p(im,16,8+bob,hair[2])end
 end
 -- Stable cargo grip. Its advertised anchor never bobs with the head/torso.
 if carry then P.line(im,7,20,9,22,cloth[2]);P.line(im,17,20,15,22,cloth[1]);softHand(im,8,22,v);softHand(im,16,22,v)end
 if work then
  local lift=({0,-2,0,2})[f+1]
  if v.id=='player'then
   P.ellipse(im,13,23+lift,4,3,cloth[1]);P.ellipse(im,12,22+lift,3,2,cloth[2]);P.line(im,10,21+lift,12,20+lift,cloth[3]);P.line(im,16,22+lift,20,19+lift,C.steel);P.line(im,20,19+lift,22,19+lift,C.cream);P.line(im,7,20+lift,9,18+lift,C.steel);P.line(im,9,18+lift,11,19+lift,C.steel);softHand(im,9,21+lift,v)
  elseif v.id=='ada'then
   P.line(im,6,22+lift,19,22+lift,C.leather);P.line(im,8,21+lift,17,21+lift,C.gold);P.line(im,9,22+lift,17,22+lift,v.accent);softHand(im,7,20+lift,v);softHand(im,18,20+lift,v)
  elseif v.id=='mara'then
   P.line(im,8,23,15,25,C.leather);P.line(im,8,22,15,24,C.leatherhi);P.line(im,17,17+lift,18,24+lift,C.leatherhi);P.line(im,15,16+lift,20,16+lift,C.steel);P.p(im,15,15+lift,C.cream);softHand(im,17,20+lift,v)
  else
   P.poly(im,{{9,20+lift},{17,20+lift},{18,25+lift},{8,25+lift}},v.accent);P.poly(im,{{9,20+lift},{17,20+lift},{13,23+lift}},C.cream);P.line(im,9,24+lift,12,22+lift,C.leatherhi);P.line(im,14,23+lift,17,24+lift,C.leatherhi);softHand(im,7,22+lift,v);softHand(im,18,22+lift,v)
  end
 elseif talk and f==1 then P.line(im,17,19,20,16,cloth[2]);softHand(im,20,14,v)
 elseif rest then P.line(im,8,22,11,24,cloth[2]);P.line(im,17,22,14,24,cloth[1]);softHand(im,11,23,v);softHand(im,14,23,v);if f==1 then P.p(im,9,19,cloth[3])end end
 -- Mirror in native coordinates around the actual pivot x12, not the canvas midpoint11.5.
 if face=='w'then local flipped=P.image(24,32);for y=0,31 do for x=1,23 do flipped:drawPixel(24-x,y,im:getPixel(x,y))end end;im=flipped end
 return im
end

-- First proof: old south / new south / west / east / north / carry / role-specific work.
local old=Image{fromFile=ROOT..'/character-refinement/previous/characters.png'};local f=assert(io.open(ROOT..'/character-refinement/previous/characters.json'));local oldMeta=json.decode(f:read('*a'));f:close()
local proof=P.image(224,160)
for row,v in ipairs(people)do
 for col=0,6 do for y=0,39 do for x=0,31 do P.p(proof,col*32+x,(row-1)*40+y,((math.floor(x/4)+math.floor(y/4))%2==0)and rgb('324c46')or rgb('3b554c'))end end end
 local src=oldMeta.frames[v.id..'.idle.s.0'].frame;for y=0,31 do for x=0,23 do local c=old:getPixel(src.x+x,src.y+y);if app.pixelColor.rgbaA(c)>0 then proof:drawPixel(4+x,(row-1)*40+4+y,c)end end end
 local variants={{'idle','s',0},{'idle','w',0},{'idle','e',0},{'idle','n',0},{'carry','s',0},{'work','s',0}}
 for col,value in ipairs(variants)do proof:drawImage(actor(v,value[1],value[2],value[3]),Point(col*32+4,(row-1)*40+4))end
end
P.saveImage(proof,OUT..'/first-proof-native.png');P.saveSprite(proof,OUT..'/first-proof.aseprite','Old south | refined south west east north | carry | role work')
local spr=Sprite(224,160);spr.cels[1].image=proof;app.command.SpriteSize{ui=false,width=1344,height=960,method='nearest'};spr:saveAs(OUT..'/first-proof-6x.png')
print('First native character proof exported. Runtime assets untouched.')
return {actor=actor,people=people,P=P,OUT=OUT}
