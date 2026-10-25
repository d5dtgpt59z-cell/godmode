-- Original 16x24 anime-inspired chibi rig. One geometry system, 24 persistent identities.
return function(P)
 local ramps={{48,49,50},{51,52,53},{54,55,56},{57,58,59},{60,61,62},{5,7,9},{20,21,22},{11,13,14}}
 return function(v,dir,action,frame)
  local im=P.image(16,24);local ramp=ramps[(v-1)%8+1];local skin=v%3==0 and {45,46,47} or {41,42,43};local hair=({10,12,39,4,33,54})[(v-1)%6+1];local hairlight=({12,14,40,6,35,56})[(v-1)%6+1];local style=math.floor((v-1)/8);local apron=v==6 or v==7 or v==19;local moving=action=='walk' or action=='carry';local rest=action=='rest';local bob=moving and ((frame==1 or frame==3) and 1 or 0) or 0;local oy=rest and 2 or bob;local phase=moving and ({0,-1,0,1})[frame+1] or 0
  P.ellipse(im,8,22,5,1,app.pixelColor.rgba(49,43,64,70))
  -- Short boots and a broad, bean-shaped body leave half the silhouette to the head.
  if rest then P.ellipse(im,5,22,3,1,10);P.ellipse(im,11,22,3,1,10);P.p(im,3,21,13);P.p(im,12,21,13)
  else
   P.rect(im,5,18+bob,3,4-phase,1);P.rect(im,9,18+bob,3,4+phase,1);P.rect(im,5,19+bob,2,2-phase,3);P.rect(im,9,19+bob,2,2+phase,2)
   P.rect(im,4,21-phase,4,2,10);P.rect(im,8,21+phase,4,2,10);P.p(im,4,21-phase,13);P.p(im,8,21+phase,13)
  end
  P.poly(im,{{5,12+oy},{10,12+oy},{12,15+oy},{11,19+oy},{4,19+oy},{3,15+oy}},1)
  P.rect(im,5,13+oy,6,5,ramp[2]);P.rect(im,4,15+oy,7,3,ramp[2]);P.rect(im,5,13+oy,2,4,ramp[3]);P.rect(im,10,14+oy,1,4,ramp[1]);P.line(im,5,18+oy,10,18+oy,ramp[1]);P.p(im,8,13+oy,9);P.p(im,8,15+oy,39)
  if apron then P.rect(im,6,14+oy,4,4,8);P.rect(im,6,14+oy,1,3,9);P.p(im,9,17+oy,7) end
  if dir=='n' then P.line(im,5,13+oy,10,13+oy,ramp[1]);P.p(im,7,16+oy,ramp[3]) end
  if action=='carry' then
   P.rect(im,2,14+oy,3,4,ramp[1]);P.rect(im,11,14+oy,3,4,ramp[1]);P.rect(im,4,16+oy,9,4,10);P.rect(im,5,16+oy,7,3,13);P.line(im,5,16+oy,11,16+oy,14);P.p(im,4,17+oy,skin[3]);P.p(im,12,17+oy,skin[2]);P.line(im,6,18+oy,10,18+oy,12)
  elseif action=='work' then
   local lift=({0,1,3,1})[frame+1];P.line(im,4,14+oy,2,18+oy-lift,ramp[1]);P.line(im,11,14+oy,13,18+oy-lift,ramp[1]);P.rect(im,2,17+oy-lift,2,2,skin[3]);P.rect(im,12,17+oy-lift,2,2,skin[2])
   if v>=8 and v<=11 then P.line(im,13,17+oy-lift,14,12+oy-lift,13);P.rect(im,12,11+oy-lift,4,2,3);P.p(im,12,11+oy-lift,6) elseif apron then P.line(im,13,17+oy-lift,14,12+oy-lift,13);P.ellipse(im,14,12+oy-lift,1,2,14) end
  elseif action=='talk' then P.rect(im,2,14+oy,2,4,ramp[3]);P.rect(im,2,18+oy,2,2,skin[2]);P.line(im,11,14+oy,13,14+oy-frame*2,ramp[1]);P.rect(im,13,13+oy-frame*2,2,2,skin[3])
  elseif rest then P.line(im,3,17+oy,7,18+oy-frame,ramp[3]);P.line(im,12,17+oy,8,18+oy-frame,ramp[1]);P.p(im,7,18+oy-frame,skin[3]);P.p(im,8,18+oy-frame,skin[2])
  else local swing=moving and phase or frame;P.rect(im,2,14+oy-swing,2,4,ramp[3]);P.rect(im,2,18+oy-swing,2,2,skin[2]);P.rect(im,12,14+oy+swing,2,4,ramp[1]);P.rect(im,12,18+oy+swing,2,2,skin[1]) end
  -- Long-hair underlayer, drawn before the head so locks belong to the silhouette.
  if style==2 then P.rect(im,2,5+oy,3,10,hair);P.rect(im,12,5+oy,3,10,hair);P.line(im,2,7+oy,2,13+oy,hairlight) end
  P.ellipse(im,8,6+oy,6,6,1);P.ellipse(im,8,6+oy,5,5,hair);P.ellipse(im,7,7+oy,5,5,skin[2]);P.ellipse(im,6,6+oy,3,3,skin[3]);P.line(im,6,11+oy,10,11+oy,skin[2])
  if dir=='s' then
   -- Two-pixel irises, catchlights, cheeks and a tiny open/closed talking mouth.
   for _,x in ipairs({5,10}) do
    if rest then P.line(im,x,7+oy,x+1,7+oy,1);P.p(im,x+1,8+oy,skin[1])
    else P.rect(im,x,6+oy,2,3,1);P.p(im,x,6+oy,63);P.p(im,x+1,8+oy,54) end
   end
   P.line(im,3,9+oy,4,9+oy,50);P.line(im,11,9+oy,12,9+oy,50);P.p(im,8,9+oy,skin[3]);P.line(im,7,11+oy,9,11+oy,skin[1]);if action=='talk' and frame==1 then P.p(im,8,10+oy,1) end
  elseif dir=='n' then
   P.ellipse(im,8,6+oy,5,5,hair);P.line(im,5,10+oy,10,10+oy,hairlight);P.line(im,4,4+oy,4,8+oy,hairlight);P.p(im,6,2+oy,hairlight)
  else
   local right=dir=='e';local face=right and 9 or 3;P.rect(im,face,5+oy,4,6,skin[2]);P.p(im,right and 13 or 2,8+oy,skin[2]);local ex=right and 11 or 4
   if rest then P.line(im,ex,7+oy,ex+1,7+oy,1) else P.rect(im,ex,6+oy,2,3,1);P.p(im,ex,6+oy,63);P.p(im,ex+1,8+oy,54) end
   P.p(im,right and 12 or 3,10+oy,50);P.p(im,right and 12 or 3,11+oy,skin[1]);P.rect(im,right and 3 or 9,4+oy,4,6,hair);P.line(im,right and 3 or 9,4+oy,right and 3 or 9,8+oy,hairlight)
  end
  -- Rounded, individually highlighted bangs. Global lighting stays upper-left in all facings.
  P.ellipse(im,8,2+oy,5,2,hair);P.line(im,4,2+oy,9,1+oy,hairlight);P.rect(im,3,3+oy,3,2,hair);P.rect(im,7,3+oy,3,2,hair);P.p(im,10,4+oy,hair);P.p(im,4,4+oy,hairlight)
  if style==1 then P.ellipse(im,8,2+oy,6,2,ramp[1]);P.ellipse(im,7,1+oy,5,1,ramp[3]);P.line(im,3,3+oy,12,3+oy,ramp[2]);P.p(im,10,0+oy,ramp[1])
  elseif style==2 then P.p(im,13,5+oy,62);P.p(im,14,4+oy,50);P.p(im,14,6+oy,50) end
  if apron then P.ellipse(im,5,2+oy,2,2,7);P.ellipse(im,8,1+oy,3,2,9);P.ellipse(im,11,2+oy,2,2,8);P.rect(im,4,3+oy,9,2,8);P.line(im,5,3+oy,11,3+oy,9) end
  if v==1 then P.p(im,12,4+oy,39);P.p(im,13,5+oy,40) end
  if action=='talk' then local hx=dir=='w' and 0 or 13;P.rect(im,hx,14+oy-frame*2,2,2,skin[3]);P.p(im,hx+1,15+oy-frame*2,skin[1]) end
  if moving and frame==2 then P.p(im,6,20+oy,3);P.p(im,10,19+oy,4);P.p(im,6,17+oy,ramp[1]) end
  return im
 end
end
