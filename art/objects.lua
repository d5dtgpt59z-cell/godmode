local P=dofile('/Users/ryanmorrison/Documents/Codex/2026-10-25/visit-https-cerebralvalley-ai-e-meta/outputs/godmode/art/pixel-core.lua')
local a=P.atlas('objects',512,512);local imgs={}
local function add(k,im,ms,anchor) imgs[k]=im;a:add(k,im,ms,anchor);return im end
local function alias(k,other) imgs[k]=imgs[other];a:alias(k,other) end
local function good(kind)
 local im=P.image(16,16)
 if kind=='grain' then P.ellipse(im,8,9,6,6,15);P.ellipse(im,7,8,5,5,17);P.line(im,5,3,10,3,14);P.line(im,5,4,10,4,11);P.line(im,5,10,5,12,18);P.line(im,8,6,8,11,39);P.p(im,7,7,40);P.p(im,9,8,40);P.p(im,7,9,40)
 elseif kind=='water' then P.line(im,4,6,5,2,3);P.line(im,5,2,10,2,5);P.line(im,10,2,12,6,3);P.poly(im,{{2,5},{14,5},{12,14},{4,14}},10);P.poly(im,{{3,6},{13,6},{11,13},{5,13}},12);P.rect(im,4,7,2,5,14);P.ellipse(im,8,6,5,2,30);P.line(im,5,5,9,5,31);P.line(im,4,11,11,11,3)
 elseif kind=='timber' then for _,c in ipairs({{2,9},{5,5},{1,4}}) do P.rect(im,c[1],c[2],11,5,10);P.rect(im,c[1],c[2],10,3,12);P.line(im,c[1]+1,c[2],c[1]+9,c[2],14);P.ellipse(im,c[1]+10,c[2]+2,2,2,17);P.p(im,c[1]+10,c[2]+2,11) end
 elseif kind=='bread' then P.ellipse(im,8,10,7,4,38);P.ellipse(im,7,8,6,4,39);P.ellipse(im,6,7,4,2,40);for _,x in ipairs({5,8,11}) do P.line(im,x,6,x-1,9,13);P.p(im,x+1,6,40) end;P.line(im,3,11,11,12,14)
 end
 return im
end
for _,kind in ipairs({'grain','water','timber','bread'}) do
 local im=good(kind);add('goods.'..kind,im,200,{x=8,y=14});alias('resource.'..kind,'goods.'..kind)
 local mini=P.image(8,8);for y=0,7 do for x=0,7 do local c=im:getPixel(x*2,y*2);if app.pixelColor.rgbaA(c)==0 then c=im:getPixel(math.min(15,x*2+1),math.min(15,y*2+1)) end;mini:drawPixel(x,y,c) end end;add('carry.'..kind,mini,200,{x=4,y=6})
