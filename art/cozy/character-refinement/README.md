# Refined cozy cast · v2

Root reviewed the seven-column before/after proof and approved the design before the full export. The selected cast is now integrated by root; this refinement task wrote only versioned character art and reports. The original combined `build-sprites.lua`, environment, foreground, earlier demo, and original art-source ZIP were preserved.

The characters have fuller stepped faces, shorter tapered bodies, curved sleeves/palms/boots, controlled upper-left highlights and cool undersides. Identity comes from silhouette as well as color: the player’s soft cap/jacket; Ada’s auburn bun, rolled sleeves and cream apron; Mara’s silver braid, light sage cardigan and plum skirt; Wren’s curls, red scarf and rounded satchel. Work poses use a watering can, rolling pin, timber/mallet and folded note respectively.

## Selected files

- `v2/characters-refined-v2.png` and `.json`: full atlas, 288 poses / 96 clips, exact original keys. PNG512×576; each cel24×32.
- `v2/characters-refined-v2.aseprite`: editable atlas.
- `v2/characters-refined-v2-timeline.aseprite`: four character layers, 72 frames and24 action/facing tags.
- `v2/refine-characters.lua` and `v2/build-refined-characters.lua`: isolated character authoring/export; neither executes the combined environment builder. Shared native primitives remain in `../pixel-core.lua` relative to this folder.
- `v2/first-proof-6x.png`: old south / new south / west / east / north / carry / work. Rows player, Ada, Mara, Wren.
- `v2/new-cast-lineup-6x.png`: clean new-only presentation on a warm neutral background.
- `v2/walk-contact-4x.png` and `v2/actions-contact-5x.png`: full direction walks and six action silhouettes.
- `v2/all-cast-south-walk-4x.gif`: four frames, 0.60s. `v2/all-cast-idle-brief-blink-4x.gif`: two frames, 2.34s.
- `v2/native-qa.json`, `v2/idle-qa.json`, `v2/refinement-report.json`: per-frame checks, blink proof and source hashes. `previous/` preserves the original sheets/source.

## Runtime invariants

Feet remain pixel12,31 / normalized.5,.96875; body contact pixels stop at row30, leaving transparent edge padding. West mirrors around native x12 using24−x. No ground ellipse is baked into any sprite: the renderer supplies the sole shadow. Cargo grip is fixed at pixel12,24 across carry frames.

Idle durations are `[2200,140]`ms: eyes open94.02% of the cycle, with no idle body/head/foot hop. Walk is4×150ms; carry4×170ms; work `[180,150,180,250]`; talk `[380,160]`; rest `[1500,300]`. Consumers must honor the per-frame `durations` array. Root updated action clocks, facing and cargo layering separately.

All16 walk cycles have four distinct poses. All288 frames retain their fixed cell/pivot, stay inside x1..22/y1..30, use only alpha0/255, and share62 actual opaque colors. The idle comparison changes only48 eye pixels across the16 facing clips; no body or foot pixels move. Both GIF frame counts and durations were checked with FFprobe.

This is original local Aseprite/Lua work. No remote generation, credentials, paid provider calls, purchases or outside character pixels were used. Root owns the current runtime alias, provenance/viewer update, final packaging, commit and any deployment. The old video remains a historical snapshot of the previous cast.
