-- Original native Aseprite production art. No imported character pixels.
local ROOT='/Users/ryanmorrison/Documents/Codex/2026-10-25/visit-https-cerebralvalley-ai-e-meta/outputs/godmode/art/cozy'
local P=dofile(ROOT..'/pixel-core.lua')
local function rgba(h,a)return app.pixelColor.rgba(tonumber(h:sub(1,2),16),tonumber(h:sub(3,4),16),tonumber(h:sub(5,6),16),a or 255)end
local C={ink=rgba('24302e'),shadow=rgba('172b2a',70),cream=rgba('fff0cc'),blush=rgba('d8897d'),gold=rgba('ebc36a'),white=rgba('fff5dd'),steel=rgba('8da9a7'),leaf=rgba('3d7150'),leafhi=rgba('91b86a')}
local people={
 {id='player',name='You',skin={'a96d4c','dfaa7c','f4cda0'},hair={'493626','785335','aa7850'},cloth={'234650','3f7180','72a5ac'},pants={'686653','a6a086'},accent='b58b42',kind='jacket'},
 {id='ada',name='Ada',skin={'a26446','d99a70','f3c296'},hair={'573024','8b4930','bf7547'},cloth={'34495a','526b7d','8c9aa4'},pants={'3f4552','7d7c85'},accent='e4d2a6',kind='apron'},
 {id='mara',name='Mara',skin={'9c6953','d1a187','f0c7a8'},hair={'595d61','a9aeaa','e6e1ca'},cloth={'334e3c','567b58','93ac76'},pants={'573b42','93636a'},accent='c6a65c',kind='skirt'},
 {id='wren',name='Wren',skin={'623b2b','a46c49','cc9462'},hair={'24272a','3d3d36','6b5c43'},cloth={'74502e','b58a4a','debd77'},pants={'304c51','5c7b79'},accent='a7504c',kind='satchel'},
}
for _,v in ipairs(people)do for _,k in ipairs({'skin','hair','cloth','pants'})do for i,h in ipairs(v[k])do v[k][i]=rgba(h)end end;v.accent=rgba(v.accent)end
local chars=P.atlas('characters',512,768);local samples={};local strips=P.image(384,128)
local function actor(v,action,face,f)
 local im=P.image(24,32);local moving=action=='walk' or action=='carry';local phase=moving and ({0,1,0,-1})[f+1] or 0;local bob=(moving and f%2==1) and 1 or ((action=='rest' or action=='idle') and f%2==1 and 1 or 0)
 local side=face=='e' or face=='w';local back=face=='n';local rest=action=='rest';local skin,hair,cloth=v.skin,v.hair,v.cloth
 local work=action=='work';local talk=action=='talk';local carry=action=='carry';local arm=(moving and ({-1,-1,1,1})[f+1]) or (talk and f==1 and -2 or 0)
 P.ellipse(im,12,30,6,1,C.shadow)
 -- Layered hair behind shoulders is part of each resident's silhouette.
 if v.id=='mara' then P.rect(im,6,7+bob,3,10,hair[1]);P.line(im,6,8+bob,6,15+bob,hair[3]) end
 if v.id=='ada' then P.ellipse(im,12,2+bob,3,2,hair[1]);P.line(im,10,1+bob,12,1+bob,hair[3]) end
 -- Legs and boots retain a fixed baseline through every frame.
 if side then
  P.rect(im,9+phase,21,4,9-math.abs(phase),v.pants[1]);P.rect(im,12-phase,21,4,9-math.abs(phase),v.pants[2]);P.line(im,12-phase,23,12-phase,28-math.abs(phase),v.pants[1]);P.rect(im,8+phase,29-math.abs(phase),6,2,hair[1]);P.rect(im,12-phase,29-math.abs(phase),6,2,hair[1]);P.line(im,13-phase,29-math.abs(phase),16-phase,29-math.abs(phase),hair[2])
 else
  P.rect(im,8,21,3,9-phase,v.pants[2]);P.rect(im,14,21,3,9+phase,v.pants[1]);P.line(im,8,22,8,28-phase,v.pants[1]);P.rect(im,7,29-phase,5,2,hair[1]);P.rect(im,13,29+phase,5,2,hair[1]);P.p(im,8,29-phase,hair[3]);P.p(im,14,29+phase,hair[2])
 end
 if v.kind=='skirt' or v.kind=='apron' then P.poly(im,{{8,20+bob},{16,20+bob},{18,27},{6,27}},v.pants[1]);P.line(im,8,21+bob,7,26,v.pants[2]);P.line(im,12,23,12,26,v.pants[2]) end
 -- Shoulders, seams, sleeves, neck; cool shadow against warmer key light.
 P.poly(im,{{9,12+bob},{15,12+bob},{18,16+bob},{17,23+bob},{7,23+bob},{6,16+bob}},C.ink)
 P.rect(im,8,13+bob,9,9,cloth[2]);P.rect(im,8,14+bob,3,7,cloth[3]);P.rect(im,16,15+bob,1,7,cloth[1]);P.p(im,9,16+bob,cloth[3]);P.line(im,13,20+bob,15,20+bob,cloth[1]);P.p(im,15,19+bob,cloth[3]);P.line(im,8,22+bob,16,22+bob,cloth[1]);P.rect(im,10,11+bob,4,3,skin[1]);P.line(im,10,12+bob,13,12+bob,skin[2])
 if side then
  P.rect(im,10,14+bob+arm,4,8,cloth[1]);P.line(im,10,14+bob+arm,10,19+bob+arm,cloth[3]);P.rect(im,10,21+bob+arm,3,3,skin[2]);P.p(im,10,21+bob+arm,skin[3])
 else
  P.rect(im,5,15+bob-arm,3,7,cloth[1]);P.line(im,5,15+bob-arm,5,19+bob-arm,cloth[3]);P.rect(im,17,15+bob+arm,3,7,cloth[1]);P.rect(im,5,21+bob-arm,3,3,skin[2]);P.rect(im,17,21+bob+arm,3,3,skin[1]);P.p(im,5,21+bob-arm,skin[3])
 end
 if v.kind=='jacket' then P.line(im,12,14+bob,12,22+bob,cloth[1]);P.p(im,13,16+bob,C.gold);P.p(im,13,19+bob,C.gold);P.rect(im,8,18+bob,3,3,cloth[1]);P.line(im,8,18+bob,10,18+bob,cloth[3])
 elseif v.kind=='apron' and not back then P.rect(im,10,14+bob,5,10,C.cream);P.rect(im,9,20+bob,7,5,v.accent);P.line(im,10,14+bob,10,22+bob,C.white);P.line(im,11,19+bob,14,19+bob,cloth[1]);P.rect(im,11,20+bob,3,2,rgba('b9b294'))
 elseif v.kind=='skirt' then P.line(im,12,14+bob,12,22+bob,cloth[1]);P.rect(im,9,13+bob,6,2,v.accent);P.p(im,12,17+bob,C.gold)
 elseif v.kind=='satchel' then P.line(im,8,13+bob,17,22+bob,hair[1]);P.line(im,9,13+bob,18,22+bob,v.accent);P.rect(im,15,20+bob,5,6,hair[1]);P.rect(im,16,20+bob,4,4,cloth[2]);P.line(im,16,21+bob,18,21+bob,C.gold) end
 -- Face: restrained anime eye highlights, nose, blush and independent hairstyle.
 P.ellipse(im,12,6+bob,5,6,C.ink);P.ellipse(im,12,6+bob,4,5,hair[1])
 if back then
  P.ellipse(im,12,6+bob,4,5,hair[2]);P.line(im,9,3+bob,11,2+bob,hair[3]);P.rect(im,8,7+bob,2,3,hair[1]);P.rect(im,15,7+bob,2,3,hair[1]);P.line(im,10,11+bob,14,11+bob,hair[1])
 elseif side then
  P.ellipse(im,13,7+bob,4,4,skin[2]);P.rect(im,9,2+bob,6,4,hair[2]);P.line(im,10,2+bob,13,2+bob,hair[3]);P.rect(im,8,5+bob,3,5,hair[1]);P.rect(im,16,7+bob,2,2,skin[2]);P.p(im,16,9+bob,skin[1]);if rest then P.line(im,14,7+bob,16,7+bob,C.ink)else P.rect(im,14,6+bob,2,2,C.ink);P.p(im,15,6+bob,C.white)end;P.p(im,15,9+bob,C.blush);P.p(im,16,10+bob,skin[1]);P.p(im,10,8+bob,skin[3])
 else
  P.ellipse(im,12,7+bob,4,4,skin[2]);P.line(im,9,5+bob,10,5+bob,skin[3]);P.rect(im,9,6+bob,2,2,C.ink);P.rect(im,14,6+bob,2,2,C.ink)
  if rest or(action=='idle' and f==1)then P.line(im,9,7+bob,10,7+bob,skin[1]);P.line(im,14,7+bob,15,7+bob,skin[1]);P.line(im,9,6+bob,10,6+bob,skin[2]);P.line(im,14,6+bob,15,6+bob,skin[2])else P.p(im,9,6+bob,C.white);P.p(im,14,6+bob,C.white)end
  P.p(im,8,9+bob,C.blush);P.p(im,16,9+bob,C.blush);P.p(im,12,9+bob,skin[3]);P.line(im,11,10+bob,13,10+bob,skin[1]);if talk and f==1 then P.p(im,12,10+bob,C.ink)end
  P.ellipse(im,12,2+bob,4,2,hair[2]);P.line(im,9,2+bob,12,1+bob,hair[3]);P.rect(im,8,3+bob,3,2,hair[1]);P.p(im,13,4+bob,hair[1])
 end
 if v.id=='player' then
  P.ellipse(im,12,2+bob,5,2,cloth[1]);P.line(im,8,1+bob,14,1+bob,cloth[3]);if not back then P.line(im,11,4+bob,18,4+bob,cloth[2]);P.p(im,17,3+bob,C.gold)end
 elseif v.id=='ada' then P.ellipse(im,12,1+bob,3,2,hair[2]);P.line(im,10,0+bob,12,0+bob,hair[3]);P.rect(im,16,5+bob,2,3,hair[2]);P.p(im,16,4+bob,C.cream)
 elseif v.id=='mara' then P.rect(im,6,7+bob,3,8,hair[2]);for y=8,14,2 do P.p(im,6,y+bob,hair[3]);P.p(im,8,y+1+bob,hair[1])end;P.p(im,7,15+bob,v.accent);P.line(im,9,3+bob,12,2+bob,hair[3])
 else for _,p in ipairs({{8,1},{11,0},{14,1},{16,2},{7,3},{16,4}})do P.rect(im,p[1],p[2]+bob,2,2,hair[1]);P.p(im,p[1],p[2]+bob,hair[2])end;P.line(im,9,12+bob,15,12+bob,v.accent);P.rect(im,15,13+bob,2,4,v.accent)end
 -- Actual goods are separate overlays at the shared cargo anchor.
 if carry then P.rect(im,7,20+bob,4,3,skin[2]);P.rect(im,14,20+bob,4,3,skin[2]);P.p(im,7,20+bob,skin[3]);P.p(im,14,20+bob,skin[3])end
 if work then
  local top=({15,14,17,18})[f+1];P.line(im,15,top,21,27,hair[1]);P.line(im,16,top,22,27,rgba('b28c56'));P.rect(im,19,25,4,3,C.steel);P.line(im,20,25,22,25,C.white);P.rect(im,14,top+2,3,3,skin[2]);P.p(im,14,top+2,skin[3])
 elseif talk and f==1 then P.line(im,17,18+bob,21,14+bob,cloth[2]);P.rect(im,20,12+bob,3,4,skin[2]);P.p(im,21,12+bob,skin[3])
 elseif rest then P.line(im,8,23+bob,15,23+bob,cloth[1]);P.rect(im,9,22+bob,6,2,skin[2])end
 if face=='w' then local flipped=P.image(24,32);for y=0,31 do for x=0,23 do flipped:drawPixel(23-x,y,im:getPixel(x,y))end end;im=flipped end
 return im
