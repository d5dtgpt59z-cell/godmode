local root='/Users/ryanmorrison/Documents/Codex/2026-10-25/visit-https-cerebralvalley-ai-e-meta/outputs/godmode'
local f=assert(io.open(root..'/public/assets/cozy/map.json'));local d=json.decode(f:read('*a'));f:close()
local im=Image{fromFile=root..'/public/assets/cozy/map.png'}
for y=0,23 do for x=0,31 do if d.walkableRows[y+1]:sub(x+1,x+1)=='.'then for yy=y*16,y*16+15 do for xx=x*16,x*16+15 do local p=im:getPixel(xx,yy);im:drawPixel(xx,yy,app.pixelColor.rgba(math.floor(app.pixelColor.rgbaR(p)*.7+25*.3),math.floor(app.pixelColor.rgbaG(p)*.7+240*.3),math.floor(app.pixelColor.rgbaB(p)*.7+140*.3),255))end end end end end
for y=0,383 do for x=0,511 do if x%16==0 or y%16==0 then local p=im:getPixel(x,y);im:drawPixel(x,y,app.pixelColor.rgba(math.floor(app.pixelColor.rgbaR(p)*.55),math.floor(app.pixelColor.rgbaG(p)*.55),math.floor(app.pixelColor.rgbaB(p)*.55),255))end end end
for _,p in ipairs(d.places)do for yy=-2,2 do for xx=-2,2 do im:drawPixel(p.position.x*16+8+xx,p.position.y*16+12+yy,app.pixelColor.rgba(255,250,220,255))end end end
for _,p in ipairs(d.plots)do for yy=-1,1 do for xx=-1,1 do im:drawPixel(p.visualAnchor.x+xx,p.visualAnchor.y+yy,app.pixelColor.rgba(255,185,50,255))end end end
local s=Sprite(512,384);s.cels[1].image=im;app.command.SpriteSize{ui=false,width=1536,height=1152,method='nearest'};s:saveAs(root..'/art/cozy/map-grid-3x.png')
local original=Image{fromFile=root..'/public/assets/cozy/map.png'};local detail=Image(160,224);for y=0,223 do for x=0,159 do detail:drawPixel(x,y,original:getPixel(352+x,144+y))end end;local s=Sprite(160,224);s.cels[1].image=detail;app.command.SpriteSize{ui=false,width=640,height=896,method='nearest'};s:saveAs(root..'/art/cozy/east-detail-4x.png')
print('Final map path/target grid and east detail exported')
