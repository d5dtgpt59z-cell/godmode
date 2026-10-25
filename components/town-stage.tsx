"use client";

import { useEffect, useRef } from "react";
import type { Agent, ObserverView, Place, Point } from "@/lib/sim/contracts";
import { findPath } from "@/lib/sim/pathfinding";

type Props = {
  view: ObserverView;
  selectedId: string | null;
  followId: string | null;
  claimId: string | null;
  zoom: number;
  onAgent: (id: string) => void;
  onPlace: (id: string) => void;
  onGround: (point: { x: number; y: number }) => void;
  onReady?: () => void;
};

const TILE = 16;
const TILE_W = 64;
const TILE_H = 48;
const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
type AtlasData = {
  frames: Record<string, { frame: { w: number; h: number }; anchor?: Point; pixelAnchor?: Point; duration?: number }>;
  animations: Record<string, { frames: string[]; duration: number }>;
  meta?: { cargoAnchor?: Point };
};
const feet = (point: Point): Point => ({ x: point.x * TILE + 8, y: point.y * TILE + 8 });
const segmentLength = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export default function TownStage(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const sceneRef = useRef<{ sync: () => void; destroy?: () => void } | null>(null);

  useEffect(() => {
    let disposed = false;
    let game: import("phaser").Game | undefined;
    void import("phaser").then(({ default: Phaser }) => {
      if (disposed || !host.current) return;
      class TownScene extends Phaser.Scene {
        people = new Map<string, { sprite: import("phaser").GameObjects.Sprite; cargo: import("phaser").GameObjects.Image[]; physical: Agent; route: Point[]; routeLength: number; facing: string; changed: number; name: import("phaser").GameObjects.Text }>();
        buildings = new Map<string, import("phaser").GameObjects.Image>();
        ground!: import("phaser").GameObjects.Graphics;
        lines!: import("phaser").GameObjects.Graphics;
        rain!: import("phaser").GameObjects.Graphics;
        selector!: import("phaser").GameObjects.Graphics;
        tone!: import("phaser").GameObjects.Rectangle;
        crossing!: import("phaser").GameObjects.Image;
        crossingState = "";
        lastView: ObserverView | null = null;
        lastZoom = -1;
        dragged = false;
        frameKeys: string[] = [];
        ready = false;
        constructor() { super("bellwether"); }
        preload() {
          this.load.atlas("characters", "/assets/characters.png", "/assets/characters.json");
          this.load.atlas("town", "/assets/town.png", "/assets/town.json");
          this.load.atlas("objects", "/assets/objects.png", "/assets/objects.json");
          for (const name of ["characters", "town", "objects"]) this.load.json(`${name}-metadata`, `/assets/${name}.json`);
        }
        frame(texture: string, candidates: string[], contains?: string) {
          const t = this.textures.get(texture);
          for (const key of candidates) if (t.has(key)) return key;
          return t.getFrameNames().find((key) => contains && key.includes(contains)) ?? "__BASE";
        }
        anchored<T extends import("phaser").GameObjects.Image | import("phaser").GameObjects.Sprite>(sprite: T, texture: string, key: string): T {
          const cell = (this.cache.json.get(`${texture}-metadata`) as AtlasData | undefined)?.frames[key];
          if (cell?.pixelAnchor) sprite.setOrigin(cell.pixelAnchor.x / cell.frame.w, cell.pixelAnchor.y / cell.frame.h);
          else if (cell?.anchor) sprite.setOrigin(cell.anchor.x <= 1 ? cell.anchor.x : cell.anchor.x / cell.frame.w, cell.anchor.y <= 1 ? cell.anchor.y : cell.anchor.y / cell.frame.h);
          else sprite.setOrigin(0.5, 1);
          return sprite;
        }
        pose(id: string, action: string, facing: string, time: number, hold = false): string {
          const data = this.cache.json.get("characters-metadata") as AtlasData | undefined;
          const animation = data?.animations[`${id}.${action}.${facing}`];
          if (animation?.frames.length) {
            const durations = animation.frames.map(key => data?.frames[key]?.duration ?? animation.duration);
            let elapsed = hold ? 0 : time % durations.reduce((sum, duration) => sum + duration, 0);
            for (let i = 0; i < animation.frames.length; i++) { if (elapsed < durations[i]) return animation.frames[i]; elapsed -= durations[i]; }
            return animation.frames[0];
          }
          return this.frame("characters", [`${id}.${action}.${facing}.0`, `${id}.idle.${facing}.0`], id + ".");
        }
        sample(body: { route: Point[]; routeLength: number; changed: number; facing: string }, now: number) {
          let progress = Math.min(1, Math.max(0, (now - body.changed) / 900)) * body.routeLength;
          for (let i = 1; i < body.route.length; i++) {
            const from = body.route[i - 1], to = body.route[i], distance = segmentLength(from, to);
            if (distance > 0 && progress < distance) {
              const t = progress / distance;
              return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, facing: to.x === from.x ? to.y > from.y ? "s" : "n" : to.x > from.x ? "e" : "w", moving: true, remaining: body.route.slice(i) };
            }
            progress -= distance;
          }
          const point = body.route[body.route.length - 1];
          return { ...point, facing: body.facing, moving: false, remaining: [] as Point[] };
        }
        physicalRoute(previous: Agent, next: Agent, view: ObserverView): Point[] | null {
          const planned = previous.intent?.path ?? [];
          const index = planned.findIndex(point => point.x === next.x && point.y === next.y);
          if (index >= 0) return planned.slice(0, index + 1);
          // This is visual interpolation only. It never issues a movement or changes agent state.
          // A prior intent can have completed or changed between server snapshots; use the
          // town's actual ford geometry rather than drawing a straight line through water.
          const world = { width: view.width, height: view.height, crossing: view.crossing, tick: view.tick };
          return findPath(world, previous, next) ?? (this.lastView ? findPath({ width: this.lastView.width, height: this.lastView.height, crossing: this.lastView.crossing, tick: this.lastView.tick }, previous, next) : null);
        }
        create() {
          this.cameras.main.setBounds(0, 0, TILE_W * TILE, TILE_H * TILE);
          this.cameras.main.setBackgroundColor("#72844d");
          this.ground = this.add.graphics().setDepth(-100);
          this.drawGround();
          this.lines = this.add.graphics().setDepth(2000);
          this.selector = this.add.graphics().setDepth(2001);
          this.rain = this.add.graphics().setDepth(2100);
          this.tone = this.add.rectangle(0, 0, TILE_W * TILE, TILE_H * TILE, 0x8b5176, 0).setOrigin(0).setDepth(2050);
          const crossingFrame = this.frame("town", ["crossing.ford", "ford.dry"], "ford");
          this.crossing = this.anchored(this.add.image(32 * TILE + 8, 24 * TILE + 8, "town", crossingFrame), "town", crossingFrame).setDepth(24 * TILE + 8);
          this.input.on("pointerdown", () => { this.dragged = false; });
          this.input.on("pointermove", (p: import("phaser").Input.Pointer) => {
            if (!p.isDown || latest.current.followId) return;
            const dx = p.x - p.prevPosition.x, dy = p.y - p.prevPosition.y;
            if (Math.abs(dx) + Math.abs(dy) > 2) this.dragged = true;
            if (this.dragged) { this.cameras.main.scrollX -= dx / this.cameras.main.zoom; this.cameras.main.scrollY -= dy / this.cameras.main.zoom; }
          });
          this.input.on("pointerup", (p: import("phaser").Input.Pointer, hit: unknown[]) => {
            if (p.event?.target !== this.game.canvas || this.dragged || hit.length) return;
            latest.current.onGround({ x: Math.floor(p.worldX / TILE), y: Math.floor(p.worldY / TILE) });
          });
          this.input.on("wheel", (_p: unknown, _g: unknown, _dx: number, dy: number) => {
            const c = this.cameras.main;
            c.setZoom(Phaser.Math.Clamp(c.zoom + (dy > 0 ? -0.25 : 0.25), 1, 5));
          });
          const keys = this.input.keyboard?.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") as Record<string, import("phaser").Input.Keyboard.Key> | undefined;
          this.registry.set("panKeys", keys);
          this.scale.on("resize", () => this.sync());
          sceneRef.current = this;
          this.sync();
          this.cameras.main.centerOn(32 * TILE, 24 * TILE);
          this.ready = true;
          latest.current.onReady?.();
        }
        drawGround() {
          const g = this.ground;
          const road = (x: number, y: number) => (y >= 23 && y <= 25) || (x >= 42 && x <= 44 && y >= 10 && y <= 35) || (x >= 14 && x <= 16 && y >= 10 && y <= 35) || (y >= 29 && y <= 31 && x >= 16 && x <= 29);
          for (let y = 0; y < TILE_H; y++) for (let x = 0; x < TILE_W; x++) {
            const n = hash(x, y);
            const water = x === 32 && y !== 24;
            const isRoad = !water && road(x, y);
            const frames = water ? ["terrain.water.0", "water.0"] : x === 31 && y !== 24 ? ["terrain.bank.e"] : x === 33 && y !== 24 ? ["terrain.bank.w"] : isRoad ? [`terrain.path.${n % 3}`, "terrain.path.0", "terrain.path", "path.0"] : [`terrain.grass.${n % 3}`, "terrain.grass.0", "grass.0"];
            const f = this.frame("town", frames, water ? "water" : isRoad ? "path" : "grass");
            if (f !== "__BASE") this.add.image(x * TILE, y * TILE, "town", f).setOrigin(0).setDepth(-99);
            else {
              g.fillStyle(water ? [0x4b8290,0x528a94,0x579399][n % 3] : isRoad ? [0xbaac81,0xb7a779,0xc4b38c][n % 3] : [0x7e9255,0x82975a,0x7b8e51,0x889b5d][n % 4]);
              g.fillRect(x * TILE, y * TILE, TILE, TILE);
              g.fillStyle(water ? 0x8bb6aa : isRoad ? 0x8b815f : 0xb1bc72, 0.5);
              g.fillRect(x * TILE + n % 12, y * TILE + (n >>> 4) % 12, water ? 5 : 2, 1);
            }
          }
          // Cosmetic scenery is fixed and never participates in simulation rules.
          const treeFrame = this.frame("town", ["prop.tree", "tree.oak", "tree"], "tree");
          if (treeFrame !== "__BASE") {
            for (let i = 0; i < 105; i++) {
              const x = 2 + hash(i, 5) % 59, y = 2 + hash(i, 9) % 44;
              if (road(x,y) || (x > 11 && x < 53 && y > 7 && y < 38) || Math.abs(x - 32) < 4) continue;
              const variant = this.frame("town", [i%3===0?"prop.tree.elm":i%3===1?"prop.tree.oak":"prop.tree"], "tree");
              this.anchored(this.add.image(x * TILE + 8, y * TILE + 8, "town", variant), "town", variant).setDepth(y * TILE + 8);
            }
          }
          const flowers=this.frame("town",["prop.flower","decor.flowers"],"flower");
          if(flowers!=="__BASE")for(const [x,y] of [[8,28],[11,26],[23,21],[19,30],[23,30],[42,16],[46,16],[45,35],[48,35],[51,35],[55,22],[41,40],[45,40],[18,40],[22,40],[42,29],[45,29]])this.anchored(this.add.image(x*TILE+8,y*TILE+8,"town",flowers),"town",flowers).setDepth(y*TILE);
        }
        placeFrame(place: Place) {
          const kind = place.kind;
          const names = ["building." + place.id, "building." + kind, "prop." + place.id, "prop." + kind, place.id, kind];
          if (place.id.startsWith("home")) names.unshift(["building.house","building.house.slate","building.house.thatch"][Number(place.id.split("-")[1]??0)%3]);
          if (place.id === "square") names.unshift("building.market", "prop.market");
          if (place.id === "supper") names.unshift("prop.supper-table");
          if (place.id === "bridge") names.unshift("crossing.ford");
          return this.frame("town", names, kind === "home" ? "house" : place.id);
        }
        sync() {
          const { view, zoom } = latest.current;
          if (!this.ground) return;
          if (zoom !== this.lastZoom) { this.cameras.main.setZoom(zoom); this.lastZoom = zoom; }
          for (const place of view.places) {
            if (place.id === "bridge") continue;
            if (!this.buildings.has(place.id)) {
              const frame = this.placeFrame(place);
              if (frame === "__BASE") continue;
              const point = feet(place);
              const sprite = this.anchored(this.add.image(point.x, point.y, "town", frame), "town", frame).setDepth(point.y).setInteractive({ useHandCursor: true });
              sprite.on("pointerup", (p: import("phaser").Input.Pointer) => { if (p.event?.target === this.game.canvas && !this.dragged) latest.current.onPlace(place.id); });
              this.buildings.set(place.id, sprite);
            }
          }
          const now = this.time.now;
          const discontinuity = !!this.lastView && (view.branchId !== this.lastView.branchId || view.tick < this.lastView.tick);
          for (const a of view.agents) {
            let body = this.people.get(a.id);
            if (!body) {
              const frame = this.frame("characters", [`${a.id}.idle.s.0`, `${a.id}.walk.s.0`], a.id + ".");
              const point = feet(a);
              const sprite = this.anchored(this.add.sprite(point.x, point.y, "characters", frame), "characters", frame).setInteractive({ useHandCursor: true });
              sprite.on("pointerup", (p: import("phaser").Input.Pointer) => { if (p.event?.target === this.game.canvas && !this.dragged) latest.current.onAgent(a.id); });
              const cargo = [0, 1].map(() => this.add.image(point.x, point.y - 9, "objects", "carry.grain").setVisible(false));
              const name = this.add.text(sprite.x, sprite.y - 30, a.name, { fontFamily: "monospace", fontSize: "8px", color: "#fff9d9", backgroundColor: "#273b31dd", padding: { x: 3, y: 2 } }).setOrigin(0.5, 1).setDepth(2200).setVisible(false);
              body = { sprite, cargo, physical: a, route: [point], routeLength: 0, facing: "s", changed: now, name };
              this.people.set(a.id, body);
            }
            if (discontinuity) {
              const point = feet(a); body.route = [point]; body.routeLength = 0; body.changed = now;
            } else if (a.x !== body.physical.x || a.y !== body.physical.y) {
              const physical = this.physicalRoute(body.physical, a, view);
              const visual = this.sample(body, now);
              if (physical) {
                body.route = [{ x: visual.x, y: visual.y }, ...visual.remaining, ...physical.map(feet)];
                body.routeLength = body.route.slice(1).reduce((sum, point, index) => sum + segmentLength(body!.route[index], point), 0);
                body.facing = visual.facing;
              } else { body.route = [feet(a)]; body.routeLength = 0; }
              body.changed = now;
            }
            body.physical = a;
          }
          const crossingState = view.crossing.bridgeBuilt ? view.weather.rainingUntil > view.tick ? "bridge-wet" : "bridge" : view.crossing.blockedUntil > view.tick ? "flooded" : view.crossing.workSeconds > 0 ? "worksite" : "ford";
          if (crossingState !== this.crossingState) {
            const frame = this.frame("town", ["crossing." + crossingState, "bridge." + crossingState, crossingState], crossingState === "bridge" ? "bridge" : "ford");
            this.anchored(this.crossing.setFrame(frame), "town", frame);
            this.crossingState = crossingState;
          }
          this.lastView = view;
        }
        update(time: number, delta: number) {
          if (!this.ready) return;
          const { view, selectedId, claimId, followId } = latest.current;
          if (view !== this.lastView) this.sync();
          const c = this.cameras.main;
          const keys = this.registry.get("panKeys") as Record<string, import("phaser").Input.Keyboard.Key> | undefined;
          if (!followId && keys) {
            const amount = delta * 0.22 / c.zoom;
            if (keys.A?.isDown || keys.LEFT?.isDown) c.scrollX -= amount;
            if (keys.D?.isDown || keys.RIGHT?.isDown) c.scrollX += amount;
            if (keys.W?.isDown || keys.UP?.isDown) c.scrollY -= amount;
            if (keys.S?.isDown || keys.DOWN?.isDown) c.scrollY += amount;
          }
          this.selector.clear(); this.lines.clear(); this.rain.clear();
          for (const a of view.agents) {
            const b = this.people.get(a.id); if (!b) continue;
            const visual = this.sample(b, time);
            const x = visual.x, y = visual.y;
            b.facing = visual.facing;
            b.sprite.setPosition(Math.round(x), Math.round(y)).setDepth(y);
            const moving = visual.moving;
            const carrying = Object.values(a.inventory).some(v => v > 0);
            const working = a.intent?.action === "work" && !a.action.startsWith("Waiting") && !a.action.startsWith("Watching");
            const action = moving ? carrying ? "carry" : "walk" : working ? "work" : a.intent?.action === "talk" || a.intent?.action === "request" ? "talk" : a.intent?.action === "wait" ? "rest" : carrying ? "carry" : "idle";
            const frame = this.pose(a.id, action, b.facing, time, !moving && action === "carry");
            this.anchored(b.sprite.setFrame(frame), "characters", frame);
            const goods = Object.entries(a.inventory).flatMap(([good, quantity]) => Array.from({ length: Math.min(2, quantity) }, () => good)).slice(0, 2);
            for (let index = 0; index < b.cargo.length; index++) {
              const item = goods[index], cargo = b.cargo[index];
              cargo.setVisible(!!item);
              if (item) {
                const key = `carry.${item}`;
                const data = this.cache.json.get("characters-metadata") as AtlasData | undefined;
                const source = data?.frames[frame];
                const foot = source?.pixelAnchor ?? { x: 8, y: 23 };
                const hold = data?.meta?.cargoAnchor ?? { x: 8, y: 18 };
                this.anchored(cargo.setFrame(key), "objects", key).setPosition(Math.round(x + hold.x - foot.x + (goods.length > 1 ? index === 0 ? -3 : 3 : 0)), Math.round(y + hold.y - foot.y)).setDepth(y + 0.1 + index * 0.01);
              }
            }
            b.name.setPosition(x, y - 26).setVisible(selectedId === a.id || followId === a.id);
            if (selectedId === a.id) {
              this.selector.lineStyle(1, 0xf8e4a5, 0.95); this.selector.strokeEllipse(x, y, 18, 7);
            }
            if (claimId && a.beliefs[claimId]) {
              const belief = a.beliefs[claimId];
              const color = belief.stance === "believe" ? 0xf1b56d : belief.stance === "reject" ? 0x8ed3c8 : 0xddd8a5;
              this.selector.lineStyle(1, color, 0.8); this.selector.strokeCircle(x, y - 16, 13);
            }
          }
          if (claimId) {
            for (const event of view.events.filter(e => e.type.toLowerCase().includes("speech") || e.type.toLowerCase().includes("message") || e.type.toLowerCase().includes("claim"))) {
              if (event.payload.claimId !== claimId || !event.actorId) continue;
              const source = this.people.get(event.actorId); if (!source) continue;
              for (const targetId of event.audience) {
                if (targetId === event.actorId) continue;
                const target = this.people.get(targetId); if (!target) continue;
                this.lines.lineStyle(1, 0xf1cc88, 0.35);
                this.lines.lineBetween(source.sprite.x, source.sprite.y - 12, target.sprite.x, target.sprite.y - 12);
              }
            }
          }
          if (followId) { const b = this.people.get(followId); if (b) c.centerOn(b.sprite.x, b.sprite.y); }
          if (view.weather.rainingUntil > view.tick) {
            this.rain.lineStyle(1, 0xb5d5dc, 0.42);
            for (let i = 0; i < 145; i++) {
              const x = (hash(i, 71) % 1024 + time * 0.025) % 1024;
              const y = (hash(i, 97) % 768 + time * 0.15) % 768;
              this.rain.lineBetween(x, y, x - 2, y + 5);
            }
          }
          this.tone.setAlpha(Math.max(0, (view.tick - 12000) / 9600) * 0.13);
        }
      }
      game = new Phaser.Game({
        type: Phaser.AUTO, parent: host.current, backgroundColor: "#748950", pixelArt: true, roundPixels: true,
        antialias: false, audio: { noAudio: true }, banner: false,
        scale: { mode: Phaser.Scale.RESIZE, width: host.current.clientWidth, height: host.current.clientHeight },
        scene: TownScene,
      });
    });
    return () => { disposed = true; sceneRef.current = null; game?.destroy(true); };
  }, []);
  useEffect(() => { sceneRef.current?.sync(); }, [props.zoom, props.view]);
  return <div className="town-canvas" ref={host} role="img" aria-label="Bellwether, a living pixel town with 24 individual inhabitants. Select residents or places to inspect them." />;
}