end
local actions={{'idle',2,650},{'walk',4,150},{'carry',4,170},{'work',4,210},{'talk',2,300},{'rest',2,800}}
local master=Sprite(24,32,ColorMode.RGB);if master.cels[1]then master:deleteCel(master.cels[1])end
local timeline=0
for vi,v in ipairs(people)do
 local layer=vi==1 and master.layers[1] or master:newLayer();layer.name=v.name;layer.isVisible=vi==1;local localFrame=0
 for _,face in ipairs({'s','w','e','n'})do for _,action in ipairs(actions)do
  local seq={};local start=localFrame+1
  for f=0,action[2]-1 do
   local im=actor(v,action[1],face,f);local k=v.id..'.'..action[1]..'.'..face..'.'..f;chars:add(k,im,action[3],{x=12,y=31});seq[#seq+1]=k;samples[k]=im;localFrame=localFrame+1
   if vi==1 and localFrame>1 then master:newEmptyFrame()end;master.frames[localFrame].duration=action[3]/1000;master:newCel(layer,localFrame,im,Point(0,0))
   if action[1]=='walk'then local fi=({s=0,w=1,e=2,n=3})[face];strips:drawImage(im,Point(fi*96+f*24,(vi-1)*32))end
  end
  chars.animations[v.id..'.'..action[1]..'.'..face]={frames=seq,duration=action[3],durations=(function()local d={}for _=1,action[2]do d[#d+1]=action[3]end;return d end)(),repeatCount=-1}
  if vi==1 then local tag=master:newTag(start,localFrame);tag.name=action[1]..'.'..face end
 end end
end
master:saveAs(ROOT..'/characters-timeline.aseprite');P.saveImage(strips,ROOT..'/walk-contact.png');P.saveSprite(strips,ROOT..'/walk-contact.aseprite','Four residents × south west east north × four walk frames')
chars.metadata={cell={w=24,h=32},characters={'player','ada','mara','wren'},cargoPixelAnchor={x=12,y=22},cargoAnchor={x=.5,y=22/32},status='Original native production sprite rig',artMethod='Original geometric pixel construction in Aseprite; no imported character pixels',frameCount=288,animationCount=96};chars:save()
-- Semantic state sprites use the same material ramps as the environment.
local fg=P.atlas('foreground',512,256);local function add(k,im,x,y,d)return fg:add(k,im,d or 220,{x=x or math.floor(im.width/2),y=y or im.height-1})end
local function wheat(stage)
 local im=P.image(24,32)
 if stage==0 then return im end
 if stage==1 then for _,p in ipairs({{5,27},{12,25},{19,27}})do P.ellipse(im,p[1],p[2],2,1,rgba('6e422a'));P.p(im,p[1],p[2]-1,C.gold);P.p(im,p[1]+1,p[2]-1,rgba('f4dda0'))end;return im end
 for _,p in ipairs({{4,3},{8,0},{12,2},{16,0},{20,3}})do
  local x=p[1];local y=stage==3 and 6+p[2]or 16+p[2];local stem=stage==3 and rgba('a47a34')or C.leaf
  P.line(im,x,29,x,y,stem);P.line(im,x,25,x-3,21,stage==3 and C.gold or C.leafhi);P.line(im,x,23,x+3,19,stage==3 and rgba('d5ac52')or rgba('639550'))
  if stage==3 then for yy=y+1,y+9,2 do P.line(im,x-2,yy,x,yy+1,C.gold);P.line(im,x,yy+1,x+2,yy,rgba('f6dfa0'));P.p(im,x-2,yy,rgba('c3943f'))end;P.p(im,x,y-1,rgba('fff0b5'))end
 end
 return im
end
for i,k in ipairs({'empty','planted','growing','ripe'})do add('crop.'..k,wheat(i-1),12,30)end
local wet=P.image(24,32);for y=22,29,3 do P.line(wet,2,y,21,y,rgba('302e24',145));P.line(wet,4,y+1,19,y+1,rgba('46504a',90))end;add('soil.wet',wet,12,30)
local function feast(ready)
 local im=P.image(64,40);P.ellipse(im,32,35,28,2,C.shadow);P.rect(im,8,21,4,15,rgba('533c2b'));P.rect(im,52,21,4,15,rgba('493327'));P.rect(im,3,13,58,16,rgba('503828'));P.rect(im,4,13,56,11,rgba('a87d4e'));P.line(im,5,13,59,13,rgba('e3bd80'));for y=17,23,4 do P.line(im,5,y,59,y,rgba('6c4b31'));P.line(im,6,y+1,58,y+1,rgba('c89b62'));for xx=8,54,11 do P.line(im,xx,y+2,xx+4,y+2,rgba('916741'));P.p(im,xx+2,y+1,rgba('d6ac70'))end end;P.rect(im,9,30,2,6,rgba('bd9561'));P.rect(im,53,29,2,6,rgba('ad8250'))
 if ready then
  P.rect(im,5,15,54,9,rgba('f0ddb2'));P.rect(im,8,24,48,6,rgba('cfc5a4'));P.line(im,8,25,55,25,rgba('fff0cc'));for xx=9,55,8 do P.line(im,xx,28,xx+2,29,rgba('aaa58d'))end;P.rect(im,30,14,5,16,rgba('3d7180'));P.line(im,33,15,33,29,rgba('315861'));P.line(im,31,15,31,29,rgba('8eb4b4'))
  for _,x in ipairs({14,33,51})do P.ellipse(im,x,20,7,2,rgba('a4b0a7'));P.ellipse(im,x,19,6,2,rgba('f9e9bd'));P.ellipse(im,x,18,4,2,rgba('ae7537'));P.line(im,x-2,17,x+2,17,C.gold);P.p(im,x-1,18,rgba('f2d28e'));P.p(im,x+2,18,rgba('f4d998'));P.p(im,x,19,rgba('b78340'))end
  P.rect(im,55,9,4,9,rgba('487e85'));P.line(im,55,9,57,9,rgba('a7cec1'));P.p(im,56,8,C.cream)
 end;return im
end
add('festival.empty',feast(false),32,36);add('festival.ready',feast(true),32,36)
local bunting=P.image(80,48);P.rect(bunting,2,6,2,41,rgba('745031'));P.rect(bunting,76,6,2,41,rgba('745031'));P.line(bunting,3,6,39,12,rgba('554b35'));P.line(bunting,39,12,77,6,rgba('554b35'));for i=0,6 do local x=7+i*10;local y=7+math.floor(math.sin(i/6*3.14)*4);P.poly(bunting,{{x,y},{x+7,y},{x+3,y+8}},({rgba('4d8e94'),rgba('e6bd6e'),rgba('bd7065')})[i%3+1]);P.line(bunting,x,y,x+6,y,rgba('f3dca4'))end;add('bunting',bunting,40,47);fg:alias('festival.bunting','bunting')
local function goods(kind)
 local im=P.image(12,12)
 if kind=='grain'then for _,x in ipairs({4,7,9})do P.line(im,x,11,x,3,rgba('9d6c31'));for y=2,6,2 do P.line(im,x-2,y,x,y+1,C.gold);P.line(im,x,y+1,x+1,y,rgba('f2dc9c'))end end;P.line(im,3,8,9,8,rgba('6e5941'))
 elseif kind=='water'then P.rect(im,3,4,7,7,rgba('344c50'));P.line(im,4,4,8,4,rgba('a1b8ae'));P.rect(im,4,5,5,5,rgba('3f7e8a'));P.line(im,4,5,7,5,rgba('9ac7c6'));P.line(im,3,3,4,1,rgba('8c9380'));P.line(im,4,1,8,1,rgba('b7b8a0'));P.line(im,8,1,9,3,rgba('8c9380'))
 elseif kind=='timber'then for _,p in ipairs({{1,7},{3,3},{5,8}})do P.rect(im,p[1],p[2],6,3,rgba('795033'));P.line(im,p[1],p[2],p[1]+5,p[2],rgba('bd8c52'));P.p(im,p[1]+5,p[2]+1,rgba('e6bd80'))end
 else P.ellipse(im,6,8,5,3,rgba('77502c'));P.ellipse(im,6,7,5,3,rgba('d9a653'));P.line(im,3,5,4,6,rgba('f8dba0'));P.line(im,6,4,7,6,rgba('f8dba0'));P.line(im,9,5,9,6,rgba('f8dba0'))end
 return im
end
for _,kind in ipairs({'grain','water','timber','bread'})do add('carry.'..kind,goods(kind),6,11)end
local gift=P.image(16,16);P.rect(gift,3,5,10,9,rgba('b46c59'));P.rect(gift,2,4,12,3,rgba('dba177'));P.rect(gift,7,4,2,10,C.gold);P.line(gift,3,4,12,4,rgba('f1c79c'));P.ellipse(gift,5,3,2,2,C.gold);P.ellipse(gift,10,3,2,2,C.gold);P.p(gift,7,3,C.cream);add('gift',gift,8,14)
for f=0,3 do
 local water=P.image(24,24);for _,p in ipairs({{5,3},{12,0},{19,4},{8,10},{17,12}})do local yy=(p[2]+f*4)%21;P.line(water,p[1],yy,p[1]-1,yy+3,rgba('96d1d2',210));P.p(water,p[1],yy,C.white)end;P.ellipse(water,12,21,4+f*2,1,rgba('6caeb5',180));add('fx.water.'..f,water,12,23,130)
 local harvest=P.image(24,24);for i=0,5 do local ang=i*math.pi/3;local x=12+math.floor(math.cos(ang)*(3+f*2));local y=13+math.floor(math.sin(ang)*(3+f*2))-f;P.line(harvest,x-1,y,x+1,y,C.gold);P.line(harvest,x,y-1,x,y+1,C.cream)end;add('fx.harvest.'..f,harvest,12,23,130)
end
for _,kind in ipairs({'water','harvest'})do local frames={}for f=0,3 do frames[#frames+1]='fx.'..kind..'.'..f end;fg.animations['fx.'..kind]={frames=frames,durations={130,130,130,130},duration=130,repeatCount=0};fg:alias('fx.'..kind,'fx.'..kind..'.0')end
fg.metadata={source='Original native Aseprite semantic state assets',crop='Wheat/grain only. Background has empty soil. No mature crop is baked into map.',festival='Distinct empty wooden table and ready food state',lighting='upper-left'};fg:save()
-- Rendered integration preview. Actor feet and crops use the exported map contract.
local scene=Image{fromFile=ROOT..'/../../public/assets/cozy/map.png'}
local function putAtlas(at,key,x,y)local fr=at.frames[key];local im=P.image(fr.frame.w,fr.frame.h);for yy=0,fr.frame.h-1 do for xx=0,fr.frame.w-1 do im:drawPixel(xx,yy,at.image:getPixel(fr.frame.x+xx,fr.frame.y+yy))end end;scene:drawImage(im,Point(x-fr.pixelAnchor.x,y-fr.pixelAnchor.y))end
putAtlas(fg,'crop.planted',192,124);putAtlas(fg,'crop.growing',216,124);putAtlas(fg,'crop.ripe',240,124)
putAtlas(fg,'festival.ready',232,268);putAtlas(fg,'bunting',232,256)
for _,v in ipairs({{'player',168,228},{'ada',424,116},{'mara',104,204},{'wren',376,268}})do putAtlas(chars,v[1]..'.walk.s.0',v[2],v[3])end
P.saveImage(scene,ROOT..'/integration-preview-native.png');P.saveSprite(scene,ROOT..'/integration-preview.aseprite','Asset staging preview, not a gameplay capture')
local preview=Sprite(512,384);preview.cels[1].image=scene;app.command.SpriteSize{ui=false,width=1536,height=1152,method='nearest'};preview:saveAs(ROOT..'/integration-preview-3x.png')
local s=Sprite(strips.width,strips.height);s.cels[1].image=strips;app.command.SpriteSize{ui=false,width=strips.width*3,height=strips.height*3,method='nearest'};s:saveAs(ROOT..'/walk-contact-3x.png')
print('Exported 4 residents, 288 anchored poses, 96 animation clips, 21 semantic source frames, integration preview.')
