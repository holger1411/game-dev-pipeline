# Quality Loop: iterate until the game matches the targets

If the **gauntlet-loop** skill is installed, use it as the loop driver (aim prompt + fan-out + harsh critic + blind A/B); this file says what to aim it at and how to keep the comparison honest. Without it, this file is the complete procedure.

The aim sentence is always of this form:
> "Keep going until in-game frames are indistinguishable in quality from `art/target/*.png` and the moodboard (`moodboard/_digest/MOODBOARD.md`). Reference game(s): <X>. Don't stop after one round, and don't lower the bar."

No target screenshots? Then the reference is 1–3 named games whose screenshots are in `moodboard/ref-<game>/`.

## Preconditions (build these before round 1)

1. **Capture hooks** in the game (see engineering.md): `window.__game` (ready flag, state, stats: fps, draw calls, triangles), camera `view(...)` presets, URL params `?seed= &autopilot=1 &skip=<scene> &hud=0`.
2. **A fixed view set**: 4–8 named camera positions/moments that match the target shots (e.g. overview, ground close-up, combat, night, UI screen). Same views every round, or the scores aren't comparable.
3. **Evidence script**: opens the game, waits for `ready`, visits every view, saves `docs/gauntlet/evidence/<round>/<view>.png` + `stats.json`, builds a contact sheet.

## One round

```
capture views ─► validate shots ─► blind critic (vs targets) ─► defect list M1..Mn
      ▲                                                               │
      └── verify + fps check + commit ◄── parallel fixers (disjoint files) ◄──┘
```

1. **Capture** the view set (game running alone on the GPU).
2. **Validate screenshots before critiquing**: HUD present? not a loading/death/fade screen? player visible? A whole critic round once scored loading screens. Check with code (luma not black, known HUD pixel) and by looking.
3. **Blind critic subagent** (read-only, harsh "AAA art director"):
   - Fair pairs: hide the HUD in both or neither, crop watermarks, resize both to the same size, re-encode identically, **random X/Y order**, key file stored outside the blind folder. (The first "blind" pairs were byte-identical to the candidate files, so the critic knew.)
   - Score axes 0–10 with the reference = 10: lighting, sky/atmosphere, ground/terrain, buildings/props, vegetation, characters, FX/post, coherence, readability, tech cleanliness.
   - **Measured claims, not vibes**: region luma/σ, value spread walkable vs blockers, % blown-out pixels, hue-band share, props per screen, contrast of player vs ground.
   - Output: defect list **M1..Mn**, each with the evidence image, measured numbers, concrete fix (file + values), estimated ms cost, and regressions against the last round.
   - Critics send results via SendMessage to the lead (handbacks got lost).
4. **Plan the fixes** by impact per frame-time, grouped into **≤3 workstreams with disjoint file ownership** (e.g. A: light/sky/post, B: world/props, C: characters/UI). Shared contracts (uniform names, material singletons) are written into each brief.
5. **Parallel fixers** on one shared dev server (HMR); each brief says "YOU MAY ONLY EDIT: …", includes an ms budget, and "every change must compile on its own". Each fixer uses its own named browser session and closes it.
6. **Verify alone**: stop other browsers, measure fps on the real GPU, re-capture, confirm last round's M-items are fixed, and commit (one branch per round if the user reviews rounds).
7. **Write `docs/gauntlet/round-NN.md`** (scores, M-list, what changed) and update `HANDOFF.md` so another session can resume.

Rounds continue until the user stops or the critic can't tell the frames apart. If the user asked for batches (e.g. 3 rounds then feedback), pause at the batch boundary and show the contact sheets side by side with the targets.

## What moves the score most (measured across projects)

| Lever | Why |
|---|---|
| **Lighting & values first** | One project went 2.5→3.5 mostly from values: low-key scene, key:fill ≈ 5:1, warm low sun + cool fill, fog colour = sky horizon, ACES tone mapping, correct exposure. Another: hemisphere + PMREM env + ACES was the biggest jump for almost no cost |
| **Grounding** | Objects sinking into or floating above the ground was the most repeated fix: contact shadows, AO blobs, decals, snap to the ground |
| **Population, not just light** | "Not badly lit but badly populated": cluster clutter into nests (not evenly spread wallpaper), put debris against hero props, spend randomness where it's visible and lit  (see asset-pipeline.md → procedural scatter) |
| **Readability hierarchy** | Walkable ground bright and desaturated, blockers dark; scenery muted, actors saturated; enemies never share a hue with hazards; the HUD is never washed out by bloom |
| **One style** | Parallel streams created two asphalt materials and two tree styles: enforce singletons for shared materials/assets |
| **One pixel grid** (2D) | All sprites at one art-pixel scale; mixed pixel sizes read as amateur immediately |

## Common mistakes

| Mistake | Fix |
|---|---|
| Critic sees which image is the reference | Re-encode, same size, random order, HUD parity |
| Scoring different views each round | Fixed view set, same seed, same time of day |
| fps measured while other agents' browsers share the GPU | Final perf check alone; critics must not open a browser |
| Stopping after one round / asking "shall I continue?" | The loop runs until the user stops it |
| Fixers editing the same file | Disjoint ownership table in every brief |
| Fixing polish before values/lighting | Values and lighting first; they change every other judgement |
