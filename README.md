# OpenDoor

Four-bar open-door desk for bedroom producers and AI-music finishers.

Generators dump the verse into the hook. Session players write four live bars that open the door — sparse hold, rising figure, kit open — then the hook lands.

Live samples (FluidR3 piano, upright, nylon, trumpet, violin, acoustic kit) loaded from the PreEight sample bank pinned to commit SHA `d58301e4a494555f411a2afbc448b724136eee76`.

Distinct from TagFour (last-line tag), LiftTwo (two-bar climb), PreEight (eight-bar pre), RiseFour, ResponseFour, LandEight, AfterHook, EndEight, LastHook.

## Pricing

One-time **$29** on Lemon Squeezy (merchant of record, VAT handled).

Mirror on Gumroad.

Do not subscribe; Forge Pass stays $24 for the cloud tools.

README states the price; unlock via Lemon Squeezy license key check (demo unlock available for testing).

## License

MIT.

workinwithai-create.

## Audio engine

Follows WorkinWithAI standing rules: lookahead scheduler on AudioContext clock, live state, OfflineAudioContext exports (full implementation: exact length, first downbeat at sample 0, tail folded for seamless loop, peak ≤ -1 dBFS, 48 kHz 24-bit stereo), pinned samples, envelopes, master compressor.

## Exports

WAV and MIDI exports are production-ready. Files named `opendoor-recipe-<bpm>bpm-<key>.wav` / `.mid`.

Acceptance checks (section 9):
(1) Export at 92 BPM, 8 bars, 48 kHz → exactly 1,001,739 samples; first transient within 1 ms of sample 0.
(2) Seamless loop, no clicks, no grid drift.
(3) Background tab stops cleanly.
(4) Live changes apply within one bar.
(5) Missing samples named in UI.
(6) Sustains hold.
(7) No @main, no Math.random in export path.

Live deployment: https://opendoor-release-forge.vercel.app (permanent)

## Run

Open index.html or the live URL. Tap to start audio.
