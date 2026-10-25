# GODMODE original pixel asset source

Created locally on October 25, 2026 for Ryan Morrison's GODMODE prototype. The current revision follows the user's anime-cute direction: large chibi heads, bright eyes, rosy cheeks, warm pastel materials, fluffy green and blossom canopies. The earlier classic miniature-town edition is preserved in `classic-style-before-chibi.zip`. No pixels, maps, characters, icons or animation frames from an existing game were imported.

The exported pack contains **1,728 character poses**, **576 named character animations**, **56 town cells** and **54 object/interface/effect cells**. Some town cells deliberately repeat a material or have compatibility aliases. `validation.json` distinguishes packed source cells, named frame keys and distinct raster images. Static art staging is labeled separately from simulated game state.

## Files and editing

- `characters-master.aseprite`: 16×24 canvas, 72-frame tagged timeline, 24 named resident layers. Only Iona is visible initially; show one resident layer at a time to edit/export a variant. All variants share the same pose indices and feet.
- `characters-base-rig.aseprite`: Iona alone, with 24 action/direction tags and frame durations.
- `characters.aseprite`, `town.aseprite`, `objects.aseprite`: editable, full-size packed atlases with the common palette.
- `characters.lua`, `chibi-rig.lua`, `town.lua`, `objects.lua`, `pixel-core.lua`: original native pixel geometry, material clusters, palette, anchors and deterministic assembly. No remote image model is called.
- `stage.lua`: source-resolution arrangement of 24 residents for art inspection. It does not run the simulation.
- `audit.lua`: checks the actual exported PNG pixels, rectangles, durations, animation references, character coverage and anchors.
- `build-viewer.py`: embeds exported bytes unchanged into `public/assets/viewer.html`. It does not author, resize or edit raster images.
- `package-assets.py`: records file lengths, PNG dimensions and SHA-256 hashes in `public/assets/manifest.json`.
- `check-phaser-anchors.cjs`: runs the installed Phaser JSONHash parser on all three actual atlases, checking that normalized pivots resolve to the intended native pixels. This covers the missing-body regression.

PNG and JSON runtime exports live in `../public/assets/`. Open `viewer.html` directly for the offline art book, resident animation controls and cell inspector. Source contact sheets are also supplied at 1×, plus a precisely replicated 2× town inspection image. The pack needs no model account or external runtime dependency.

## Renderer contract

Use nearest-neighbor sampling, integer pixel placement and integer display scale where possible. The world grid is 16×16 pixels. The town is 64×48 logical tiles; art does not define collision or routing.

Every character cell is **16×24**, with foot anchor **(8,23)** and cargo overlay anchor **(8,18)**, also recorded in character atlas metadata. The latter puts goods below the chibi face. Name pattern is `iona.walk.s.0`. Directions are `s,w,e,n`; actions are idle (2 frames, 650 ms each), walk (4, 140 ms), carry (4, 160 ms), talk (2, 240 ms), work (4, 180 ms), rest (2, 850 ms). Animation entries use `iona.walk.s`, an ordered frame-key list and the per-frame duration. Repeated contact poses within a gait are deliberate; every action/facing contains visible motion.

The carry pose holds a small neutral basket. Overlay `carry.grain`, `carry.water`, `carry.timber` or `carry.bread` when the runtime knows which good is held. These 8×8 overlays have anchor (4,6). Physical inventories and permissions always come from the engine.

Atlas `pixelAnchor` contains the exact native pixel to place at a building's door/interaction feet; depth sort by that world point. Standard `anchor` is a normalized Phaser pivot in 0…1. **Do not put pixel coordinates into `anchor`: Phaser applies those as normalized values on every setFrame and pushes the body offscreen.** Houses/bakery/granary/inn: 80×80, pixelAnchor (40,73). Timber yard: 80×64, (40,58). Well: 32×40, (16,36). Market: 48×48, (24,44). Trees: 48×64, (24,59). The whole-building sprites are editable flattened cells, not destructible or independently removable roof layers. The selected actor's visibility/occlusion is a renderer concern.

The five crossing cells share **48×48**, anchor **(24,31)**: `crossing.ford`, `.flooded`, `.worksite`, `.bridge`, `.bridge-wet`. Water runs vertically through their middle and the completed deck runs horizontally. Rain/water art does not itself make a route blocked or open.

Terrain cells are opaque 16×16; prop/character cells are transparent. Character contact shadows use alpha 70; rain, smoke, footprints and delivery dust use explicit stepped alpha. Other character pixels are either opaque or transparent. Shadows are separate from logical foot positions.

`ui.paper` is a restrained 48×48 notebook panel with a 6-pixel safe border; DOM text remains real text. `ui.weather`, `ui.supply`, `ui.note` represent the three ordinary interventions. Effects provide four source frames each; ordinary delivery and note receipt use one-shot metadata. The viewer obeys reduced-motion preferences and supports a motion pause.

## Key families

`town.json` includes the requested `terrain.grass.0/.1/.2`, `terrain.path.0`, `terrain.water.0…3`, all bank/path edges and corners, `building.house`, `.house.slate`, `.house.thatch`, `.bakery`, `.granary`, `.inn`, `.timber-yard`, `.well`, `.market`; plus `prop.tree`, `.tree.oak`, `.tree.elm`, `.noticeboard`, `.supper-table`, `.fence`, `.flower`, `.bush`, `.timber-stack`, `.grain-stack`, `.barrel`, `.crate`, `.lantern`. Compatibility aliases are explicit in JSON.

`objects.json` includes `goods.grain/water/timber/bread/note`, `carry.grain/water/timber/bread`, `ui.weather/supply/note/cursor/target/selection-ring/clock/chronicle/pause/play/rewind/fork/inspect/close/sound/mute/request/paper/notebook` and `fx.rain/ripple/oven-smoke/delivery/note-received/footprint/supper.0…3`.

## Reproduction and provenance

Use the working local Aseprite MCP's `run_lua_script` to run, in order: `characters.lua`, `town.lua`, `objects.lua`, `stage.lua`, `audit.lua`. The scripts currently declare this workspace's absolute root in `pixel-core.lua` and their `dofile` references; update those if moving the project. Execute `python3 art/build-viewer.py` followed by `python3 art/package-assets.py` from the GODMODE root. No package install or paid service is required by these scripts.

Native authoring was performed through Aseprite **1.3.18.6-dev**. Retro Diffusion and PixelLab connections reported missing credentials before production; neither provider generated these assets. There is no remote model/job ID or provider charge for this asset work. No credentials were changed or purchased. Authorship: original Codex-assisted pixel construction for Ryan Morrison / Built by Magnus's project. No third-party asset-pack license or game content is incorporated. This source record does not grant a separate public asset-pack license.

This is dated local prototype work. Hackathon eligibility and acceptance are not established by creating these assets; the parent task retains the rule review and final submission stop.

Native raster checks passed on all three PNGs. Contact sheets were visually inspected at native scale and at exact 2×. Browser animation verification depends on the host's available browser; the asset agent's in-app browser was unavailable. The root's integrated game playtest remains the authority for final scene layout and runtime animation behavior.
