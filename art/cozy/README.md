# GODMODE cozy production art

New art lives entirely in `art/cozy/` and `public/assets/cozy/`. The previous game and its original atlases are preserved. This is an asset delivery; the integration preview and viewer stage art and do not establish gameplay, deployment, AI inference, or hackathon eligibility.

## Current cast and portraits (v3)

The live character pair comes from `character-refinement/v3/characters-v3.png` and `.json`. Four original adult-proportion life-sim identities retain all 288 frame names, 96 clips,24×32 cells and foot pivot12,31. The native sprite palette has62 opaque colors; idle holds2200ms open/140ms blink with no body hop; cargo anchor12,24 is consumed from metadata.

Eight separately authored96×96 portraits provide neutral/warm expressions and individual facial anatomy, age, hair and clothing. They appear beside the exact recorded NPC line in the responsive dialogue box. They are original busts, not enlarged sprites or imported franchise artwork. Current audit/master files and paired proof live in `character-refinement/v3/`. V2 and the first pass remain preserved. The old `cozy-art-source.zip`, `ART-MANIFEST.json` and first `native-qa.json` are historical first-pass evidence; current audits are `v3/native-qa.json` and `v3/portrait-qa.json`. The prototype film retains first-pass sprites.

## Runtime contract

- `map.png`: 512×384 logical pixels, 32×24 cells of 16px. One bridge. Six buildings: four homes, bakery, market. Empty farm beds, no baked residents, animals, food, mature crops, festival table, or bunting.
- `map.json`: exact six roof/body blockers, walkable rows (`.` ground, `#` blocked), matching single-cell rectangle decomposition, scenery blockers, places, crop visual anchors, and low-path flood cells. The player cottage side lane is visibly authored into the background. Feet use `x*16+8, y*16+12`.
- `characters.png/json`: four 24×32 original residents (`player`, `ada`, `mara`, `wren`), 288 poses and 96 animation clips. Keys are `id.action.facing.index`; actions are idle/walk/carry/work/talk/rest; facings n/s/e/w. All walk cycles have four distinct poses.
- `foreground.png/json`: 21 source cells, 24 semantic names, two four-frame FX clips. Crop empty/planted/growing/ripe, wet soil, empty/ready festival table, bunting, water/harvest FX, gift, and carry grain/water/timber/bread. `crop.empty` is intentionally fully transparent: the background already contains empty soil.
- `viewer.html`: local asset room with embedded JSON and relative PNGs. Select all96 character clips and crop/festival/goods states; inspect the ground mask. It works without an account or external runtime. A web server avoids browser restrictions on local resources.

Character feet: pixel `{x:12,y:31}`, normalized `{x:.5,y:.96875}`. Cargo anchor is pixel `{x:12,y:24}`. Do not pass pixel coordinates into Phaser's normalized pivot fields. Carry goods are separate sprites; their bottom anchor can be placed around feet minus7px to cover the resident's hands. Crop anchor is12,30; use per-bed `visualAnchor` in map metadata to center on the three existing beds. Festival table anchor 32,36; bunting 40,47.

## Source and method

`concept-reference.png` is a byte-for-byte copy of the original project concept produced earlier in the parent art direction. It is an illustration, not an original native tile atlas. Two built-in image edits produced `environment-source-v1.png` and `environment-source-v2.png`; the second removes the unwanted lower crossing. Their exact prompts are included. Source images are preserved at generated resolution.

The selected image was resized in local Aseprite with nearest-neighbor sampling to 512×384, optimally palette-reduced, and its actual pixels quantized. The final map uses 254 actual opaque colors. Aseprite then copied original scene stone-path pixels to make narrow ground corridors around the player cottage and down the eastern lane, matching the physical walk mask. The finished background is a fixed raster, not a claim that all its architecture is a modular tile set.

Residents and state pieces are original native Aseprite pixel construction from `build-sprites.lua` and `pixel-core.lua`. No source screenshot pixels, protected game art, remote sprite generation, or image-model character strips were imported. The first pass used restrained silhouette/cloth/hair ramps: 56 actual nontransparent character colors and 67 foreground colors; current character refinement uses 62 colors. Editable atlas `.aseprite` files and a layered 72-frame character timeline are included. Every resident has its own timeline layer and the 24 action/facing tags are shared. `player-south-walk-3x.gif` is a four-frame, one-direction animation proof; the full 96 clips are in the PNG/JSON and viewer.

Generation accounting: **two image-edit calls for this background**, plus the separate earlier concept's one call. Native resident/foreground generation calls: zero. No Meta calls, purchases, or paid third-party providers were used in this art workflow. Runtime model connectivity is owned by the application and is not implied by these files.

## Verification

`audit-assets.lua` verifies every exported frame is inside its PNG, every pivot has matching normalized/pixel units, every clip references valid frames and durations, every resident body is visible, every walk clip has four distinct poses, and the map is opaque 512×384 with at most 256 colors. `native-qa.json` records those checks and individual visible pixel counts. A separate graph audit found all 154 authored ground cells connected and all nine places plus three crop targets reachable. The engine owner separately validates gameplay paths/flood behavior.

`rebuild-background.lua` reconstructs the map from the preserved full-resolution source, palette and exact authored material-copy cells. It matched all 196,608 delivered RGBA pixels with zero differences (`background-rebuild-qa.json`). `package-audit.py` checks source hashes, dimensions, graph connectivity and geometry blockers, and creates the source archive. The two visually cleared stone lanes and market roof-tip blocker are included in this audit.

Native contact sheets and a 3× nearest integration preview were visually inspected. The preview is an asset composition, not a browser gameplay capture. The subagent's CUA inventory exposed no browser surfaces, so browser integration QA is explicitly delegated to the parent agent's available browser session.

The preserved first-pass combined builder is `build-sprites.lua`. Rebuild current characters with Aseprite `dofile('/absolute/path/art/cozy/character-refinement/v3/build-characters-v3.lua')`; it writes only versioned character output. Integrate the selected PNG/JSON explicitly. The original `audit-assets.lua` and new character audit cover their respective passes. Rebuild the HTML/data wrapper with `python3 art/cozy/build-viewer.py`; Python only packages text/JSON and does not edit any raster. SHA-256/bytes/dimensions are recorded in the provenance manifest. Source/helper paths are intentionally absolute to prevent writes into legacy asset folders.
