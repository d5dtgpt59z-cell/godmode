local root='/Users/ryanmorrison/Documents/Codex/2026-10-25/visit-https-cerebralvalley-ai-e-meta/outputs/godmode/art/cozy/character-refinement/v2'
local R=dofile(root..'/refine-characters.lua');local s=Sprite(144,48,ColorMode.RGB);if s.cels[1]then s:deleteCel(s.cels[1])end
for fi=0,1 do
 if fi>0 then s:newEmptyFrame()end;local im=R.P.image(144,48)
 for i,v in ipairs(R.people)do im:drawImage(R.actor(v,'idle','s',fi),Point(5+(i-1)*34,8))end
 s:newCel(s.layers[1],fi+1,im,Point(0,0));s.frames[fi+1].duration=fi==0 and 2.2 or .14
end
local tag=s:newTag(1,2);tag.name='all-cast.idle.s';local atlas=Sprite{fromFile=root..'/characters-refined-v2.aseprite'};s:setPalette(atlas.palettes[1]);s:saveAs(root..'/all-cast-idle.aseprite')
local changed=0
for _,v in ipairs(R.people)do for _,face in ipairs({'s','n','e','w'})do
 local a,b=R.actor(v,'idle',face,0),R.actor(v,'idle',face,1)
 for y=0,31 do for x=0,23 do if a:getPixel(x,y)~=b:getPixel(x,y)then changed=changed+1;assert(y==8 or y==9,'Idle geometry moved: '..v.id..face..'/'..x..','..y)end end end
end end
R.P.json(root..'/idle-qa.json',{passed=true,changedPixels=changed,clipsChecked=16,bodyAndFeetUnchanged=true,onlyEyeRowsChanged={8,9},durationsMs={2200,140}})
print('Idle eye-only changes verified: '..changed..' differing pixels across16 clips; no body/foot hop.')
