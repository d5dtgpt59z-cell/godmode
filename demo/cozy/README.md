# GODMODE · cozy prototype film

`godmode-cozy-prototype-72s.mp4` is a locally rendered, intentionally silent 72-second H.264 walkthrough at 1920×1080/30fps. It presents actual recorded cozy-engine states with editorial camera moves, source receipts and time compression. It is not a recording of product controls being operated.

The persistent video disclosure says **“Exact rule editor • rule-policy simulation”**, **“Recorded simulation • edited for time”** and **“Meta disconnected • 0 model calls.”** No natural-language conversion, live model output or UI interaction is fabricated. The exact organizer field is edited manually.

## What happened in the recording

- Mara declined an unverified grain gift at step 144 and chose to inspect the field. Her quote is an actual deterministic dialogue event.
- The player planted one grain at 150, spent one water at 165, and harvested at 345 after 180 fixed growth steps. The harvest yielded exactly four grain: the player’s grain inventory changed 3→7.
- Ada and Wren received actual one-grain gifts at 441 and 531 and gave different source-backed responses. Ada’s useful-grain gift changed trust +5 and affinity +8.
- At 531 the manual patch `{ "organizer": "villagers" }` was previewed and applied. Ada, Mara and Wren bid for food/setup/invitations at 540. Ada physically delivered one grain at 628 and two at 816; Mara fetched timber and completed 30 setup steps at 661. Wren arrived at 677 at (16,17); Mara arrived at 824 at (14,17); Ada arrived at 832 at (12,17). The festival completed at 924, with three participants and a shared memory.
- A fork from the same pre-edit state retains the original player-organizes rule. At the same final step 954 it remains planning, with no festival food or setup. Both complete operation recordings replay exactly to their state and event-chain hashes.

The primary simulation spans 95.4 seconds in fixed 100ms steps. The 72-second film includes deliberate receipt holds and fast travel/growth. The branch section rewinds both recorded continuations to a common past and then advances them together; it does not present a live simulation or statistical causal study.

## Files and editable source

- `primary-recording.json`, `baseline-recording.json`: replayable operation archives.
- `final-state.json`, `baseline-final-state.json`: exact final states.
- `source-events.json`, `recording-summary.json`: source receipts, event lineage, timing and quantities.
- `engine-snapshot/`: all five cozy engine modules plus the canonical hash module, frozen after the final place-name/kind and physical attendance-slot repairs. `source-hashes.json` and `source-audit.json` verify those bytes and geometry against the final application source at capture time. Every place has a defined name/kind.
- `film/index.html`, `film/compositions/cozy.html`, `film/assets/`: editable HyperFrames composition, data, native art and render logic.
- `film/SPEC.md`, `film/STORYLINES.md`, `film/REVIEW.md`: shot/timing decisions and review limits.
- `recording-verification.json`, `composition-check-summary.json`, `ffprobe.json`, `video-verification.json`: replay, composition and encoded-file verification.
- `decoded-review/`: 16 frames decoded from the MP4 and two contact sheets. `provenance.json` hashes source files and the delivered video.
- `godmode-cozy-demo-source.zip`: complete editable film/data/engine source plus verification and decoded contact sheets; MP4 and bulky intermediate snapshots are separate.

All art is copied unchanged from the approved new cozy production set. Its original asset provenance is retained in `film/assets/provenance.json`: the environment previously used two built-in image edits plus an earlier concept call; residents/state sprites were authored natively in Aseprite. **This film generated no new imagery, voices, music or provider inference.** The film uses the CLI’s bundled font workflow and local GSAP. No purchases, paid generation, cloud rendering, publishing or hackathon submission occurred.

## Rendering and replay

In the original repository, run `node --import tsx demo/cozy/generate-recording.ts` and `node --import tsx demo/cozy/verify-recordings.ts` from the game root. Standalone archive users need Node 22+ and `tsx` 4.20.6; the engine snapshot has no provider dependency.

Run `python3 build-film.py` from this source folder, then from `film/`:

```sh
npx --yes hyperframes@0.8.198 check --json
npx --yes hyperframes@0.8.198 preview --background --port 3047
npx --yes hyperframes@0.8.198 render --quality delivery --output ../godmode-cozy-prototype-72s.mp4
```

The editable local preview is `http://localhost:3047/#project/film`. It returned HTTP 200 before delivery rendering. The HyperFrames desktop app can also continue editing this source: https://hyperframes.dev/studio/download.

Then run `python3 verify-video.py` and visually inspect the decoded frames before `python3 package-source.py`. Python packages text/JSON, computes hashes, invokes FFmpeg for video checks and packages source; it does not author or modify native art.

Cosmetic presentation: adjacent three-step actor positions are interpolated along their recorded path; sprite cycles animate; all actor positions come directly from recordings, with no cosmetic fan-out. A table appears only when actual work begins at the venue; ready food appears after the actual food target is met or the recorded celebration begins. None of these effects changes engine state, resources or event ordering.

The original 56-second prototype film remains untouched. This new package modifies only `demo/cozy/`.

Delivery verified: **72.0s · 1920×1080 · H.264/yuv420p · 30fps · 2,160 frames · intentionally silent**. All frames decode cleanly;16 decoded review points and the three distinct guest positions were inspected. Video SHA-256: `9d6cba567891430d65bd29966cea4cc27b4ff6baabb892434d030e478282494a`.
