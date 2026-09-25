# Game Feel ("juice")

Looks are checked by the vision loop; **feel is checked by a human playing.** Claude implements the levers below, and the user judges them at the playtest checkpoints (quality-loop.md).

## Order of work (each step makes the next one worth doing)

1. **Latency**: input → visible reaction ≤ 100 ms (ideally the same frame). Read input every frame, never only on events; no animation that must finish before control returns.
2. **Response curves**: acceleration/deceleration, coyote time (~80–120 ms), jump buffering (~100 ms), variable jump height, and turn-around speed. Put the numbers in `src/data` and expose them in the tuning panel.
3. **Contact feedback** on every hit, pickup and landing:
   - hitstop 40–120 ms (freeze both parties)
   - flash (white/tint 1–2 frames)
   - knockback
   - particles
   - sound (pitch-randomised ±5–10 %)
4. **Camera**: smoothed follow with look-ahead; trauma-based shake (`shake = trauma²`, decaying ~1–2 /s, capped); slight zoom punches for big events.
5. **Audio-visual sync**: sound and visual effect start on the same frame; bigger events get lower, longer sounds.

## Readability beats spectacle

- Effects never hide the next decision: no full-screen flashes in combat, shake capped, and particles behind actors.
- Player and HUD keep a **minimum brightness/contrast** even in low-key scenes. Measure the luma of player vs background and set a floor in ART_BIBLE.md.
- Offer "reduced shake / reduced flashes" in the options (accessibility).

## Tuning instead of prompting

Expose feel parameters in a debug **tuning panel** (`?tune=1`: sliders that write to `src/data/*.json`). For content, have Claude build small **in-game editors** (level layout, camera paths, spawn waves) instead of iterating via prompts like "make it faster". The user tweaks live and commits the numbers.
