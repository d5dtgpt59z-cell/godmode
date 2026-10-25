-- Original96px portrait anatomy, hair and costume. Not enlarged sprites.
local R=dofile('/Users/ryanmorrison/Documents/Codex/2026-10-25/visit-https-cerebralvalley-ai-e-meta/outputs/godmode/art/cozy/character-refinement/v3/cast-v3.lua')
local P,C,rgb=R.P,R.C,R.rgb
local function eye(im,x,y,w,v,warm)
 local ink=v.hair[1];P.poly(im,{{x,y+2},{x+2,y},{x+w-3,y},{x+w,y+2},{x+w-2,y+5},{x+2,y+5}},v.skin[1]);P.poly(im,{{x+1,y+2},{x+3,y+1},{x+w-3,y+1},{x+w-1,y+3},{x+w-3,y+4},{x+2,y+4}},C.white)
 P.line(im,x,y+2,x+2,y,ink);P.line(im,x+2,y,x+w-3,y,ink);P.line(im,x+w-3,y,x+w,y+2,ink);P.p(im,x-1,y+1,ink)
 local iris=x+math.floor(w*.57);P.rect(im,iris-1,y+1,3,4,v.eye);P.line(im,iris,y+2,iris,y+4,C.ink);P.p(im,iris-1,y+1,C.white);P.p(im,iris+1,y+4,v.skin[3]);P.line(im,x+2,y+6,x+4,y+6,v.skin[2])
 if warm then P.p(im,x,y+3,v.skin[2]);P.p(im,x+w-1,y+3,v.skin[2]);P.p(im,x+1,y+4,v.skin[3])end
