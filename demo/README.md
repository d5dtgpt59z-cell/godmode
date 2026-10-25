# GODMODE ·56-second prototype film

This package is an honest **rule-policy prototype demonstration**. It uses actual exported simulation states and the current original chibi assets. The visible label says **“Rule-policy prototype • Meta not connected”** throughout. There are zero Meta/provider generation calls, zero TTS calls, no purchased media and no external upload/final submission.

The film renders a recorded state visualization with editorial annotations. It is not a browser interaction recording and does not present invented controls as the current product UI. It includes controlled time jumps and orthogonal visual interpolation between actual samples. “Recorded states • edited for time” stays visible. Silent delivery was explicitly permitted; no music or copyrighted sound is included.

## Source evidence

- `generate-recording.ts`: reproduces data using the frozen pure engine. Run `node --import tsx demo/generate-recording.ts` from the GODMODE root.
- `engine-snapshot/`: exact copied engine source used for this film, with SHA-256 records in `source-hashes.json`. Later game edits can proceed independently.
- `primary-recording.json`: persistent baseline, seed137,26 simulated hours, actual rain, a note and four supplied loaves.
- `fork-recording.json`: actual fork at12:30pm without the future supply intervention, then continued to6pm.
- `source-events.json`: all7,336 collected immutable events from the primary capture, including source IDs and digests.
- `recording-summary.json`: event receipts and replay hashes; both complete recordings cold-replay to their recorded state hash with no inference.
- `film/assets/snapshots.json`:961 primary snapshots plus the actual fork samples. PNG/JSON game assets are copied without editing their bytes.

Real recorded beats: rain at12:05; bridge completed at12:32:18 after3,600 worker-seconds; four supplied loaves at12:35; Wren read the anonymous twelve-sack claim at12:45:01, then inspected a granary with0 grain at1:54:25. At2pm the main continuation has17 people fed and the no-supply fork14. Both eventually feed24; this is a descriptive captured comparison, not proof of model performance or causal generalization. Night is8pm and next dawn6am in the actual persistent calendar. Modeled daily resource inputs remain explicit engine rules.

## Editable composition

`film/index.html` mounts `film/compositions/village.html`. `film/assets/render-world.js` is the deterministic canvas playback renderer; all state comes from the recording bundle. There are no wall-clock timers, unseeded randomness, runtime inference or network fetches in the composition. GSAP is vendored locally. HyperFrames uses its bundled Nunito font family. The installed registry's `ui-focus-zoom` camera move/hold pattern informed the canvas camera; its skeleton UI and halo are not used.

The preview is `http://127.0.0.1:3019/#project/film` while its managed local server runs. It returnedHTTP200 when checked. The HyperFrames editor can change the source timing/overlays. `npx hyperframes open` opens the project in the HyperFrames desktop app if installed; no installation is required to use the local source.

From `film/`, use the pinned CLI `npx --yes hyperframes@0.8.198 check --json`, `snapshot --review`, and `render --quality delivery --workers 1 --strict --output ../godmode-prototype-56s.mp4`. Local Chrome and FFmpeg8.1.1 were available. Usage query reported61% of the current HyperFrames weekly allowance remaining; financial spend was unavailable/unknown. Only local rendering is used.

## Verification

`film/check-evidence.json` summarizes zero runtime/layout/contrast errors and22 successful contrast checks. `film/REVIEW.md` records the deliberate silent/hold/dense-track warnings. Beat and phone-size sheets live in `film/snapshots-review/`. The rendered local `godmode-prototype-56s.mp4` is verified H.264,1920×1080,30fps,1,680frames,56.000seconds,16,568,385bytes, intentionally silent. SHA-256: `d70250d6a0f63ddb2dabbfd8df2f0ba2a8b5248959e1f70df9460239dd04bfec`. `ffprobe.json` contains the full probe and `video-verification.json` the acceptance record. Eight frames were decoded from the actual MP4 and visually reviewed, including frame0, bridge completion, source inspection, fork comparison, night and ending. The film has not been uploaded or submitted. `godmode-demo-source.zip` is the editable source/recording package; MP4 is delivered separately.
