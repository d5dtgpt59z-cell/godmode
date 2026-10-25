-- CHARACTER-ONLY export. All writes stay in this versioned refinement folder.
local R=dofile('/Users/ryanmorrison/Documents/Codex/2026-10-25/visit-https-cerebralvalley-ai-e-meta/outputs/godmode/art/cozy/character-refinement/v3/cast-v3.lua')
local P,OUT,people=R.P,R.OUT,R.people
local actions={{name='idle',durations={2200,140}},{name='walk',durations={150,150,150,150}},{name='carry',durations={170,170,170,170}},{name='work',durations={180,150,180,250}},{name='talk',durations={380,160}},{name='rest',durations={1500,300}}}
local directions={'s','w','e','n'}
local atlas=P.image(512,576);local frames,animations={},{};local px,py,rowHeight=2,2,0;local count=0;local colors={};local report={passed=true,characters=4,poses=0,clips=0,cell={w=24,h=32},pixelAnchor={x=12,y=31},cargoPixelAnchor={x=12,y=24},bakedShadow=false,alphaValues={0,255},walkDistinctPoses={},frameBounds={},sourceMethod='Original native Aseprite pixel construction; zero provider calls'}
local master=Sprite(24,32,ColorMode.RGB);if master.cels[1]then master:deleteCel(master.cels[1])end
local walkSheet=P.image(384,128);local actionsSheet=P.image(144,128);local poses={}
local function audit(key,im)
 local visible=0;local sig={};local box={left=24,top=32,right=-1,bottom=-1}
 for y=0,31 do for x=0,23 do local c=im:getPixel(x,y);local a=app.pixelColor.rgbaA(c);assert(a==0 or a==255,key..' unwanted partial alpha');sig[#sig+1]=tostring(c);if a>0 then assert(x>0 and x<23 and y>0 and y<31,key..' clipped outer edge');visible=visible+1;colors[c]=true;box.left=math.min(box.left,x);box.right=math.max(box.right,x);box.top=math.min(box.top,y);box.bottom=math.max(box.bottom,y)end end end
 assert(visible>=180 and visible<=500,key..' implausible visible mass');assert(box.bottom==30,key..' foot baseline must be30 with transparent padding at31');report.frameBounds[key]={visiblePixels=visible,left=box.left,right=box.right,top=box.top,bottom=box.bottom};return table.concat(sig,',')
end
for vi,v in ipairs(people)do
 local layer=vi==1 and master.layers[1]or master:newLayer();layer.name=v.name..' — original refined pixels';layer.isVisible=vi==1;local timelineIndex=0
 for di,face in ipairs(directions)do for ai,a in ipairs(actions)do
  local seq={};local start=timelineIndex+1;local unique={}
  for fi,ms in ipairs(a.durations)do
   local i=fi-1;local im=R.actor(v,a.name,face,i);local key=v.id..'.'..a.name..'.'..face..'.'..i;local signature=audit(key,im);unique[signature]=true
   if px+24+2>512 then px=2;py=py+rowHeight+2;rowHeight=0 end;assert(py+32+2<=576,'Atlas overflow')
   atlas:drawImage(im,Point(px,py));frames[key]={frame={x=px,y=py,w=24,h=32},rotated=false,trimmed=false,spriteSourceSize={x=0,y=0,w=24,h=32},sourceSize={w=24,h=32},duration=ms,anchor={x=.5,y=31/32},pixelAnchor={x=12,y=31},cargoPixelAnchor={x=12,y=24}};seq[#seq+1]=key;px=px+26;rowHeight=math.max(rowHeight,32);count=count+1;poses[key]=im
   timelineIndex=timelineIndex+1;if vi==1 and timelineIndex>1 then master:newEmptyFrame()end;master.frames[timelineIndex].duration=ms/1000;master:newCel(layer,timelineIndex,im,Point(0,0))
   if a.name=='walk'then walkSheet:drawImage(im,Point((di-1)*96+i*24,(vi-1)*32))end
   if face=='s'and i==0 then actionsSheet:drawImage(im,Point((ai-1)*24,(vi-1)*32))end
  end
  local clip=v.id..'.'..a.name..'.'..face;animations[clip]={frames=seq,durations=a.durations,duration=a.durations[1],totalDurationMs=(function()local n=0;for _,ms in ipairs(a.durations)do n=n+ms end;return n end)(),repeatCount=-1}
  if a.name=='walk'then local n=0;for _ in pairs(unique)do n=n+1 end;assert(n==4,clip..' does not have four distinct poses');report.walkDistinctPoses[clip]=n end
  if vi==1 then local tag=master:newTag(start,timelineIndex);tag.name=a.name..'.'..face end
 end end
end
assert(count==288,'Incomplete pose set');local clips=0;for _ in pairs(animations)do clips=clips+1 end;assert(clips==96,'Incomplete clip set')
-- Verify exact key parity with the preserved shipped contract.
local f=assert(io.open(OUT..'/../v2/characters-refined-v2.json'));local old=json.decode(f:read('*a'));f:close();for key in pairs(old.frames)do assert(frames[key],'Missing original key '..key)end;for key in pairs(frames)do assert(old.frames[key],'Invented runtime key '..key)end
local palette={};for c in pairs(colors)do palette[#palette+1]=c end;table.sort(palette);assert(#palette<=128,'Uncontrolled palette growth');local pal=Palette(#palette);local hex={}
for i,c in ipairs(palette)do local r,g,b=app.pixelColor.rgbaR(c),app.pixelColor.rgbaG(c),app.pixelColor.rgbaB(c);pal:setColor(i-1,Color{r=r,g=g,b=b,a=255});hex[#hex+1]=string.format('%02x%02x%02x',r,g,b)end
local function saveSprite(im,path,name)local s=Sprite(im.width,im.height,ColorMode.RGB);s.cels[1].image=im;s.layers[1].name=name;s:setPalette(pal);s:saveAs(path);return s end
master:setPalette(pal);master:saveAs(OUT..'/characters-v3-timeline.aseprite');saveSprite(atlas,OUT..'/characters-v3.aseprite','Adult original cast — 288 native anchored poses');P.saveImage(atlas,OUT..'/characters-v3.png')
P.json(OUT..'/characters-v3.json',{frames=frames,animations=animations,meta={app='Original adult life-sim cast — native Aseprite',version='3',image='characters-v3.png',format='RGBA8888',size={w=512,h=576},scale='1',frameCount=count,animationCount=clips,cell={w=24,h=32},anchorUnits='normalized',pixelAnchorUnits='native pixels',characters={'player','ada','mara','wren'},pixelAnchor={x=12,y=31},cargoPixelAnchor={x=12,y=24},cargoAnchor={x=.5,y=24/32},groundShadowBaked=false,headTopRange={min=1,max=4},bodyBaseline=30,idleOpenMs=2200,idleBlinkMs=140,idleBobPixels=0,westMirrorAxisNativeX=12,palette=hex,lighting='warm upper-left, cool underside',workProps={player='small watering can',ada='rolling pin',mara='timber and mallet',wren='folded note'},provenance='Original native pixel construction. No generated or imported character pixels, no paid calls.'}})
P.saveImage(walkSheet,OUT..'/walk-contact-native.png');saveSprite(walkSheet,OUT..'/walk-contact.aseprite','South west east north walks — 4 frames each')
P.saveImage(actionsSheet,OUT..'/actions-contact-native.png');saveSprite(actionsSheet,OUT..'/actions-contact.aseprite','Idle walk carry work talk rest — new south poses')
local function scale(im,n,path)local s=Sprite(im.width,im.height,ColorMode.RGB);s.cels[1].image=im;app.command.SpriteSize{ui=false,width=im.width*n,height=im.height*n,method='nearest'};s:saveAs(path)end
scale(walkSheet,4,OUT..'/walk-contact-4x.png');scale(actionsSheet,5,OUT..'/actions-contact-5x.png')
-- A new-only presentation lineup has no old sheets, labels, map or environment edits.
local lineup=P.image(160,56);P.rect(lineup,0,0,160,56,app.pixelColor.rgba(244,231,205,255));for i,v in ipairs(people)do lineup:drawImage(poses[v.id..'.idle.s.0'],Point(8+(i-1)*38,12))end;P.saveImage(lineup,OUT..'/new-cast-lineup-native.png');scale(lineup,6,OUT..'/new-cast-lineup-6x.png');saveSprite(lineup,OUT..'/new-cast-lineup.aseprite','Original adult cast on warm neutral')
-- Four-character real animated walk preview, source timing150ms per frame.
local anim=Sprite(144,48,ColorMode.RGB);if anim.cels[1]then anim:deleteCel(anim.cels[1])end;anim.layers[1].name='South walking — all four original residents'
for fi=0,3 do if fi>0 then anim:newEmptyFrame()end;local im=P.image(144,48);for i,v in ipairs(people)do im:drawImage(poses[v.id..'.walk.s.'..fi],Point(5+(i-1)*34,8))end;anim:newCel(anim.layers[1],fi+1,im,Point(0,0));anim.frames[fi+1].duration=.15 end;local tag=anim:newTag(1,4);tag.name='all-cast.walk.s';anim:setPalette(pal);anim:saveAs(OUT..'/all-cast-walk.aseprite')
report.poses=count;report.clips=clips;report.actualOpaqueColors=#palette;report.idleDurationsMs={2200,140};report.idleOpenPercent=2200/2340*100;report.idleBobPixels=0;report.headTopMin=1;report.alphaPadding={left=1,right=1,top=1,bottom=1};report.exactOriginalKeysPreserved=true;report.versionedOutputsOnly=true;P.json(OUT..'/native-qa.json',report)
print(json.encode({passed=true,poses=count,clips=clips,colors=#palette,foot={12,31},cargo={12,24},runtimeReplaced=false}))
