-- Reproduce the delivered native background from preserved full-resolution source.
-- Writes only comparison output in art/cozy, never edits production map.png.
local root='/Users/ryanmorrison/Documents/Codex/2026-10-25/visit-https-cerebralvalley-ai-e-meta/outputs/godmode/art/cozy'
local f=assert(io.open(root..'/environment-palette.json'));local palette=json.decode(f:read('*a'));f:close()
local colors={};for _,h in ipairs(palette.colors)do h=h:gsub('#','');colors[#colors+1]={tonumber(h:sub(1,2),16),tonumber(h:sub(3,4),16),tonumber(h:sub(5,6),16)}end
local s=Sprite{fromFile=root..'/environment-source-v2.png'};app.command.SpriteSize{ui=false,width=512,height=384,method='nearest'}
local im=s.cels[1].image:clone();local cache={}
for y=0,383 do for x=0,511 do
 local p=im:getPixel(x,y);local hit=cache[p]
 if not hit then local r,g,b=app.pixelColor.rgbaR(p),app.pixelColor.rgbaG(p),app.pixelColor.rgbaB(p);local best=math.huge;for _,c in ipairs(colors)do local d=(r-c[1])^2+(g-c[2])^2+(b-c[3])^2;if d<best then best=d;hit=app.pixelColor.rgba(c[1],c[2],c[3],255)end end;cache[p]=hit end
 im:drawPixel(x,y,hit)
end end
local src=im:clone();local cells={};for y=14,21 do cells[#cells+1]={10,y}end;for x=4,10 do cells[#cells+1]={x,21}end;for y=15,21 do cells[#cells+1]={23,y}end
for i,c in ipairs(cells)do local sx=240+(i%2)*16;local sy=224+(i%3)*16;for y=0,15 do for x=0,15 do im:drawPixel(c[1]*16+x,c[2]*16+y,src:getPixel(sx+x,sy+y))end end end
im:saveAs(root..'/map-rebuilt.png')
local delivered=Image{fromFile=root..'/../../public/assets/cozy/map.png'};local mismatches=0
for y=0,383 do for x=0,511 do if im:getPixel(x,y)~=delivered:getPixel(x,y)then mismatches=mismatches+1 end end end
local qa={sameRgbaPixels=mismatches==0,mismatchedPixels=mismatches,checkedPixels=512*384,method='Nearest resize, exact preserved RGB palette, nearest RGB distance, authored stone-material walkway'}
local f=assert(io.open(root..'/background-rebuild-qa.json','w'));f:write(json.encode(qa));f:write('\n');f:close();assert(mismatches==0,'Background reconstruction differs from delivery');print(json.encode(qa))