end
local note=P.image(16,16);P.poly(note,{{3,2},{10,2},{13,5},{13,14},{3,14}},10);P.poly(note,{{4,3},{9,3},{12,6},{12,13},{4,13}},8);P.poly(note,{{9,3},{12,6},{9,6}},6);for y=7,11,2 do P.line(note,6,y,10,y,16) end;P.p(note,6,4,9);add('goods.note',note);alias('ui.note','goods.note');alias('ui.chronicle','goods.note')
local crate=P.image(20,20);P.rect(crate,2,4,16,14,10);P.rect(crate,3,5,14,12,12);P.line(crate,3,5,16,5,14);P.rect(crate,3,10,14,2,10);P.line(crate,4,16,16,5,13);P.line(crate,4,5,16,16,13);P.p(crate,4,6,39);P.p(crate,15,15,39);add('ui.supply',crate);alias('ui.delivery','ui.supply')
local weather=P.image(20,20);P.ellipse(weather,8,7,6,4,4);P.ellipse(weather,13,6,5,4,5);P.ellipse(weather,7,5,4,4,6);P.rect(weather,3,7,14,3,5);P.line(weather,3,8,15,8,6);for _,p in ipairs({{5,12},{11,13},{16,12}}) do P.line(weather,p[1],p[2],p[1]-2,p[2]+4,30);P.p(weather,p[1],p[2],31) end;add('ui.weather',weather);alias('ui.rain','ui.weather')
local cursor=P.image(16,20);P.poly(cursor,{{2,1},{2,16},{6,12},{9,18},{12,17},{8,11},{14,11}},1);P.poly(cursor,{{3,3},{3,13},{6,10},{10,10}},8);P.line(cursor,3,3,3,12,9);P.line(cursor,7,12,9,16,7);add('ui.cursor',cursor,200,{x=2,y=1})
local ring=P.image(24,16);P.ellipse(ring,12,8,11,5,1);P.ellipse(ring,12,8,10,4,40);P.ellipse(ring,12,8,8,3,app.pixelColor.rgba(0,0,0,0));P.p(ring,1,8,9);P.p(ring,12,3,9);add('ui.selection-ring',ring,200,{x=12,y=8});alias('ui.selected','ui.selection-ring')
local target=P.image(24,24);for _,p in ipairs({{2,2,1,1},{21,2,-1,1},{2,21,1,-1},{21,21,-1,-1}}) do P.line(target,p[1],p[2],p[1]+5*p[3],p[2],1);P.line(target,p[1],p[2],p[1],p[2]+5*p[4],1);P.line(target,p[1]+p[3],p[2]+p[4],p[1]+5*p[3],p[2]+p[4],40);P.line(target,p[1]+p[3],p[2]+p[4],p[1]+p[3],p[2]+5*p[4],40) end;P.p(target,11,11,40);P.p(target,12,11,40);add('ui.target',target,200,{x=12,y=12})
local clock=P.image(20,20);P.ellipse(clock,10,10,9,9,1);P.ellipse(clock,10,10,8,8,12);P.ellipse(clock,10,10,6,6,8);P.line(clock,10,10,10,5,10);P.line(clock,10,10,14,12,10);P.p(clock,10,10,39);for _,p in ipairs({{10,4},{10,16},{4,10},{16,10}}) do P.p(clock,p[1],p[2],13) end;P.line(clock,6,2,11,2,14);add('ui.clock',clock)
for _,kind in ipairs({'pause','play','rewind','fork','inspect','close','sound','mute'}) do
 local im=P.image(16,16)
 if kind=='pause' then P.rect(im,4,3,3,11,8);P.rect(im,10,3,3,11,8)
 elseif kind=='play' then P.poly(im,{{4,2},{13,8},{4,14}},8)
 elseif kind=='rewind' then P.poly(im,{{8,3},{2,8},{8,13}},8);P.poly(im,{{14,3},{8,8},{14,13}},8)
 elseif kind=='fork' then P.line(im,8,14,8,8,8);P.line(im,8,8,3,3,8);P.line(im,8,8,13,3,8);P.line(im,3,3,3,7,8);P.line(im,3,3,7,3,8);P.line(im,13,3,13,7,8);P.line(im,13,3,9,3,8)
 elseif kind=='inspect' then P.ellipse(im,7,6,5,5,8);P.ellipse(im,7,6,3,3,app.pixelColor.rgba(0,0,0,0));P.line(im,10,10,14,14,8);P.line(im,11,10,15,14,8)
 elseif kind=='close' then P.line(im,4,4,12,12,8);P.line(im,4,12,12,4,8)
 else P.poly(im,{{2,6},{6,6},{10,2},{10,14},{6,10},{2,10}},8);if kind=='mute' then P.line(im,12,5,15,10,50);P.line(im,12,10,15,5,50) else P.line(im,12,5,14,7,8);P.line(im,14,7,12,10,8) end end
 add('ui.'..kind,im)
