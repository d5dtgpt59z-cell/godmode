local P=dofile('/Users/ryanmorrison/Documents/Codex/2026-10-25/visit-https-cerebralvalley-ai-e-meta/outputs/godmode/art/pixel-core.lua')
local function read(path) local f=assert(io.open(path,'r'));local s=f:read('*a');f:close();return json.decode(s) end
local report={status='passed',checks={},atlases={}}
local names={'characters','town','objects'}
for _,name in ipairs(names) do
 local data=read(P.root..'/public/assets/'..name..'.json');local im=Image{fromFile=P.root..'/public/assets/'..name..'.png'};assert(im.width==data.meta.size.w and im.height==data.meta.size.h,'PNG dimensions do not match atlas')
 local n=0;local unique={};local mixed=0;local empty=0;local footprints={}
 for k,item in pairs(data.frames) do
  n=n+1;local f=item.frame;assert(f.x>=0 and f.y>=0 and f.x+f.w<=im.width and f.y+f.h<=im.height,'Out of bounds '..k);assert(item.anchor.x>=0 and item.anchor.x<=1 and item.anchor.y>=0 and item.anchor.y<=1,'Invalid normalized Phaser pivot '..k);assert(item.pixelAnchor.x>=0 and item.pixelAnchor.x<=f.w and item.pixelAnchor.y>=0 and item.pixelAnchor.y<=f.h,'Invalid pixel anchor '..k);assert(item.duration>0,'Invalid duration '..k)
  local opaque=0;local transparent=0;local semi=0;local pixels={}
  for y=f.y,f.y+f.h-1 do for x=f.x,f.x+f.w-1 do local c=im:getPixel(x,y);local alpha=app.pixelColor.rgbaA(c);pixels[#pixels+1]=tostring(c);if alpha>0 then opaque=opaque+1 end;if alpha==0 then transparent=transparent+1 elseif alpha<255 then semi=semi+1;if name=='characters' then assert(alpha==70 and y-f.y>=21,'Unexpected translucent character pixel '..k) end end end end
  assert(opaque>0,'Blank frame '..k);if transparent>0 then mixed=mixed+1 end;unique[table.concat(pixels,',')]=true
  if name=='characters' then assert(f.w==16 and f.h==24,'Rig size drift');assert(item.pixelAnchor.x==8 and item.pixelAnchor.y==23,'Foot anchor drift');assert(item.anchor.x==8/16 and item.anchor.y==23/24,'Phaser pivot drift');assert(transparent>0,'Missing sprite transparency');footprints[k]=opaque end
 end
 local animationN=0
 for k,anim in pairs(data.animations) do animationN=animationN+1;assert(#anim.frames>0,'Empty animation '..k);for _,key in ipairs(anim.frames) do assert(data.frames[key],'Missing animation frame '..key) end end
 local uniqueN=0;for _ in pairs(unique) do uniqueN=uniqueN+1 end
 report.atlases[name]={namedFrames=n,sourceFrames=data.meta.frameCount,uniqueRasterFrames=uniqueN,width=im.width,height=im.height,animations=animationN,framesWithTransparency=mixed}
 if name=='characters' then
  local residents=read(P.root..'/public/assets/residents.json');assert(#residents==24,'Resident count')
  for _,resident in ipairs(residents) do for _,dir in ipairs({'s','w','e','n'}) do for _,act in ipairs({{'idle',2},{'walk',4},{'carry',4},{'talk',2},{'work',4},{'rest',2}}) do
   local signatures={};for f=0,act[2]-1 do local key=resident.id..'.'..act[1]..'.'..dir..'.'..f;assert(data.frames[key],'Missing named pose '..key);local r=data.frames[key].frame;local px={};for y=r.y,r.y+r.h-1 do for x=r.x,r.x+r.w-1 do px[#px+1]=tostring(im:getPixel(x,y)) end end;signatures[table.concat(px,',')]=true end
   local distinct=0;for _ in pairs(signatures) do distinct=distinct+1 end;assert(distinct>=2,'Static animation '..resident.id..'.'..act[1]..'.'..dir)
  end end end
  assert(n==1728,'Expected 1728 named poses');assert(animationN==576,'Expected 576 full action animations')
 end
end
report.checks={'All frame rectangles inside exported PNG dimensions','All frames contain visible pixels','All pixel anchors, normalized Phaser pivots and durations valid','All animation references resolve','24 residents x 4 facings x 6 actions covered','1728 character poses and 576 character animations','All character cells16x24 with anchor8,23','Every action/facing has at least two distinct raster poses','All translucent character pixels are alpha70 contact shadows at foot rows21-23'}
P.json(P.root..'/public/assets/validation.json',report);print(json.encode(report))
