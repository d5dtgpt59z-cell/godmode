local P=dofile('/Users/ryanmorrison/Documents/Codex/2026-10-25/visit-https-cerebralvalley-ai-e-meta/outputs/godmode/art/pixel-core.lua')
local a=P.atlas('town',512,1024)
local images={}
local function add(key,im,anchor,duration) images[key]=im;a:add(key,im,duration or 200,anchor);return im end
local function alias(key,other) images[key]=images[other];a:alias(key,other) end
local function ground(kind,v)
 local im=P.image(16,16)
 if kind=='grass' then
  P.noise(im,0,0,16,16,21,20,22,v+1,18)
  for n=1,5 do local x=(n*7+v*3)%15;local y=(n*11+v*5)%15;P.p(im,x,y,20);P.p(im,x+1,y-1,22);P.p(im,x+2,y,21) end
 elseif kind=='path' then
  P.noise(im,0,0,16,16,16,15,17,v+30,32)
  P.line(im,3+v,5,5+v,5,18);P.line(im,10,12-v,12,12-v,15);P.p(im,2,13,17)
 elseif kind=='stone' then
  P.rect(im,0,0,16,16,3)
  for y=0,15,5 do for x=-4,15,8 do local xx=x+(math.floor(y/5)%2)*4;P.rect(im,xx,y,7,4,5);P.line(im,xx+1,y,xx+6,y,6);P.p(im,xx+1,y+2,4) end end
 elseif kind=='water' then
  P.rect(im,0,0,16,16,29)
  for n=0,4 do local x=(n*7+v*2)%15;local y=(n*5+v)%16;P.line(im,x,y,math.min(15,x+3),y,30);P.p(im,(x+2)%16,(y+1)%16,28) end
  P.line(im,3+v*2,10,7+v*2,10,31);P.p(im,13,3+v,30)
 end
 return im
