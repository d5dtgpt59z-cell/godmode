-- Original classic life-sim cast. Native pixels; no franchise art imported.
local ROOT='/Users/ryanmorrison/Documents/Codex/2026-10-25/visit-https-cerebralvalley-ai-e-meta/outputs/godmode/art/cozy'
local OUT=ROOT..'/character-refinement/v3';local P=dofile(ROOT..'/pixel-core.lua')
local function rgb(h)return app.pixelColor.rgba(tonumber(h:sub(1,2),16),tonumber(h:sub(3,4),16),tonumber(h:sub(5,6),16),255)end
local C={ink=rgb('34413c'),cream=rgb('f6e5bd'),white=rgb('fff0d4'),gold=rgb('dfb467'),steel=rgb('9cac9e'),leather=rgb('594334'),leatherhi=rgb('a47a4d')}
local people={
 {id='player',name='You',skin={'a46d51','d4a17a','efc39b','ffe0b7','cf8e78'},hair={'49392c','785338','b38759','d9ae7c'},cloth={'2b4c55','4d7e87','83b2b2','b5d3c9'},pants={'6f7561','aaa98a'},accent='d9b66e',eye='536e77'},
 {id='ada',name='Ada',skin={'a86c50','dba17a','f0c39d','ffe1b8','df9b86'},hair={'60392d','a25a39','d68a53','f3b777'},cloth={'3b5364','638395','9bb4bd','c4d2cd'},pants={'425769','7b95a0'},accent='e9d3a7',eye='65805d'},
 {id='mara',name='Mara',skin={'986b5b','c99b83','e3b99c','f7d6b6','ce9182'},hair={'646c70','9ba8a4','d0d6c5','f0e8cf'},cloth={'3d594c','75916d','a7b68c','ced4aa'},pants={'62474f','aa737a'},accent='d3b477',eye='66847e'},
 {id='wren',name='Wren',skin={'694534','996745','c08b60','dfae7c','b97960'},hair={'303530','4c4a39','766549','a08a60'},cloth={'795c37','b08a51','d6b772','f0d79a'},pants={'35565a','64888a'},accent='ac5d53',eye='74603c'},
}
for _,v in ipairs(people)do for _,key in ipairs({'skin','hair','cloth','pants'})do for i,h in ipairs(v[key])do v[key][i]=rgb(h)end end;v.accent=rgb(v.accent);v.eye=rgb(v.eye)end
local function spans(im,rows,c,dy)for _,r in ipairs(rows)do P.line(im,r[2],r[1]+(dy or 0),r[3],r[1]+(dy or 0),c)end end
local function hand(im,x,y,v)P.line(im,x,y,x+1,y,v.skin[3]);P.line(im,x,y+1,x+1,y+1,v.skin[2]);P.p(im,x+1,y+2,v.skin[1])end
local function shoe(im,x,y,v,light)P.line(im,x,y-3,x+1,y-3,v.pants[light and 2 or 1]);P.line(im,x,y-2,x+2,y-2,C.leather);P.line(im,x-1,y-1,x+3,y-1,light and C.leatherhi or C.leather);P.line(im,x,y,x+3,y,C.leather)end
local function actor(v,action,face,f)
 local im=P.image(24,32);local moving=action=='walk'or action=='carry';local carry=action=='carry';local side=face=='e'or face=='w';local back=face=='n';local bob=moving and f%2 or 0;local swing=moving and ({-1,1,1,-1})[f+1]or 0;local cloth,hair,skin=v.cloth,v.hair,v.skin
 local lx,rx,lb,rb=9,14,30,30
 if moving then if side then lx=({8,10,14,12})[f+1];rx=({14,12,9,11})[f+1];lb=({29,28,30,28})[f+1];rb=({30,30,29,30})[f+1]else lx=({9,10,9,10})[f+1];rx=({14,13,14,13})[f+1];lb=({30,30,29,28})[f+1];rb=({29,28,30,30})[f+1]end end
 P.poly(im,{{9,21},{12,21},{lx+2,lb-3},{lx,lb-3},{lx,25}},v.pants[1]);P.poly(im,{{13,21},{16,21},{rx+2,rb-3},{rx,rb-3},{rx,25}},v.pants[2]);P.line(im,lx,23,lx,lb-3,v.pants[2]);shoe(im,lx,lb,v,false);shoe(im,rx,rb,v,true)
 if v.id=='ada'or v.id=='mara'then P.poly(im,{{9,19+bob},{15,19+bob},{17,24},{16,25},{7,25},{7,23}},v.pants[1]);P.line(im,9,21,8,24,v.pants[2]);P.line(im,13,21,14,24,v.pants[2]);P.line(im,8,25,15,25,v.pants[1])end
 if side then P.poly(im,{{10,10+bob},{14,11+bob},{16,14+bob},{16,20+bob},{14,23},{9,22},{8,18+bob},{8,13+bob}},cloth[1]);P.poly(im,{{10,11+bob},{13,12+bob},{14,18+bob},{13,21},{9,20}},cloth[2]);P.line(im,9,13+bob,9,17+bob,cloth[3])
 else P.poly(im,{{9,10+bob},{14,10+bob},{17,13+bob},{18,17+bob},{16,21},{14,23},{9,22},{7,20},{6,15+bob},{7,12+bob}},cloth[1]);P.poly(im,{{9,11+bob},{12,11+bob},{15,14+bob},{15,20},{12,22},{8,20},{7,15+bob}},cloth[2]);P.line(im,8,13+bob,9,12+bob,cloth[3]);P.line(im,8,14+bob,8,17+bob,cloth[3]);P.p(im,9,19,cloth[3])end
 P.line(im,11,10+bob,13,10+bob,skin[1]);P.line(im,11,11+bob,13,11+bob,C.cream)
 local ly,ry=14+bob+swing,14+bob-swing
 if side then P.poly(im,{{11,12+bob},{13,13+bob},{14,18+bob},{13,21},{11,20},{10,15+bob}},cloth[1]);P.line(im,11,14+bob,11,17+bob,cloth[3]);if not carry then hand(im,12,21-swing,v)end
 else P.poly(im,{{7,12+bob},{8,14+bob},{7,ly+5},{5,ly+6},{4,ly+4},{5,ly+1}},cloth[1]);P.line(im,5,ly+1,5,ly+3,cloth[3]);P.poly(im,{{17,12+bob},{18,14+bob},{20,ry+4},{19,ry+6},{17,ry+5},{16,ry+1}},cloth[1]);if not carry then hand(im,5,ly+5,v);hand(im,18,ry+5,v)end end
 if v.id=='player'then if not back then P.line(im,10,12+bob,11,15+bob,C.cream);P.line(im,14,12+bob,13,15+bob,C.cream);P.line(im,12,15+bob,12,21,cloth[1]);P.p(im,13,17,C.gold);P.line(im,8,18,10,18,cloth[1])else P.line(im,9,13+bob,14,13+bob,cloth[3]);P.line(im,10,20,14,21,cloth[1])end
 elseif v.id=='ada'then if not back then P.poly(im,{{10,13+bob},{14,13+bob},{14,19},{16,24},{8,24},{9,20}},v.accent);P.line(im,10,14+bob,10,18,C.white);P.line(im,10,21,14,21,cloth[1]);P.line(im,9,23,14,23,C.cream)else P.line(im,9,12+bob,14,20,v.accent);P.line(im,15,12+bob,10,20,v.accent);P.line(im,8,20,16,20,C.cream)end;if not carry then P.line(im,4,ly+4,7,ly+4,C.cream);P.line(im,17,ry+4,20,ry+4,v.accent)end
 elseif v.id=='mara'then P.poly(im,{{9,11+bob},{12,15+bob},{15,11+bob},{14,15+bob},{12,18+bob},{10,15+bob}},v.accent);P.p(im,13,18,C.gold);P.line(im,12,19,12,21,cloth[1]);P.line(im,8,23,10,23,v.pants[2])
 else P.line(im,8,12+bob,17,21,C.leather);P.line(im,9,12+bob,18,21,C.leatherhi);P.poly(im,{{17,20},{20,21},{21,24},{19,26},{16,25},{15,22}},C.leather);P.poly(im,{{17,21},{19,21},{20,24},{17,25},{16,23}},C.leatherhi);P.p(im,18,23,C.gold);P.poly(im,{{10,10+bob},{15,11+bob},{15,13+bob},{11,13+bob},{9,12+bob}},v.accent);P.poly(im,{{14,12+bob},{16,14+bob},{17,17},{14,16}},v.accent)end
 -- Compact adult heads: 9px high faces above longer shaped body/leg masses.
 spans(im,{{2,10,14},{3,8,16},{4,7,17},{5,7,17},{6,7,17},{7,7,17},{8,8,16},{9,9,15},{10,10,14}},hair[1],bob);P.poly(im,{{9,3+bob},{13,2+bob},{16,4+bob},{15,6+bob},{9,6+bob},{8,5+bob}},hair[2]);P.line(im,10,3+bob,12,3+bob,hair[3])
 if back then P.poly(im,{{9,4+bob},{14,4+bob},{16,7+bob},{14,10+bob},{10,10+bob},{8,7+bob}},hair[2]);P.line(im,9,5+bob,11,4+bob,hair[3]);P.line(im,11,9+bob,14,8+bob,hair[1])
 elseif side then spans(im,{{4,13,15},{5,12,16},{6,12,17},{7,12,17},{8,13,17},{9,13,16},{10,14,15}},skin[2],bob);P.p(im,17,6+bob,skin[3]);P.p(im,18,7+bob,skin[2]);P.p(im,16,9+bob,skin[1]);P.line(im,13,5+bob,14,4+bob,skin[3]);if action=='rest'or(action=='idle'and f==1)then P.line(im,15,6+bob,16,6+bob,v.eye)else P.p(im,15,6+bob,C.white);P.p(im,16,6+bob,v.eye);P.p(im,16,7+bob,v.eye)end;P.p(im,16,8+bob,skin[5]);P.poly(im,{{10,3+bob},{15,3+bob},{16,5+bob},{14,5+bob},{13,6+bob},{11,5+bob}},hair[2])
 else spans(im,{{4,10,14},{5,9,15},{6,8,16},{7,8,16},{8,9,15},{9,10,14},{10,11,13}},skin[2],bob);P.p(im,9,5+bob,skin[3]);P.p(im,8,6+bob,skin[3]);P.p(im,12,8+bob,skin[3]);P.line(im,11,9+bob,13,9+bob,skin[1]);P.p(im,9,8+bob,skin[5]);P.p(im,15,8+bob,skin[5]);if action=='rest'or(action=='idle'and f==1)then P.line(im,9,6+bob,10,6+bob,v.eye);P.line(im,14,6+bob,15,6+bob,v.eye)else P.p(im,9,6+bob,C.white);P.p(im,10,6+bob,v.eye);P.p(im,14,6+bob,C.white);P.p(im,15,6+bob,v.eye)end;P.poly(im,{{8,4+bob},{10,3+bob},{14,3+bob},{16,4+bob},{15,5+bob},{12,4+bob},{10,5+bob},{8,5+bob}},hair[2]);if action=='talk'and f==1 then P.p(im,12,9+bob,v.eye)end end
 if v.id=='player'then P.poly(im,{{8,2+bob},{11,1+bob},{15,2+bob},{17,3+bob},{17,4+bob},{7,4+bob}},cloth[1]);P.line(im,9,2+bob,14,2+bob,cloth[3]);if not back then P.line(im,11,4+bob,19,4+bob,cloth[2]);P.p(im,17,3+bob,C.gold)end
 elseif v.id=='ada'then P.ellipse(im,14,2+bob,2,1,hair[1]);P.line(im,13,1+bob,15,1+bob,hair[3]);P.p(im,15,3+bob,hair[3]);P.p(im,7,8+bob,hair[2])
 elseif v.id=='mara'then for i=0,4 do local x=(back and 10 or 7)+i%2;local y=8+bob+i*2;P.ellipse(im,x,y,1,1,hair[1]);P.p(im,x,y-1,hair[3]);P.p(im,x+1,y,hair[2])end;P.p(im,8,17+bob,v.accent);P.line(im,9,3+bob,12,2+bob,hair[4])
 else for _,p in ipairs({{8,3},{11,2},{14,2},{16,4},{7,5}})do P.ellipse(im,p[1],p[2]+bob,1,1,hair[1]);P.p(im,p[1],p[2]-1+bob,hair[3])end end
 if carry then P.line(im,7,19,9,22,cloth[2]);P.line(im,17,19,15,22,cloth[1]);hand(im,8,22,v);hand(im,16,22,v)end
 if action=='work'then local lift=({0,-2,0,2})[f+1];if v.id=='player'then P.ellipse(im,13,23+lift,4,3,cloth[1]);P.ellipse(im,12,22+lift,3,2,cloth[2]);P.line(im,16,22+lift,20,19+lift,C.steel);P.line(im,20,19+lift,22,19+lift,C.cream);hand(im,9,21+lift,v)
 elseif v.id=='ada'then P.line(im,6,22+lift,19,22+lift,C.leather);P.line(im,8,21+lift,17,21+lift,C.gold);hand(im,7,20+lift,v);hand(im,18,20+lift,v)
 elseif v.id=='mara'then P.line(im,8,23,15,25,C.leatherhi);P.line(im,17,17+lift,18,24+lift,C.leatherhi);P.line(im,15,16+lift,20,16+lift,C.steel);hand(im,17,20+lift,v)
 else P.poly(im,{{9,20+lift},{17,20+lift},{18,25+lift},{8,25+lift}},v.accent);P.poly(im,{{9,20+lift},{17,20+lift},{13,23+lift}},C.cream);hand(im,7,22+lift,v);hand(im,18,22+lift,v)end
 elseif action=='talk'and f==1 then P.line(im,17,18,20,15,cloth[2]);hand(im,20,13,v)
 elseif action=='rest'then P.line(im,8,21,11,23,cloth[2]);P.line(im,17,21,14,23,cloth[1]);hand(im,11,22,v);hand(im,14,22,v)end
 if face=='w'then local flip=P.image(24,32);for y=0,31 do for x=1,23 do flip:drawPixel(24-x,y,im:getPixel(x,y))end end;im=flip end
 return im
end
return{P=P,OUT=OUT,ROOT=ROOT,people=people,C=C,rgb=rgb,actor=actor}
