"use client";
import {useEffect,useRef} from "react";
import type {Actor,CozyWorldState,Point} from "@/lib/cozy/contracts";
import {COZY_MAP} from "@/lib/cozy/world";
import {sampleSpriteFrame,type SpriteClip} from "./sprite-animation";
import {WORLD_ASSETS} from "@/lib/cozy/world-objects";

type Props={state:CozyWorldState;paused:boolean;tool:string;zoom:number;selected:string|null;inputLocked:boolean;onGround:(point:Point)=>void;onActor:(id:string)=>void;onPlot:(id:string)=>void;onPlace:(id:string)=>void;onObject?:(id:string)=>void;onReady:()=>void};
type Atlas={frames:Record<string,{frame:{x:number;y:number;w:number;h:number};pixelAnchor?:Point;anchor?:Point;duration?:number}>;animations?:Record<string,SpriteClip>;meta?:{cargoPixelAnchor?:Point}};
const TILE=16;
const foot=(p:Point)=>({x:p.x*TILE+8,y:p.y*TILE+12});
export default function CozyStage(props:Props){
 const host=useRef<HTMLDivElement>(null),latest=useRef(props),scene=useRef<{sync:()=>void}|null>(null);latest.current=props;
 useEffect(()=>{
  let disposed=false,game:import("phaser").Game|undefined;
  void import("phaser").then(({default:Phaser})=>{
   if(disposed||!host.current)return;
   class Neighborhood extends Phaser.Scene{
    actors=new Map<string,{sprite:import("phaser").GameObjects.Sprite;name:import("phaser").GameObjects.Text;shadow:import("phaser").GameObjects.Ellipse;cargo:import("phaser").GameObjects.Image;socialFx:import("phaser").GameObjects.Image;from:Point;to:Point;changed:number;physical:Actor;facing:string;animation:string;animationStarted:number}>();
    crops=new Map<string,import("phaser").GameObjects.Image>();
    plotZones=new Map<string,import("phaser").GameObjects.Zone>();
    worldObjects=new Map<string,import("phaser").GameObjects.Image>();
    flood!:import("phaser").GameObjects.Graphics;selection!:import("phaser").GameObjects.Graphics;tone!:import("phaser").GameObjects.Rectangle;table!:import("phaser").GameObjects.Image;bunting!:import("phaser").GameObjects.Image;
    last:CozyWorldState|null=null;lastZoom=0;ready=false;dragged=false;lastEffect=0;panUntil=0;
    constructor(){super("cozy-neighborhood");}
    preload(){
     this.load.image("cozy-map","/assets/cozy/map.png?v=cast-4");
     this.load.atlas("cozy-people","/assets/cozy/characters.png?v=cast-4","/assets/cozy/characters.json?v=cast-4");
     this.load.json("cozy-people-meta","/assets/cozy/characters.json?v=cast-4");
     this.load.atlas("cozy-foreground","/assets/cozy/foreground.png?v=cast-4","/assets/cozy/foreground.json?v=cast-4");
     this.load.json("cozy-foreground-meta","/assets/cozy/foreground.json?v=cast-4");
     this.load.atlas("fallback-people","/assets/characters.png","/assets/characters.json");
    }
    has(texture:string,frame:string){return this.textures.exists(texture)&&this.textures.get(texture).has(frame);}
    frame(texture:string,candidates:string[]){return candidates.find(k=>this.has(texture,k))??"__BASE";}
    anchored<T extends import("phaser").GameObjects.Image|import("phaser").GameObjects.Sprite>(sprite:T,texture:string,key:string):T{
     const meta=this.cache.json.get(texture+"-meta") as Atlas|undefined;
     const f=meta?.frames?.[key];const pivot=f?.pixelAnchor;
     // setFrame applies atlas pivots; reset the intended normalized origin every time.
     sprite.setOrigin(pivot&&f?pivot.x/f.frame.w:.5,pivot&&f?pivot.y/f.frame.h:1);return sprite;
    }
    create(){
     const width=COZY_MAP.width*TILE,height=COZY_MAP.height*TILE;this.cameras.main.setBounds(0,0,width,height);
     if(this.textures.exists("cozy-map"))this.add.image(0,0,"cozy-map").setOrigin(0).setDisplaySize(width,height).setDepth(-100);
     else{
      const g=this.add.graphics().setDepth(-100);g.fillStyle(0x7c975b);g.fillRect(0,0,width,height);
      g.fillStyle(0xbca477);for(const p of COZY_MAP.places)g.fillRoundedRect(p.position.x*TILE-24,p.position.y*TILE-20,64,40,8);
      g.fillStyle(0x508c93);g.fillRect(COZY_MAP.riverX*TILE,0,TILE,height);g.fillStyle(0xa98e5b);g.fillRect((COZY_MAP.riverX-1)*TILE,COZY_MAP.bridgeY*TILE,3*TILE,TILE);
      for(const b of COZY_MAP.buildings){g.fillStyle(0xe6d1a5);g.fillRect(b.x*TILE,b.y*TILE,b.width*TILE,b.height*TILE);g.fillStyle(0x385e67);g.fillRect(b.x*TILE,b.y*TILE,b.width*TILE,10);}
     }
     this.flood=this.add.graphics().setDepth(-20);this.selection=this.add.graphics().setDepth(2000);
     this.tone=this.add.rectangle(0,0,width,height,0x263458,0).setOrigin(0).setDepth(2100);
     if(this.textures.exists("cozy-foreground")){const key=this.frame("cozy-foreground",["festival.empty"]);this.table=this.anchored(this.add.image(0,0,"cozy-foreground",key),"cozy-foreground",key);const flags=this.frame("cozy-foreground",["festival.bunting","bunting"]);this.bunting=this.anchored(this.add.image(0,0,"cozy-foreground",flags),"cozy-foreground",flags).setVisible(false);const meta=this.cache.json.get("cozy-foreground-meta") as Atlas|undefined;for(const [name,animation]of Object.entries(meta?.animations??{}))if(!this.anims.exists("cozy-"+name))this.anims.create({key:"cozy-"+name,frames:animation.frames.map(frame=>({key:"cozy-foreground",frame})),frameRate:1000/animation.duration,repeat:0});}
     for(const plot of COZY_MAP.plots){
      const p=plot.visualAnchor;if(this.textures.exists("cozy-foreground"))this.crops.set(plot.id,this.anchored(this.add.image(p.x,p.y,"cozy-foreground",this.frame("cozy-foreground",["crop.empty"])),"cozy-foreground","crop.empty").setDepth(p.y));
      const zone=this.add.zone(p.x-12,p.y-24,24,28).setOrigin(0).setDepth(1100).setInteractive({useHandCursor:true});
      this.plotZones.set(plot.id,zone);
      zone.on("pointerup",(pointer:import("phaser").Input.Pointer)=>{if(pointer.event?.target===this.game.canvas&&!this.dragged&&!latest.current.inputLocked)latest.current.onPlot(plot.id);});
     }
     for(const place of COZY_MAP.places){const building=COZY_MAP.buildings.find(b=>b.id===place.id);const custom=place.id==="well"?{x:112,y:160,w:48,h:64}:place.id==="woodpile"?{x:44,y:144,w:64,h:48}:place.id==="square"?{x:200,y:232,w:64,h:40}:null;const bounds=custom??(building?{x:building.x*TILE,y:building.y*TILE,w:building.width*TILE,h:building.height*TILE}:{x:place.position.x*TILE,y:place.position.y*TILE,w:TILE,h:TILE});const zone=this.add.zone(bounds.x,bounds.y,bounds.w,bounds.h).setOrigin(0).setDepth(-1).setInteractive({useHandCursor:true});zone.on("pointerup",(pointer:import("phaser").Input.Pointer)=>{if(pointer.event?.target===this.game.canvas&&!this.dragged&&!latest.current.inputLocked)latest.current.onPlace(place.id);});}
     this.input.on("pointerdown",()=>{this.dragged=false;});
     this.input.on("pointermove",(p:import("phaser").Input.Pointer)=>{if(!p.isDown||latest.current.inputLocked)return;const dx=p.x-p.prevPosition.x,dy=p.y-p.prevPosition.y;if(Math.abs(dx)+Math.abs(dy)>4)this.dragged=true;if(this.dragged){this.panUntil=this.time.now+5000;this.cameras.main.scrollX-=dx/this.cameras.main.zoom;this.cameras.main.scrollY-=dy/this.cameras.main.zoom;}});
     this.input.on("pointerup",(p:import("phaser").Input.Pointer,hits:unknown[])=>{if(p.event?.target!==this.game.canvas||this.dragged||hits.length||latest.current.inputLocked)return;latest.current.onGround({x:Math.floor(p.worldX/TILE),y:Math.floor(p.worldY/TILE)});});
     this.scale.on("resize",()=>{this.lastZoom=0;this.sync();});scene.current=this;this.ready=true;this.sync();latest.current.onReady();
    }
    sync(){
     if(!this.ready)return;const {state,zoom}=latest.current;
     // Share the designer's HUD budget so a compact toolbelt gives space back to the world.
     const configuredInset=host.current?Number.parseFloat(getComputedStyle(host.current).getPropertyValue("--cozy-playfield-inset")):NaN;
     const bottomInset=Number.isFinite(configuredInset)?Math.min(240,Math.max(0,configuredInset)):155;
     this.cameras.main.setViewport(0,0,this.scale.width,Math.max(200,this.scale.height-bottomInset));
     const effectiveZoom=Math.max(zoom,this.scale.width/(COZY_MAP.width*TILE),this.cameras.main.height/(COZY_MAP.height*TILE));
     if(effectiveZoom!==this.lastZoom){this.lastZoom=effectiveZoom;this.cameras.main.setZoom(effectiveZoom);const p=foot(state.player);this.cameras.main.centerOn(p.x,p.y);}
     const discontinuity=this.last&&(state.branchId!==this.last.branchId||state.step<this.last.step);
     const all=[state.player,...state.npcs],ids=new Set(all.map(a=>a.id));
     for(const [id,body]of this.actors)if(!ids.has(id as typeof state.player.id)){body.sprite.destroy();body.name.destroy();body.shadow.destroy();body.cargo.destroy();body.socialFx.destroy();this.actors.delete(id);}
     for(const actor of all){
      const p=foot(actor);let body=this.actors.get(actor.id);
      if(!body){const texture=this.textures.exists("cozy-people")?"cozy-people":"fallback-people";const id=actor.id==="player"?"kitt":actor.id;
       const key=texture==="cozy-people"?this.frame(texture,[actor.id+".idle.s.0",actor.id+".walk.s.0"]):id+".idle.s.0";
       const shadow=this.add.ellipse(p.x,p.y+1,11,4,0x273c37,.24);const sprite=this.anchored(this.add.sprite(p.x,p.y,texture,key),texture,key);if(actor.id!=="player")sprite.setInteractive({useHandCursor:true,pixelPerfect:true,alphaTolerance:64});
       sprite.on("pointerup",(pointer:import("phaser").Input.Pointer)=>{if(pointer.event?.target===this.game.canvas&&!this.dragged&&!latest.current.inputLocked)latest.current.onActor(actor.id);});
       const name=this.add.text(p.x,p.y-36,actor.name,{fontFamily:"Georgia",fontSize:"8px",color:"#fff4d7",stroke:"#2d483e",strokeThickness:2}).setOrigin(.5).setDepth(2200);
       const cargo=this.add.image(p.x,p.y-13,this.textures.exists("cozy-foreground")?"cozy-foreground":texture,this.textures.exists("cozy-foreground")?this.frame("cozy-foreground",["carry.grain"]):key).setVisible(false);
       const socialFx=this.add.image(p.x,p.y-35,texture,key).setVisible(false).setOrigin(.5).setDepth(2250);
       body={sprite,name,shadow,cargo,socialFx,from:p,to:p,changed:this.time.now,physical:actor,facing:"s",animation:"",animationStarted:this.time.now};this.actors.set(actor.id,body);
      }
      if(discontinuity){body.from=p;body.to=p;body.changed=this.time.now;}else if(actor.x!==body.physical.x||actor.y!==body.physical.y){body.from={x:body.sprite.x,y:body.sprite.y};body.to=p;body.changed=this.time.now;}
      body.physical=actor;
     }
     for(const plot of state.plots){const sprite=this.crops.get(plot.id);if(sprite){const key=this.frame("cozy-foreground",["crop."+plot.phase,"crop.empty"]);this.anchored(sprite.setFrame(key),"cozy-foreground",key);}this.plotZones.get(plot.id)?.setDepth(["plant","water","harvest"].includes(latest.current.tool)?1100:-.5);}
     const introduced=state.worldObjects??[],objectIds=new Set(introduced.map(object=>object.id));
     for(const [id,sprite]of this.worldObjects)if(!objectIds.has(id)){sprite.destroy();this.worldObjects.delete(id);}
     for(const object of introduced){const key=WORLD_ASSETS[object.assetId]?.frame;if(!key||!this.has("cozy-foreground",key))continue;let sprite=this.worldObjects.get(object.id);if(!sprite){sprite=this.anchored(this.add.image(0,0,"cozy-foreground",key),"cozy-foreground",key).setInteractive({useHandCursor:true,pixelPerfect:true,alphaTolerance:64});sprite.on("pointerup",(pointer:import("phaser").Input.Pointer)=>{if(pointer.event?.target===this.game.canvas&&!this.dragged&&!latest.current.inputLocked)latest.current.onObject?.(object.id);});this.worldObjects.set(object.id,sprite);}const p=foot(object.position);sprite.setPosition(p.x,p.y).setDepth(p.y-.25);}
     if(this.table){const p=COZY_MAP.festivalVisualAnchors[state.festival.venue];const ready=state.festival.phase==="celebrating";const key=this.frame("cozy-foreground",[ready?"festival.ready":"festival.empty"]);this.anchored(this.table.setFrame(key),"cozy-foreground",key).setPosition(p.x,p.y).setDepth(p.y-4).setVisible(state.festival.venue==="square"||ready);this.bunting.setPosition(p.x,p.y-22).setDepth(p.y-5).setVisible(state.festival.setupDone);}
     if(this.last)for(const event of state.events.filter(e=>e.seq>this.lastEffect&&e.audience.includes("player"))){if(event.type==="crop_watered"||event.type==="crop_harvested"){const plot=COZY_MAP.plots.find(p=>p.id===event.payload.plotId);const animation="cozy-fx."+(event.type==="crop_watered"?"water":"harvest");if(plot&&this.anims.exists(animation)){const effect=this.add.sprite(plot.visualAnchor.x,plot.visualAnchor.y,"cozy-foreground").setDepth(1600);effect.play(animation);effect.once("animationcomplete",()=>effect.destroy());}}}
     this.lastEffect=state.eventSeq;this.last=state;
    }
    update(time:number){
     if(!this.ready)return;if(this.last!==latest.current.state)this.sync();const {state,selected}=latest.current;
     this.selection.clear();this.flood.clear();
     if(state.flood.active){for(const p of COZY_MAP.floodZone.cells){this.flood.fillStyle(0x6eb3b7,.7);this.flood.fillRect(p.x*TILE,p.y*TILE,TILE,TILE);this.flood.lineStyle(1,0xc1e3d1,.55);this.flood.lineBetween(p.x*TILE+2,p.y*TILE+8+(Math.floor(time/300)%2),p.x*TILE+11,p.y*TILE+8+(Math.floor(time/300)%2));}}
     for(const [id,body]of this.actors){
      const a=body.physical,t=Math.min(1,(time-body.changed)/450);
      let x=body.from.x+(body.to.x-body.from.x)*t,y=body.from.y+(body.to.y-body.from.y)*t;
      // Bounded visual anticipation follows an already accepted route. It never changes physical state or inventory.
      if(id==="player"&&t===1&&a.path.length&&!latest.current.inputLocked&&!latest.current.paused){const next=foot(a.path[0]);const d=Math.abs(next.x-x)+Math.abs(next.y-y);if(d>0){const ahead=Math.min(1,Math.max(0,(time-body.changed-450)/500));x+=(next.x-x)*ahead;y+=(next.y-y)*ahead;}}
      // Rounded render positions can reverse tiny deltas. Face the accepted trajectory instead.
      const next=t>=1&&a.path.length?foot(a.path[0]):body.to;
      const dx=next.x-(t>=1?body.to.x:body.from.x),dy=next.y-(t>=1?body.to.y:body.from.y);
      const walking=!latest.current.paused&&(t<1&&Math.abs(dx)+Math.abs(dy)>.05||a.path.length>0);
      if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>.02)body.facing=dx>0?"e":"w";else if(Math.abs(dy)>.02)body.facing=dy>0?"s":"n";
      const pair=state.activities?.programs.map(program=>program.activePair).find(pair=>pair?.started&&(pair.left===id||pair.right===id));
      const other=pair?state.npcs.find(npc=>npc.id===(pair.left===id?pair.right:pair.left)):null;
      if(pair&&other){const towardX=other.x-a.x,towardY=other.y-a.y;if(Math.abs(towardX)>Math.abs(towardY))body.facing=towardX>0?"e":"w";else if(Math.abs(towardY)>.01)body.facing=towardY>0?"s":"n";if(!latest.current.paused){const lean=pair.gesture==="dance"?Math.sin(time/150)*.8:1.5;x+=Math.sign(towardX)*lean;y+=Math.sign(towardY)*lean;}}
      const good=a.task?.kind==="food"&&a.task.phase==="deliver"&&a.inventory.grain>0?"grain":a.task?.kind==="setup"&&a.task.phase!=="fetch"&&a.inventory.timber>0?"timber":null;
      const action=latest.current.paused?"idle":walking?(good?"carry":"walk"):pair?(pair.gesture==="dance"?"walk":"talk"):/baking|setting|prepar|working|watering|plant|harvest|eating/i.test(a.action)?"work":/talk|greet|inviting/i.test(a.action)?"talk":/rest|sleep/i.test(a.action)?"rest":"idle";
      const texture=body.sprite.texture.key;const aid=texture==="fallback-people"?(id==="player"?"kitt":id):id;
      const clipKey=aid+"."+action+"."+body.facing;
      if(body.animation!==clipKey){body.animation=clipKey;body.animationStarted=time-(action==="idle"?({player:0,ada:310,mara:710,wren:1130}[a.id]??0):0);}
      const elapsed=time-body.animationStarted,meta=this.cache.json.get(texture+"-meta") as Atlas|undefined;
      const index=Math.floor(elapsed/(walking?150:650))%(walking?4:2);
      const key=this.frame(texture,[sampleSpriteFrame(meta?.animations?.[clipKey],elapsed)??"",clipKey+"."+index,aid+".walk."+body.facing+"."+index,aid+".idle.s.0"]);
      if(key!=="__BASE")this.anchored(body.sprite.setFrame(key),texture,key);
      body.sprite.setPosition(Math.round(x),Math.round(y)).setDepth(y+(id==="player"?.5:0));body.shadow.setPosition(x,y+1).setDepth(y-1);body.name.setPosition(x,y-35).setVisible(!pair&&(id!=="player"||selected===id));
      const effectKey=pair?`social.${pair.gesture==="dance"?"dance":"heart"}.${latest.current.paused?0:Math.floor(time/180)%4}`:null;
      body.socialFx.setVisible(!!pair&&pair.left===id&&!!other&&!!effectKey&&this.has("cozy-foreground",effectKey));if(body.socialFx.visible&&other&&effectKey)body.socialFx.setTexture("cozy-foreground",effectKey).setPosition((a.x+other.x)/2*TILE+8,(a.y+other.y)/2*TILE-24);
      const cargoKey=good?this.frame("cozy-foreground",["carry."+good]):"__BASE";
      body.cargo.setVisible(walking&&good!==null&&cargoKey!=="__BASE"&&this.textures.exists("cozy-foreground"));if(body.cargo.visible){const hand=meta?.meta?.cargoPixelAnchor??{x:12,y:22},pivot=meta?.frames[key]?.pixelAnchor??{x:12,y:31};this.anchored(body.cargo.setTexture("cozy-foreground",cargoKey),"cozy-foreground",cargoKey).setPosition(x+hand.x-pivot.x,y+hand.y-pivot.y).setDepth(body.sprite.depth+(body.facing==="n"?-.1:.1));}
      if(id===selected){this.selection.lineStyle(1,0xffe3a1,.9);this.selection.strokeEllipse(x,y+1,16,6);}
     }
     const playerBody=this.actors.get("player");if(playerBody&&(state.player.path.length>0||time>this.panUntil)){const c=this.cameras.main;c.scrollX=Phaser.Math.Linear(c.scrollX,playerBody.sprite.x-c.width/2,.12);c.scrollY=Phaser.Math.Linear(c.scrollY,playerBody.sprite.y-c.height/2,.12);}
     // Calendar light repeats at dawn instead of accumulating opacity across persistent days.
     const hour=(8+state.tick/3600)%24,night=hour>=20?Math.min(1,(hour-20)/2):hour<6?1:hour<8?(8-hour)/2:0;this.tone.setAlpha(Math.min(.3,night*.3));
    }
   }
   game=new Phaser.Game({type:Phaser.AUTO,parent:host.current,pixelArt:true,roundPixels:true,antialias:false,backgroundColor:"#78905a",audio:{noAudio:true},input:{keyboard:false},banner:false,scale:{mode:Phaser.Scale.RESIZE,width:host.current.clientWidth,height:host.current.clientHeight},scene:Neighborhood});
  });return()=>{disposed=true;scene.current=null;game?.destroy(true);};
 },[]);
 useEffect(()=>{scene.current?.sync();},[props.state,props.zoom,props.tool]);
 return <div className="cozy-stage" ref={host} role="img" aria-label="A playable garden neighborhood. Click a path to walk, a wheat plot to tend it, or a villager to interact."/>;
}
