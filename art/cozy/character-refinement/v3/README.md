# Original life-sim cast and dialogue portraits · v3

Root reviewed and approved the adult sprite proportions, portrait style and individualized face anatomy before final export. This folder is the frozen copy-ready art source. Runtime integration belongs to root.

Copy `characters-v3.png` and `characters-v3.json` as the runtime character pair, retaining the existing frame names. The source atlas is 512×576; all 288 poses are 24×32 with 96 action/facing clips. Feet remain 12,31; cargo 12,24; west reflects around x12; no ground shadow is baked in. Idle timings remain 2200ms open / 140ms blink with no body hop. Walk 4×150ms, carry 4×170ms; other per-frame durations are in the JSON.

Copy the eight individual 96×96 transparent PNGs in `portraits/` to `/assets/cozy/portraits/`:

`player-neutral.png`, `player-warm.png`, `ada-neutral.png`, `ada-warm.png`, `mara-neutral.png`, `mara-warm.png`, `wren-neutral.png`, `wren-warm.png`.

They are separately authored busts, not enlarged sprites. Ada has rounded cheeks, upturned brows and a high baker bun; Mara a longer narrow face, careful eyes and subtle age/laugh lines; Wren a broader jaw/nose, raised brow and distinct smile; the player an open face under the teal cap. Head/hair are fully inside each image; the shoulder crop at the bottom is intentional. Root supplies the dialogue box/frame and chooses neutral or warm.

`cast-and-portraits-proof-3x.png` is the approved final presentation: neutral/warm portraits followed by south/east/north sprites, rows player/Ada/Mara/Wren. `adult-cast-lineup-6x.png` and `new-cast-lineup-6x.png` show the new cast alone. `walk-contact-4x.png` and `actions-contact-5x.png` cover directions/actions.

Editable sources: `characters-v3.aseprite` (atlas), `characters-v3-timeline.aseprite` (four layers, 72 frames, 24 tags), `portraits-v3.aseprite` (atlas), `portraits-v3-master.aseprite` (four layers, neutral/warm frames), and the native Lua source/builders. Shared draw primitives remain in `art/cozy/pixel-core.lua`.

Audits: all original 288 frame names and 96 clip names preserved; four distinct poses in each walk cycle; fixed feet with transparent edge padding; alpha 0/255; 62 sprite colors; eight unique portrait images using 69 colors. Idle changes only 24 eye pixels across 16 facing clips. `native-qa.json`, `portrait-qa.json`, `idle-qa.json` and `v3-report.json` contain the checks and hashes. All 14 frozen v2 manifest files remain byte-identical.

This is original local Aseprite/Lua art with classic life-sim style as a genre reference. No franchise character assets, traced pixels, outside character images, remote generation, paid providers or purchases were used. This task wrote only inside `v3/`; runtime, UI, environment, engine, previous source ZIPs and demo snapshots were not edited. No archive was repacked.
