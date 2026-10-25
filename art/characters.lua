local P=dofile('/Users/ryanmorrison/Documents/Codex/2026-10-25/visit-https-cerebralvalley-ai-e-meta/outputs/godmode/art/pixel-core.lua')
local residents={'iona','bram','leda','kitt','moss','ada','tomas','orin','june','nell','pip','sela','rook','mara','dara','vale','wren','ivo','elin','bo','fenn','joss','tavi','una'}
local roles={'granary keeper','porter','porter','porter','porter','baker','baker','timber worker','timber worker','builder','builder','well tender','innkeeper','market clerk','stallholder','stallholder','courier','bell keeper','supper cook','householder','householder','householder','householder','householder'}
local ramps={{48,49,50},{51,52,53},{54,55,56},{57,58,59},{60,61,62},{5,7,9},{20,21,22},{11,13,14}}
local actions={{'idle',2,650},{'walk',4,140},{'carry',4,160},{'talk',2,240},{'work',4,180},{'rest',2,850}}
local dirs={'s','w','e','n'}
local character=dofile(P.root..'/art/chibi-rig.lua')(P)
local a=P.atlas('characters',512,1664);a.metadata={cargoAnchor={x=8,y=18},style='anime-inspired chibi',nativeCell={w=16,h=24}}
local animationIndex={};local residentInfo={};local sample=P.image(24*22,4*34)
local base=Sprite(16,24,ColorMode.RGB);base.layers[1].name='Shared rig — Iona';if base.cels[1] then base:deleteCel(base.cels[1]) end
local master=Sprite(16,24,ColorMode.RGB);if master.cels[1] then master:deleteCel(master.cels[1]) end
local poseContact=P.image(18*20,4*30)
local baseFrame=0
for v,name in ipairs(residents) do
 local layer=v==1 and master.layers[1] or master:newLayer();layer.name=name;layer.isVisible=v==1;local poseIndex=0
 residentInfo[#residentInfo+1]={id=name,name=name:sub(1,1):upper()..name:sub(2),role=roles[v],variant=v,anchor={x=8,y=23},cargoAnchor={x=8,y=18}}
 for di,dir in ipairs(dirs) do
  for _,act in ipairs(actions) do
   local seq={}
   for f=0,act[2]-1 do
    local im=character(v,dir,act[1],f);local key=name..'.'..act[1]..'.'..dir..'.'..f;a:add(key,im,act[3],{x=8,y=23});seq[#seq+1]=key
    poseIndex=poseIndex+1;if v==1 and poseIndex>1 then master:newEmptyFrame() end;master.frames[poseIndex].duration=act[3]/1000;master:newCel(layer,poseIndex,im,Point(0,0))
    if v==1 then poseContact:drawImage(im,Point(((poseIndex-1)%18)*20+2,math.floor((poseIndex-1)/18)*30+3)) end
    if v==1 then baseFrame=baseFrame+1;if baseFrame>1 then base:newEmptyFrame() end;local fr=base.frames[baseFrame];fr.duration=act[3]/1000;base:newCel(base.layers[1],baseFrame,im,Point(0,0)) end
   end
   local anim=name..'.'..act[1]..'.'..dir;a.animations[anim]={frames=seq,duration=act[3],repeatCount=-1};animationIndex[anim]=seq
  end
  sample:drawImage(character(v,dir,'idle',0),Point((v-1)*22+3,(di-1)*34+5))
 end
end
-- Native timeline tags for the editable shared rig.
local cursor=1
for _,dir in ipairs(dirs) do for _,act in ipairs(actions) do local tag=base:newTag(cursor,cursor+act[2]-1);tag.name=act[1]..'.'..dir;tag.aniDir=AniDir.FORWARD;local mt=master:newTag(cursor,cursor+act[2]-1);mt.name=tag.name;mt.aniDir=AniDir.FORWARD;cursor=cursor+act[2] end end
base:saveAs(P.root..'/art/characters-base-rig.aseprite')
master:saveAs(P.root..'/art/characters-master.aseprite');P.saveImage(poseContact,P.root..'/public/assets/contact-poses.png')
a:save();P.saveImage(sample,P.root..'/public/assets/contact-characters.png');P.saveSprite(sample,P.root..'/art/contact-characters.aseprite','24 named variants x4 facings');P.json(P.root..'/public/assets/residents.json',residentInfo)
print('Shared rig '..#base.frames..' frames; 24 residents, 1728 packed poses.');
_G.GODMODE_CHARACTER=character
