# Imagegen cast and environment replacement — v4

This version responds to the requested softer, friendly cozy/anime art direction. Kitt/player, Ada, Mara and Wren retain their identities and palette families. The starting cast remains three NPCs plus the player.

All replacement visual pixels originate in **12 built-in image_gen calls**. No CLI or external provider API was used; no purchase was made. These are generated pixel-style assets followed by technical crop/resize/anchor/atlas preparation, not hand-authored Aseprite pixel drawings. Prompt files and original outputs are retained.

- `raw/GENERATION-MANIFEST.json`: exact raw output dimensions, bytes, alpha counts and SHA-256 hashes; scope is this v4 generation only.
- `raw/tool-output-index.json`: prompt/output correspondence and retained original generated-image paths.
- `previous/public-assets-cozy/` and `previous/manifest.json`: lossless pre-v4 runtime archive. Earlier native sources and ZIPs remain untouched.
- `raw/sprite-slot-contract.json`: requested 6×12 per-character grid, 72 slots each, all original frame names, actions, facings and durations.
- `raw/foreground-slot-contract.json` and `raw/social-fx-slot-contract.json`: requested semantic cells. Actual alpha-component extraction and technical packing are recorded separately by the integration packer.

The four source animation sheets were visually checked. Incorrect north-facing gestures in the first outputs are replaced by the dedicated player/Mara and Wren north correction sheets. The isolated wheat strip replaces fenced-bed crop art; its three stages share a source scale and baseline so planted shoots stay smaller than mature wheat. `crop.empty` represents no visible plant. The social effects contain no people and are only intended for real recorded activity intervals.

The new map is a style edit of the fixed existing geography. Its runtime physical mask and anchors remain authoritative. A small low shrub fringe beside the x10/y17–19 lane was noted during ground-mask review; it does not add a new physical blocker. Native browser motion remains the integration check.

Generated source slot requests are not proof of perfect pose alignment. Runtime frame extraction, empty/misaligned-cell checks, shared scales, pivots, per-frame metadata and actual in-game appearance must pass the packer/integration audit before a finished-art claim.