end
local request=P.image(16,20);P.ellipse(request,8,7,7,6,10);P.ellipse(request,8,6,6,5,8);P.poly(request,{{5,10},{5,16},{10,10}},8);P.rect(request,7,3,2,5,13);P.rect(request,7,9,2,1,13);add('ui.request',request,200,{x=8,y=19})
local page=P.image(48,48);P.rect(page,2,2,44,44,10);P.rect(page,3,3,42,42,7);P.rect(page,5,4,38,39,8);P.line(page,5,4,42,4,9);P.line(page,4,5,4,41,9);P.line(page,43,5,43,42,6);P.line(page,5,43,42,43,6);for n=1,8 do local x=7+(n*7)%34;local y=7+(n*11)%32;P.p(page,x,y,7) end;P.rect(page,7,4,1,39,7);P.rect(page,8,4,1,39,9);add('ui.paper',page,200,{x=0,y=0})
local book=P.image(32,32);P.rect(book,3,3,26,25,10);P.rect(book,5,2,24,24,49);P.rect(book,7,3,21,21,48);P.rect(book,5,2,3,24,50);P.line(book,8,3,27,3,50);P.rect(book,9,5,16,16,12);P.rect(book,10,6,14,14,8);P.line(book,12,10,22,10,16);P.line(book,12,13,22,13,16);P.line(book,12,16,18,16,16);P.rect(book,22,24,3,6,52);P.line(book,8,27,28,27,7);add('ui.notebook',book)
local function fx(kind,f)
 local im=P.image(32,32)
 if kind=='rain' then
  for n=0,4 do local x=(n*9+f*3)%31;local y=(n*7+f*7)%29;P.line(im,x,y,x-2,y+5,app.pixelColor.rgba(120,166,161,150));P.p(im,x,y,31) end
 elseif kind=='ripple' then P.ellipse(im,16,23,3+f*3,1+f,30);P.ellipse(im,16,23,2+f*3,f+0.5,app.pixelColor.rgba(0,0,0,0));P.line(im,13-f*2,22-f,16-f,22-f,31)
 elseif kind=='oven-smoke' then
  local alpha=170-f*25;P.ellipse(im,16+f,22-f*4,4+f,3+f,app.pixelColor.rgba(124,133,117,alpha));P.ellipse(im,12+f,14-f*3,3+f,3+f,app.pixelColor.rgba(169,173,145,alpha-40));P.ellipse(im,15+f,6-f,2+f,2+f,app.pixelColor.rgba(189,186,156,alpha-60))
 elseif kind=='delivery' then
  local y=math.min(14,2+f*4);im:drawImage(crate,Point(6,y));for n=0,3 do P.ellipse(im,7+n*6,29,math.max(1,f),1,app.pixelColor.rgba(161,138,91,180-f*25)) end
 elseif kind=='note-received' then
  im:drawImage(note,Point(8,10-f*2));P.line(im,5,16-f*2,2,16-f*2,39);P.line(im,26,14-f*2,29,12-f*2,39)
 elseif kind=='footprint' then
  P.ellipse(im,12,20,1,2,app.pixelColor.rgba(61,48,41,180-f*35));P.ellipse(im,19,25,1,2,app.pixelColor.rgba(61,48,41,180-f*35))
 elseif kind=='supper' then
  im:drawImage(good('bread'),Point(8,8));P.ellipse(im,16,24,9,2,7);P.ellipse(im,16,23,8,2,8);P.p(im,13+f,8,40)
 end
 return im
end
for _,kind in ipairs({'rain','ripple','oven-smoke','delivery','note-received','footprint','supper'}) do local seq={};for f=0,3 do local k='fx.'..kind..'.'..f;add(k,fx(kind,f),kind=='oven-smoke' and 260 or 160,{x=16,y=31});seq[#seq+1]=k end;a.animations['fx.'..kind]={frames=seq,duration=kind=='oven-smoke' and 260 or 160,repeatCount=(kind=='delivery' or kind=='note-received') and 0 or -1} end
a:save()
local contact=P.image(384,160);local x=6;local y=6;for _,key in ipairs({'goods.grain','goods.water','goods.timber','goods.bread','goods.note','ui.supply','ui.weather','ui.cursor','ui.selection-ring','ui.target','ui.clock','ui.pause','ui.play','ui.rewind','ui.fork','ui.inspect','ui.request','ui.notebook','ui.paper'}) do local im=imgs[key];if x+im.width+8>384 then x=6;y=y+54 end;contact:drawImage(im,Point(x,y));x=x+im.width+8 end
x=6;y=100;for _,kind in ipairs({'rain','ripple','oven-smoke','delivery','note-received','footprint','supper'}) do contact:drawImage(imgs['fx.'..kind..'.2'],Point(x,y));x=x+48 end
P.saveImage(contact,P.root..'/public/assets/contact-objects.png');P.saveSprite(contact,P.root..'/art/contact-objects.aseprite','Goods, interface and stepped-alpha effects')
