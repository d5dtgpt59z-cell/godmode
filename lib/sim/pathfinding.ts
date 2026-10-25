import type { Point, WorldState } from './contracts';
import { FORD_Y, RIVER_X, isWalkable } from './scenario';
export const distance=(a:Point,b:Point)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
/** Stable orthogonal shortest path; the river has one actual crossing. */
export function findPath(world:Pick<WorldState,'width'|'height'|'crossing'|'tick'>,from:Point,to:Point):Point[]|null {
  if(!isWalkable(world,to.x,to.y))return null;
  if(from.x===to.x&&from.y===to.y)return [];
  // This town has no hidden collider geometry: Manhattan segments plus its one ford.
  const route:Point[]=[];let x=from.x,y=from.y;
  const line=(tx:number,ty:number)=>{while(x!==tx||y!==ty){if(x!==tx)x+=x<tx?1:-1;else y+=y<ty?1:-1;if(!isWalkable(world,x,y))return false;route.push({x,y});}return true;};
  if((from.x<RIVER_X&&to.x>RIVER_X)||(from.x>RIVER_X&&to.x<RIVER_X)||from.x===RIVER_X||to.x===RIVER_X){
    if(!isWalkable(world,RIVER_X,FORD_Y))return null;
    if(!line(from.x===RIVER_X?from.x:(from.x<RIVER_X?RIVER_X-1:RIVER_X+1),FORD_Y))return null;
    if(!line(to.x<RIVER_X?RIVER_X-1:to.x>RIVER_X?RIVER_X+1:RIVER_X,FORD_Y))return null;
  }
  if(!line(to.x,to.y))return null;return route;
}