end
local function portrait(v,expression)
 local im=P.image(96,96);local warm=expression=='warm';local hair,skin,cloth=v.hair,v.skin,v.cloth
 -- Adult shoulder/neck structure and layers of fabric.
 P.poly(im,{{42,55},{58,55},{60,67},{74,73},{86,84},{90,95},{7,95},{12,82},{27,73},{39,67}},cloth[1])
 P.poly(im,{{41,56},{57,55},{58,68},{64,73},{50,82},{33,73},{42,65}},skin[1]);P.poly(im,{{45,58},{54,59},{55,70},{49,76},{41,70}},skin[2]);P.line(im,44,63,50,66,skin[3]);P.line(im,42,71,46,74,skin[3])
 P.poly(im,{{26,75},{37,70},{48,80},{62,71},{78,78},{86,95},{12,95},{16,82}},cloth[2]);P.poly(im,{{26,76},{34,74},{29,88},{17,94},{18,84}},cloth[3]);P.poly(im,{{68,76},{78,80},{87,95},{75,95},{72,86}},cloth[1]);P.line(im,22,86,27,84,cloth[4]);P.line(im,74,86,79,90,cloth[3]);P.line(im,32,91,36,87,cloth[1])
 if v.id=='player'then
  P.poly(im,{{36,69},{47,79},{41,87},{30,76}},C.cream);P.poly(im,{{58,69},{50,80},{57,86},{65,75}},C.cream);P.poly(im,{{44,79},{50,83},{54,79},{56,95},{43,95}},v.pants[2]);P.line(im,49,84,50,95,cloth[1]);P.ellipse(im,52,88,1,1,C.gold);P.ellipse(im,53,94,1,1,C.gold);P.rect(im,23,85,12,7,cloth[1]);P.line(im,24,85,33,85,cloth[4]);P.line(im,25,91,32,91,cloth[3])
 elseif v.id=='ada'then
  P.poly(im,{{29,75},{34,77},{37,95},{30,95}},v.accent);P.poly(im,{{65,74},{70,76},{66,95},{60,95}},v.accent);P.poly(im,{{35,85},{63,85},{69,95},{30,95}},v.accent);P.line(im,36,86,61,86,C.white);P.line(im,32,94,66,94,C.cream);P.line(im,31,79,33,89,C.white);P.line(im,65,79,63,87,C.cream);P.poly(im,{{15,85},{25,82},{28,90},{18,94},{12,92}},cloth[4]);P.line(im,17,86,24,84,C.white)
 elseif v.id=='mara'then
  P.poly(im,{{37,69},{49,78},{62,69},{59,81},{49,88},{39,80}},v.pants[1]);P.poly(im,{{39,71},{49,79},{58,73},{55,82},{49,85},{41,78}},v.pants[2]);P.ellipse(im,54,80,3,3,C.gold);P.ellipse(im,53,79,1,1,C.white);P.line(im,49,87,48,95,cloth[1]);P.p(im,51,91,C.gold);P.line(im,22,88,24,91,cloth[3]);P.line(im,27,87,29,90,cloth[3])
 else
  P.poly(im,{{39,67},{56,67},{67,74},{59,81},{43,77},{34,72}},v.accent);P.poly(im,{{54,77},{61,80},{68,92},{61,95},{54,84}},v.accent);P.line(im,41,70,50,73,rgb('db9580'));P.line(im,53,75,61,72,rgb('7c463f'));P.poly(im,{{27,74},{31,73},{74,95},{65,95}},C.leather);P.line(im,30,76,65,94,C.leatherhi);P.rect(im,60,87,6,5,C.gold);P.rect(im,61,88,4,3,C.leather);P.p(im,61,88,C.white)
 end
 -- Distinct hair masses also leave different neck/ear silhouettes.
 if v.id=='player'then P.poly(im,{{26,23},{32,13},{45,8},{61,11},{71,22},{74,38},{68,51},{60,57},{37,57},{27,48},{23,36}},hair[1]);P.poly(im,{{29,24},{35,16},{47,12},{60,16},{68,25},{69,40},{63,52},{37,53},{28,43}},hair[2])
 elseif v.id=='ada'then P.poly(im,{{26,21},{35,11},{50,8},{65,14},{73,27},{72,43},{65,55},{37,56},{27,45},{23,32}},hair[1]);P.poly(im,{{29,23},{36,15},{49,12},{63,18},{69,30},{67,46},{61,52},{37,52},{28,40}},hair[2])
 elseif v.id=='mara'then P.poly(im,{{26,22},{31,12},{44,7},{60,10},{71,20},{76,35},{72,56},{63,65},{34,64},{23,49},{22,34}},hair[1]);P.poly(im,{{27,24},{34,14},{45,10},{59,13},{68,22},{72,38},{67,55},{59,61},{35,59},{26,47},{25,34}},hair[2])
 else P.poly(im,{{26,22},{33,13},{47,8},{63,14},{72,26},{75,39},{69,53},{62,58},{35,59},{25,49},{22,34}},hair[1]);P.poly(im,{{29,24},{36,17},{48,13},{61,18},{68,28},{70,40},{64,53},{37,54},{28,43}},hair[2])end
 -- Individually drawn facial planes: cheek width, jaw length and nose are not recolors.
 if v.id=='ada'then
  P.poly(im,{{35,23},{48,18},{61,23},{68,37},{67,49},{62,58},{54,64},{44,65},{35,60},{29,50},{28,38}},skin[1]);P.poly(im,{{35,26},{47,22},{59,27},{64,38},{63,50},{58,59},{51,62},{43,61},{34,55},{31,44}},skin[2]);P.poly(im,{{36,27},{46,24},{52,30},{52,43},{47,50},{37,51},{32,43}},skin[3]);P.poly(im,{{38,28},{44,27},{48,31},{45,37},{37,37}},skin[4]);P.poly(im,{{32,44},{37,43},{42,48},{41,54},{35,53}},skin[3]);P.line(im,43,62,50,63,skin[3])
 elseif v.id=='mara'then
  P.poly(im,{{36,23},{48,19},{59,25},{64,39},{61,55},{54,67},{44,68},{36,61},{32,47}},skin[1]);P.poly(im,{{37,26},{47,23},{57,28},{60,41},{58,55},{53,64},{45,65},{38,58},{34,46}},skin[2]);P.poly(im,{{38,27},{45,25},{50,31},{50,43},{46,49},{38,49},{35,42}},skin[3]);P.poly(im,{{39,29},{44,28},{47,31},{45,36},{38,36}},skin[4]);P.line(im,43,64,49,66,skin[3]);P.line(im,58,50,56,56,skin[1])
 elseif v.id=='wren'then
  P.poly(im,{{34,22},{49,19},{63,24},{68,37},{67,51},{61,61},{54,66},{42,65},{32,57},{28,43}},skin[1]);P.poly(im,{{35,26},{48,23},{60,28},{64,39},{63,51},{58,60},{51,63},{42,61},{34,54},{31,43}},skin[2]);P.poly(im,{{36,27},{46,25},{52,30},{53,42},{48,48},{37,48},{32,41}},skin[3]);P.poly(im,{{38,29},{45,27},{49,31},{46,36},{37,36}},skin[4]);P.poly(im,{{33,45},{38,44},{42,49},{40,54},{35,52}},skin[3]);P.line(im,42,61,50,64,skin[3]);P.line(im,61,52,59,57,skin[1])
 else
  P.poly(im,{{35,23},{48,18},{61,24},{67,38},{64,52},{56,63},{44,65},{34,57},{30,44}},skin[1]);P.poly(im,{{36,25},{47,22},{58,26},{63,38},{60,52},{54,61},{45,62},{36,55},{32,43}},skin[2]);P.poly(im,{{37,26},{45,24},{51,29},{51,41},{47,49},{37,48},{34,40}},skin[3]);P.poly(im,{{38,29},{44,27},{47,30},{45,36},{38,36}},skin[4]);P.poly(im,{{34,43},{38,42},{41,47},{40,52},{36,51}},skin[3]);P.line(im,42,61,49,63,skin[3])
 end
 P.ellipse(im,29,43,3,6,skin[1]);P.ellipse(im,30,42,2,4,skin[2]);P.line(im,28,41,30,39,skin[3]);P.p(im,30,45,skin[3]);P.ellipse(im,66,43,2,5,skin[1]);P.line(im,66,41,66,45,skin[2])
 if v.id=='ada'then
  eye(im,34,39,12,v,warm);eye(im,55,39,9,v,warm);P.line(im,34,36,38,34,hair[2]);P.line(im,38,34,44,35,hair[2]);P.line(im,55,35,60,34,hair[2]);P.line(im,60,34,64,36,hair[2])
  P.line(im,50,44,49,49,skin[1]);P.line(im,49,45,48,49,skin[3]);P.line(im,48,50,52,51,skin[1]);P.p(im,52,49,skin[4]);P.p(im,53,50,skin[2])
  if warm then P.line(im,43,55,47,58,skin[1]);P.line(im,47,58,54,55,skin[1]);P.line(im,45,55,52,55,C.cream);P.line(im,46,57,51,57,skin[5])else P.line(im,44,56,48,57,skin[1]);P.line(im,48,57,53,55,skin[1]);P.line(im,46,59,50,59,skin[3])end
  P.line(im,33,49,38,51,skin[5]);P.line(im,60,51,64,49,skin[5]);for _,p in ipairs({{35,48},{38,50},{40,49},{60,48},{62,50}})do P.p(im,p[1],p[2],skin[1])end
 elseif v.id=='mara'then
  eye(im,35,40,9,v,warm);eye(im,54,41,7,v,warm);P.line(im,35,36,39,35,hair[1]);P.line(im,39,35,43,36,hair[2]);P.line(im,54,36,58,37,hair[1]);P.line(im,58,37,61,39,hair[2])
  P.line(im,50,42,49,53,skin[1]);P.line(im,49,44,48,51,skin[3]);P.line(im,48,54,51,55,skin[1]);P.p(im,52,53,skin[3]);P.p(im,50,52,skin[4])
  if warm then P.line(im,44,59,49,62,skin[1]);P.line(im,49,62,55,59,skin[1]);P.line(im,47,62,51,62,skin[5])else P.line(im,44,60,49,61,skin[1]);P.line(im,49,61,54,59,skin[1])end
  P.line(im,35,48,39,49,skin[1]);P.line(im,56,49,60,48,skin[1]);P.line(im,33,47,34,51,skin[1]);P.line(im,62,48,60,52,skin[1]);P.p(im,42,58,skin[1]);P.p(im,56,58,skin[1]);P.line(im,44,65,49,66,skin[2])
 elseif v.id=='wren'then
  eye(im,34,38,10,v,warm);eye(im,55,37,9,v,warm);P.line(im,34,35,38,33,hair[1]);P.line(im,38,33,43,34,hair[1]);P.line(im,55,32,60,31,hair[1]);P.line(im,60,31,64,34,hair[1]);P.p(im,54,33,hair[2])
  P.line(im,52,42,51,49,skin[1]);P.line(im,50,44,49,49,skin[3]);P.line(im,48,51,54,52,skin[1]);P.p(im,47,50,skin[1]);P.p(im,55,50,skin[1]);P.line(im,51,49,53,49,skin[4]);P.p(im,54,50,skin[3])
  if warm then P.line(im,42,55,47,60,skin[1]);P.line(im,47,60,58,55,skin[1]);P.line(im,45,56,55,56,C.cream);P.line(im,46,58,53,58,skin[5]);P.line(im,48,60,52,60,skin[3])else P.line(im,43,57,50,58,skin[1]);P.line(im,50,58,57,55,skin[1]);P.line(im,47,60,52,60,skin[3])end
  P.line(im,34,48,37,49,skin[5]);P.line(im,59,48,62,47,skin[5])
 else
  eye(im,34,38,11,v,warm);eye(im,54,38,9,v,warm);P.line(im,34,35,38,33,hair[2]);P.line(im,38,33,44,34,hair[2]);P.line(im,54,34,59,33,hair[2]);P.line(im,59,33,63,35,hair[2])
  P.line(im,50,43,49,50,skin[1]);P.line(im,49,44,48,49,skin[3]);P.line(im,48,51,52,52,skin[1]);P.p(im,52,50,skin[3]);P.p(im,50,49,skin[4])
  if warm then P.line(im,43,55,48,59,skin[1]);P.line(im,48,59,55,55,skin[1]);P.line(im,45,56,53,56,C.cream);P.line(im,47,58,51,58,skin[5])else P.line(im,44,56,49,57,skin[1]);P.line(im,49,57,54,55,skin[1]);P.line(im,46,59,50,59,skin[3])end;P.line(im,34,48,37,49,skin[5]);P.line(im,59,49,62,48,skin[5])
 end
 -- Hair front, with coherent curved highlight clusters rather than noise.
 if v.id=='player'then
  P.poly(im,{{26,25},{32,14},{46,11},{60,15},{68,25},{65,36},{61,31},{55,30},{50,26},{43,33},{37,29},{31,38}},hair[2]);P.line(im,31,27,35,23,hair[3]);P.poly(im,{{25,20},{30,10},{46,6},{62,11},{69,20},{69,25},{27,25}},cloth[1]);P.poly(im,{{31,12},{45,9},{58,13},{64,20},{29,20}},cloth[2]);P.line(im,33,13,45,11,cloth[3]);P.line(im,45,11,55,13,cloth[4]);P.poly(im,{{31,24},{63,23},{77,28},{74,31},{39,28}},cloth[1]);P.line(im,40,25,66,25,cloth[3]);P.rect(im,62,20,4,3,C.gold);P.p(im,63,20,C.white)
 elseif v.id=='ada'then
  P.ellipse(im,67,17,10,10,hair[1]);P.ellipse(im,66,15,8,7,hair[2]);P.line(im,62,11,67,9,hair[3]);P.line(im,67,9,72,13,hair[4]);P.line(im,61,16,64,20,hair[3]);P.line(im,65,22,70,19,hair[3]);P.poly(im,{{27,29},{31,19},{43,13},{55,16},{67,24},{69,36},{62,31},{55,28},{49,22},{43,29},{36,28},{30,40}},hair[2]);P.poly(im,{{32,23},{42,16},{49,17},{41,24},{35,27}},hair[3]);P.line(im,35,22,40,19,hair[4]);P.poly(im,{{26,33},{30,29},{33,37},{31,44},{34,53},{30,59},{25,49}},hair[2]);P.line(im,27,38,28,44,hair[3]);P.line(im,29,48,31,53,hair[3]);P.poly(im,{{66,29},{71,34},{73,45},{68,56},{65,50},{68,41}},hair[2]);P.line(im,69,35,70,41,hair[3]);P.p(im,62,24,C.cream);P.p(im,63,25,C.cream)
 elseif v.id=='mara'then
  P.poly(im,{{23,37},{25,25},{34,13},{52,8},{66,15},{73,28},{70,43},{65,37},{59,25},{49,22},{40,29},{34,27},{29,44}},hair[2]);P.poly(im,{{27,28},{34,17},{48,12},{60,16},{63,21},{52,18},{43,22},{35,25}},hair[3]);P.line(im,34,20,40,16,hair[4]);P.line(im,40,16,49,14,hair[4]);P.line(im,55,14,62,18,hair[4]);P.line(im,65,24,68,32,hair[3]);P.line(im,25,34,27,40,hair[3]);
  for i=0,4 do local x=27+(i%2==0 and -1 or 1);local y=51+i*7;P.ellipse(im,x,y,5,6,hair[1]);P.ellipse(im,x-1,y-1,4,5,hair[2]);P.line(im,x-3,y-2,x,y-4,hair[3]);P.line(im,x,y-4,x+2,y-1,hair[4]);P.line(im,x+1,y+1,x-1,y+3,hair[1])end;P.line(im,24,85,30,85,v.accent);P.line(im,25,86,29,86,C.gold);P.poly(im,{{25,87},{29,87},{30,92},{27,91},{24,93}},hair[2])
 else
  for _,a in ipairs({{29,28,7,9},{33,18,8,9},{46,13,9,8},{58,15,10,8},{68,25,9,10},{70,39,5,9}})do P.ellipse(im,a[1],a[2],a[3],a[4],hair[1]);P.ellipse(im,a[1]-1,a[2]-2,a[3]-2,a[4]-2,hair[2]);P.line(im,a[1]-3,a[2]-5,a[1],a[2]-6,hair[3]);P.p(im,a[1]-2,a[2]-5,hair[4])end
  for _,a in ipairs({{35,29},{43,27},{52,27},{61,30}})do P.ellipse(im,a[1],a[2],5,5,hair[1]);P.ellipse(im,a[1]-1,a[2]-1,3,3,hair[2]);P.line(im,a[1]-2,a[2]-2,a[1],a[2]-3,hair[3])end;P.line(im,27,45,28,49,hair[2]);P.line(im,66,45,65,49,hair[1])
 end
 return im
end
R.portrait=portrait;return R