end
for i=0,2 do add('terrain.grass.'..i,ground('grass',i),{x=0,y=0});add('terrain.path.'..i,ground('path',i),{x=0,y=0}) end
add('terrain.stone.0',ground('stone',0),{x=0,y=0})
local waterSeq={};for i=0,3 do local key='terrain.water.'..i;add(key,ground('water',i),{x=0,y=0},420);waterSeq[#waterSeq+1]=key end
a.animations['terrain.water']={frames=waterSeq,duration=420,repeatCount=-1}
for _,d in ipairs({'n','e','s','w','ne','nw','se','sw'}) do
 local im=ground('grass',1)
 for y=0,15 do for x=0,15 do
  local water=(d:find('n') and y<5+math.floor(math.sin(x*0.6)*1.2)) or (d:find('s') and y>10+math.floor(math.sin(x*0.6)*1.2)) or (d:find('w') and x<5+math.floor(math.sin(y*0.6)*1.2)) or (d:find('e') and x>10+math.floor(math.sin(y*0.6)*1.2))
  if water then P.p(im,x,y,29);if P.hash(x,y,22)%17==0 then P.p(im,x,y,30) end end
 end end
 local cp=im:clone();for y=1,14 do for x=1,14 do if cp:getPixel(x,y)==P.colors[21] or cp:getPixel(x,y)==P.colors[20] or cp:getPixel(x,y)==P.colors[22] then if cp:getPixel(x+1,y)==P.colors[29] or cp:getPixel(x-1,y)==P.colors[29] or cp:getPixel(x,y+1)==P.colors[29] or cp:getPixel(x,y-1)==P.colors[29] then P.p(im,x,y,17) end end end end
 add('terrain.bank.'..d,im,{x=0,y=0})
 local path=ground('grass',1);for y=0,15 do for x=0,15 do local inside=true;if d:find('n') and y<3 then inside=false end;if d:find('s') and y>12 then inside=false end;if d:find('w') and x<3 then inside=false end;if d:find('e') and x>12 then inside=false end;if inside then P.p(path,x,y,ground('path',0):getPixel(x,y)) end end end;add('terrain.path.'..d,path,{x=0,y=0})
end
alias('terrain.grass.a','terrain.grass.0');alias('terrain.grass.b','terrain.grass.1');alias('terrain.grass.c','terrain.grass.2');alias('terrain.path.center','terrain.path.0')
local function window(im,x,y,w,h,lit)
 P.rect(im,x-1,y-1,w+2,h+2,10);P.rect(im,x,y,w,h,lit and 39 or 2);P.rect(im,x+1,y+1,w-2,h-2,lit and 40 or 29);P.line(im,x,y,x+w-1,y,13);P.line(im,x+math.floor(w/2),y,x+math.floor(w/2),y+h-1,11);P.line(im,x,y+math.floor(h/2),x+w-1,y+math.floor(h/2),11);P.rect(im,x-2,y+h,w+4,2,12);P.p(im,x-2,y+h,14)
end
local function door(im,x,y,w,h)
 P.rect(im,x-1,y-1,w+2,h+2,10);P.rect(im,x,y,w,h,11);P.rect(im,x,y,2,h,13)
 for xx=x+3,x+w-1,3 do P.line(im,xx,y+1,xx,y+h-1,10) end
 P.rect(im,x,y+3,w,1,12);P.rect(im,x,y+h-4,w,1,12);P.p(im,x+w-2,y+h/2,39);P.rect(im,x-3,y+h,w+6,3,4);P.line(im,x-3,y+h,x+w+2,y+h,6)
end
local function roof(im,x,y,w,h,ramp,kind)
 local l=x;local r=x+w-1;local ridge=y;local eave=y+h
 P.poly(im,{{l+14,ridge},{r-13,ridge},{r-9,ridge+2},{r-2,eave-7},{r,eave-3},{r-2,eave+1},{r-6,eave+3},{l+5,eave+3},{l+1,eave},{l-1,eave-3},{l+3,eave-9}},1)
 P.poly(im,{{l+14,ridge+1},{r-13,ridge+1},{r-9,ridge+3},{r-1,eave-3},{r-3,eave},{l+3,eave},{l,eave-3}},ramp[2])
 P.poly(im,{{l+11,ridge+1},{l+17,ridge+1},{l+7,eave-3},{l,eave-3}},ramp[3])
 for yy=ridge+4,eave-4,4 do
  local t=(yy-ridge)/h;local xl=math.ceil(l+11*(1-t));local xr=math.floor(r-10*(1-t));P.line(im,xl,yy,xr,yy,ramp[1]);P.line(im,xl,yy+1,xr,yy+1,ramp[3])
  for xx=xl+(math.floor((yy-ridge)/4)%2)*3,xr,7 do P.line(im,xx,yy-2,xx+1,yy,ramp[1]);P.p(im,xx+2,yy-2,ramp[4] or ramp[3]) end
 end
 if kind=='thatch' then for xx=l+4,r-4,3 do P.line(im,xx,eave-4,xx-1,eave+1,ramp[1]);P.p(im,xx,eave-5,ramp[4] or ramp[3]) end end
 P.line(im,l+14,ridge,r-13,ridge,ramp[4] or ramp[3]);P.line(im,l+12,ridge+1,r-11,ridge+1,ramp[3]);P.rect(im,l+2,eave-2,w-4,2,ramp[1]);P.line(im,l+4,eave,r-5,eave,10);P.line(im,l+6,eave+1,r-7,eave+1,12)
end
local function house(kind,variant)
 local w=80;local h=80;local im=P.image(w,h);variant=variant or 0
 P.ellipse(im,41,72,35,5,app.pixelColor.rgba(16,25,30,65));P.noise(im,12,37,56,32,7,6,8,variant+3,38);P.rect(im,65,37,7,32,5);P.line(im,65,38,65,68,4)
 -- timber construction, plaster wear, stone footing and small visible side face
 P.rect(im,12,37,3,32,11);P.rect(im,38,37,3,32,11);P.rect(im,64,37,4,32,10);P.rect(im,12,48,56,2,12);P.rect(im,12,65,56,4,4);P.line(im,12,65,67,65,6)
 P.line(im,15,39,35,47,12);P.line(im,42,47,63,39,11);P.rect(im,13,38,1,26,14)
 door(im,34,52,12,17);window(im,19,52,9,9,variant%2==0);window(im,51,52,9,9,false)
 local ramps=variant==1 and {3,4,5,6} or variant==2 and {38,16,17,18} or {33,34,35,37}
 roof(im,5,12,70,27,ramps,variant==2 and 'thatch' or 'tile')
 P.rect(im,57,6,7,14,4);P.rect(im,56,5,9,3,3);P.line(im,57,6,63,6,6);P.rect(im,61,8,3,11,3);P.p(im,58,12,5)
 -- a little dormer breaks the roof plane, with its own eave shadow
 P.poly(im,{{25,28},{32,19},{39,28}},10);P.poly(im,{{27,27},{32,21},{37,27}},8);window(im,30,25,4,4,true);P.line(im,25,28,39,28,11)
 P.rect(im,17,70,10,3,15);for xx=17,26,2 do P.p(im,xx,69,26);P.p(im,xx+1,68,27);if xx%3==0 then P.p(im,xx,67,50) end end
 if kind=='bakery' then
  -- masonry oven is outside the bakery rather than a text-only role cue
  P.rect(im,53,55,22,17,4);P.ellipse(im,64,55,11,8,5);P.ellipse(im,64,58,8,6,6);P.rect(im,58,58,13,12,10);P.ellipse(im,64,59,6,5,10);P.rect(im,60,62,9,5,33);P.line(im,61,65,67,65,36);P.p(im,65,63,40);P.rect(im,53,70,23,3,3)
  P.line(im,15,43,15,53,10);P.line(im,15,44,25,44,12);P.rect(im,18,46,11,8,10);P.rect(im,19,47,9,6,39);P.ellipse(im,23,50,4,2,40);P.p(im,22,49,13);P.p(im,25,49,13)
 elseif kind=='inn' then
  P.line(im,14,42,14,54,10);P.line(im,14,43,25,43,12);P.rect(im,18,45,11,10,10);P.rect(im,20,47,5,6,8);P.rect(im,25,48,3,4,8);P.rect(im,26,49,1,2,10);P.line(im,20,47,24,47,9)
  P.rect(im,49,72,20,2,11);P.rect(im,51,74,2,3,10);P.rect(im,65,74,2,3,10);P.rect(im,48,69,22,3,13);P.line(im,49,69,68,69,14)
 elseif kind=='granary' then
  P.rect(im,12,40,56,25,11);for yy=40,64,4 do P.line(im,13,yy,67,yy,13);P.line(im,15,yy+3,65,yy+3,10) end;P.rect(im,14,39,3,27,14);P.rect(im,62,39,3,27,10);P.line(im,18,43,60,62,12);P.line(im,18,62,60,43,12);door(im,34,49,14,19)
  for _,v in ipairs({{18,64},{24,68},{54,67}}) do P.ellipse(im,v[1],v[2],4,5,17);P.line(im,v[1]-2,v[2]-4,v[1]+2,v[2]-4,14);P.line(im,v[1]-3,v[2]+1,v[1]-2,v[2]+3,18) end
 end
 return im
end
add('building.house',house('house',0),{x=40,y=73});add('building.house.slate',house('house',1),{x=40,y=73});add('building.house.thatch',house('house',2),{x=40,y=73})
alias('building.home.plaster','building.house');alias('building.home.timber','building.house.thatch')
add('building.bakery',house('bakery',0),{x=40,y=73});add('building.granary',house('granary',2),{x=40,y=73});add('building.inn',house('inn',1),{x=40,y=73})
local function log(im,x,y)
 P.rect(im,x,y,24,5,10);P.rect(im,x,y,23,3,12);P.line(im,x+2,y,x+21,y,14);P.ellipse(im,x+1,y+2,2,2,17);P.p(im,x+1,y+2,11);P.p(im,x+22,y+3,11)
end
local yard=P.image(80,64);P.ellipse(yard,41,57,34,5,app.pixelColor.rgba(16,25,30,65));P.rect(yard,11,27,52,27,11);for y=29,51,4 do P.line(yard,12,y,62,y,12) end;P.rect(yard,11,25,3,30,10);P.rect(yard,60,25,3,30,10);P.rect(yard,19,30,32,25,1);roof(yard,4,8,66,20,{3,4,5,6});for row=0,2 do for n=0,1 do log(yard,15+n*25+row%2*3,51-row*5) end end;P.rect(yard,67,42,3,15,12);P.line(yard,65,43,73,39,3);P.line(yard,66,42,72,39,6);add('building.timber-yard',yard,{x=40,y=58})
local well=P.image(32,40);P.ellipse(well,16,36,14,3,app.pixelColor.rgba(16,25,30,60));P.rect(well,5,24,23,11,4);P.ellipse(well,16,25,12,5,6);P.ellipse(well,16,25,8,3,2);P.ellipse(well,16,25,6,2,29);for y=28,33,4 do for x=5,27,7 do P.line(well,x,y,x+5,y,5);P.p(well,x,y+1,3) end end;P.rect(well,5,10,3,21,11);P.rect(well,25,10,3,21,10);P.line(well,5,11,26,11,13);P.line(well,16,11,16,23,17);P.rect(well,12,22,8,7,12);P.line(well,12,22,19,22,14);P.line(well,13,28,18,28,10);roof(well,1,2,30,11,{33,34,35,37});add('building.well',well,{x=16,y=36});alias('prop.well','building.well')
local function stall(v)
 local im=P.image(48,48);P.ellipse(im,24,43,22,3,app.pixelColor.rgba(16,25,30,60));P.rect(im,5,14,2,30,11);P.rect(im,40,14,2,30,10);P.rect(im,7,33,33,10,11);P.rect(im,6,32,35,3,13);P.line(im,7,32,39,32,14);P.rect(im,9,35,2,7,14);P.rect(im,36,35,2,7,10)
 P.poly(im,{{7,7},{37,7},{44,23},{2,23}},1)
 for y=8,22 do local xl=7-(y-8)*0.3;local xr=37+(y-8)*0.4;for x=math.ceil(xl),math.floor(xr) do local stripe=math.floor((x-3)/6)%2;local c=stripe==0 and (v==0 and 49 or 52) or 8;if y>18 then c=stripe==0 and (v==0 and 48 or 51) or 7 end;P.p(im,x,y,c) end end
 P.line(im,7,7,37,7,9);for x=3,42,6 do P.rect(im,x,23,5,3,math.floor((x-3)/6)%2==0 and (v==0 and 49 or 52) or 8) end
 for x=10,34,7 do P.ellipse(im,x,30,3,2,v==0 and 39 or 22);P.p(im,x-1,29,v==0 and 40 or 23) end
 return im
end
add('building.market',stall(0),{x=24,y=44});add('prop.market.a',stall(0),{x=24,y=44});add('prop.market.b',stall(1),{x=24,y=44})
local function tree(v)
 local im=P.image(48,64);P.ellipse(im,25,57,20,4,app.pixelColor.rgba(16,25,30,65));P.line(im,24,31,22,57,10);P.rect(im,22,31,5,26,11);P.line(im,23,33,23,54,13);P.line(im,23,55,18,59,11);P.line(im,26,54,30,58,10);P.line(im,23,43,14,34,11);P.line(im,25,38,35,28,10)
 local clusters=v==0 and {{23,15,13,12},{12,25,10,11},{34,24,11,11},{23,32,15,10},{12,15,7,8},{34,13,8,8}} or {{24,12,10,10},{15,23,11,10},{33,24,10,11},{23,34,14,10},{22,23,15,13}}
 local leaf=v==0 and {24,25,26,27} or {60,61,62,9}
 for _,c in ipairs(clusters) do P.ellipse(im,c[1],c[2],c[3]+1,c[4]+1,leaf[1]);P.ellipse(im,c[1]-1,c[2]-2,c[3],c[4]-1,leaf[2]) end
 for _,c in ipairs(clusters) do
  P.ellipse(im,c[1]-3,c[2]-5,math.max(3,c[3]-4),math.max(3,c[4]-5),leaf[3])
  P.ellipse(im,c[1]-5,c[2]-7,math.max(2,c[3]-7),2,leaf[4])
  for n=0,3 do local x=c[1]-4+n*3;local y=c[2]-3+(n%2)*3;P.line(im,x,y,x+1,y,leaf[3]);P.p(im,x,y-1,leaf[4]) end
 end
 return im
end
add('prop.tree',tree(0),{x=24,y=59});add('prop.tree.oak',tree(0),{x=24,y=59});add('prop.tree.elm',tree(1),{x=24,y=59});alias('decor.tree-a','prop.tree.oak');alias('decor.tree-b','prop.tree.elm')
local board=P.image(32,32);P.ellipse(board,16,29,14,2,app.pixelColor.rgba(16,25,30,55));P.rect(board,6,8,3,22,10);P.rect(board,24,8,3,22,10);P.rect(board,3,4,27,19,10);P.rect(board,4,5,25,16,12);P.line(board,4,5,28,5,14);P.rect(board,7,8,9,10,8);P.rect(board,18,9,7,8,7);P.p(board,11,8,3);P.p(board,21,9,3);for y=11,15,2 do P.line(board,9,y,13,y,16);P.line(board,20,y,23,y,16) end;roof(board,1,1,30,5,{10,11,12,14});add('prop.noticeboard',board,{x=16,y=30})
local tableim=P.image(64,32);P.ellipse(tableim,32,27,29,3,app.pixelColor.rgba(16,25,30,55));P.rect(tableim,8,16,3,14,10);P.rect(tableim,53,16,3,14,10);P.rect(tableim,3,6,58,17,10);P.rect(tableim,4,6,56,13,12);for y=7,18,4 do P.line(tableim,5,y,58,y,14);P.line(tableim,5,y+3,58,y+3,11) end;for x=12,52,13 do P.ellipse(tableim,x,12,4,2,7);P.line(tableim,x-2,11,x+2,11,9);P.p(tableim,x+1,11,39) end;P.rect(tableim,3,24,58,3,11);P.line(tableim,4,24,59,24,14);add('prop.supper-table',tableim,{x=32,y=29})
local fence=P.image(32,24);for x=2,30,13 do P.rect(fence,x,6,3,17,10);P.rect(fence,x,6,1,16,14);P.p(fence,x+1,5,13) end;P.rect(fence,2,10,29,3,12);P.line(fence,3,10,30,10,14);P.rect(fence,2,17,29,3,11);P.line(fence,3,17,30,17,13);add('prop.fence',fence,{x=16,y=23})
local flower=P.image(16,16);for _,p in ipairs({{3,11},{7,9},{12,12},{10,5}}) do P.line(flower,p[1],p[2],p[1],p[2]+3,25);P.p(flower,p[1]-1,p[2]+1,26);P.p(flower,p[1]+1,p[2]-1,62);P.p(flower,p[1]-1,p[2]-1,50);P.p(flower,p[1],p[2]-2,9);P.p(flower,p[1],p[2]-1,40) end;add('prop.flower',flower,{x=8,y=15});alias('decor.flowers','prop.flower')
local bush=P.image(24,20);P.ellipse(bush,12,14,11,5,24);P.ellipse(bush,7,10,6,5,25);P.ellipse(bush,15,9,7,6,26);P.line(bush,12,5,16,5,27);P.line(bush,3,9,6,9,27);P.p(bush,17,11,50);P.p(bush,7,11,50);add('prop.bush',bush,{x=12,y=18});alias('decor.bush','prop.bush')
local stack=P.image(32,24);for row=0,2 do log(stack,3+(row%2)*2,18-row*5) end;add('prop.timber-stack',stack,{x=16,y=23})
local sacks=P.image(32,24);for _,c in ipairs({{7,15},{15,11},{23,16}}) do P.ellipse(sacks,c[1],c[2],6,7,15);P.ellipse(sacks,c[1]-1,c[2]-1,5,6,17);P.line(sacks,c[1]-3,c[2]-6,c[1]+2,c[2]-6,14);P.p(sacks,c[1]-3,c[2],18) end;add('prop.grain-stack',sacks,{x=16,y=23})
local barrel=P.image(16,24);P.ellipse(barrel,8,20,7,2,1);P.rect(barrel,2,5,12,15,11);P.ellipse(barrel,8,5,6,3,13);P.rect(barrel,3,6,4,13,13);P.line(barrel,5,7,5,18,14);P.rect(barrel,2,8,12,2,3);P.rect(barrel,2,16,12,2,3);P.line(barrel,3,8,12,8,5);P.line(barrel,3,16,12,16,5);P.ellipse(barrel,8,4,5,2,17);P.line(barrel,5,4,10,4,12);add('prop.barrel',barrel,{x=8,y=22})
local crate=P.image(20,20);P.rect(crate,2,4,15,14,10);P.rect(crate,3,5,13,12,12);P.line(crate,4,5,4,16,14);P.line(crate,3,5,15,5,14);P.line(crate,4,16,15,6,10);P.line(crate,5,16,16,6,13);P.rect(crate,15,5,3,12,11);add('prop.crate',crate,{x=10,y=19})
local lantern=P.image(16,32);P.rect(lantern,7,5,2,26,10);P.line(lantern,8,5,14,5,11);P.rect(lantern,11,7,5,9,1);P.rect(lantern,12,8,3,6,39);P.p(lantern,12,8,40);P.rect(lantern,12,16,3,1,12);P.rect(lantern,5,29,6,2,11);add('prop.lantern',lantern,{x=8,y=31});alias('decor.lantern','prop.lantern')
local function crossing(state)
 local im=P.image(48,48)
 -- exact same river and banks in every construction/weather state
 for y=8,39 do for x=0,47 do P.p(im,x,y,(x<8 or x>39) and 16 or 29) end end
 P.noise(im,0,8,8,32,16,15,17,9,50);P.noise(im,40,8,8,32,16,15,17,9,50)
 for y=9,38,6 do P.line(im,11,y,17,y,30);P.line(im,30,y+2,36,y+2,30) end
 if state=='ford' then
  for _,p in ipairs({{8,25},{16,23},{24,25},{32,23},{40,25}}) do P.ellipse(im,p[1],p[2],4,3,3);P.ellipse(im,p[1]-1,p[2]-1,3,2,6);P.line(im,p[1]-2,p[2]-1,p[1]+1,p[2]-1,7) end
 elseif state=='flooded' then
  P.rect(im,5,13,38,23,30);for n=0,5 do P.line(im,5+n*7,21+n%2*8,11+n*7,21+n%2*8,31) end;P.ellipse(im,8,25,3,1,5);P.ellipse(im,40,25,3,1,5)
 else
  local complete=state=='bridge' or state=='bridge-wet'
  if not complete then for _,p in ipairs({{8,25},{16,23},{24,25},{32,23},{40,25}}) do P.ellipse(im,p[1],p[2],4,3,3);P.ellipse(im,p[1]-1,p[2]-1,3,2,6) end end
  for _,x in ipairs({6,40}) do P.rect(im,x,14,3,23,10);P.rect(im,x,14,1,22,14);P.p(im,x+1,13,13) end
  if complete then
   P.rect(im,3,22,42,13,10);for x=4,43,4 do P.rect(im,x,21,3,12,state=='bridge-wet' and 11 or 12);P.line(im,x,21,x,32,state=='bridge-wet' and 13 or 14) end
   P.rect(im,4,16,39,2,13);P.line(im,5,16,42,16,14);P.rect(im,4,31,39,2,11);P.line(im,5,31,42,31,13)
   for _,x in ipairs({6,18,30,40}) do P.rect(im,x,14,2,7,10);P.p(im,x,14,14);P.rect(im,x,28,2,8,10);P.p(im,x,28,14) end
   P.rect(im,3,33,42,3,10)
  else P.rect(im,2,27,10,5,12);P.line(im,3,27,10,27,14);P.rect(im,36,27,10,5,12);P.line(im,37,27,44,27,14);P.line(im,7,16,41,16,17) end
 end
 return im
end
for _,state in ipairs({'ford','flooded','worksite','bridge','bridge-wet'}) do add('crossing.'..state,crossing(state),{x=24,y=31}) end
alias('crossing.raised','crossing.bridge');alias('crossing.wet','crossing.bridge-wet')
a:save()
-- Contact scene is a source-resolution sample assembled only from authored cells.
local scene=P.image(400,256)
for y=0,255,16 do for x=0,399,16 do scene:drawImage(images['terrain.grass.'..math.floor((x/16+y/16)%3)],Point(x,y)) end end
for y=0,255,16 do for x=192,223,16 do scene:drawImage(images['terrain.water.'..math.floor((y/16)%4)],Point(x,y)) end end
for x=0,399,16 do scene:drawImage(images['terrain.path.0'],Point(x,176)) end
for y=48,239,16 do scene:drawImage(images['terrain.path.0'],Point(112,y)) end
scene:drawImage(images['building.granary'],Point(32,29));scene:drawImage(images['building.bakery'],Point(263,35));scene:drawImage(images['building.house.slate'],Point(48,119));scene:drawImage(images['building.market'],Point(286,143));scene:drawImage(images['building.well'],Point(141,111));scene:drawImage(images['prop.supper-table'],Point(306,210));scene:drawImage(images['crossing.bridge'],Point(184,157));scene:drawImage(images['prop.noticeboard'],Point(255,174));scene:drawImage(images['prop.tree'],Point(9,99));scene:drawImage(images['prop.tree.elm'],Point(345,71));scene:drawImage(images['prop.bush'],Point(141,218));scene:drawImage(images['prop.flower'],Point(148,217));scene:drawImage(images['prop.barrel'],Point(116,87));scene:drawImage(images['prop.grain-stack'],Point(59,96));scene:drawImage(images['prop.timber-stack'],Point(18,218));scene:drawImage(images['prop.fence'],Point(83,215));scene:drawImage(images['prop.lantern'],Point(236,130))
P.saveImage(scene,P.root..'/public/assets/contact-town.png');P.saveSprite(scene,P.root..'/art/contact-town.aseprite','Original town material test')
_G.GODMODE_TOWN=images
