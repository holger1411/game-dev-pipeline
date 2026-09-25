# Vision Loop: iterate until the game matches *your* vision

This skill's own iteration machinery. It is inspired by the gauntlet-loop idea (keep improving, harsh critic, blind A/B), but it is self-contained and needs no other skill. The target is **not an existing game but the user's vision**, i.e. the moodboard and the target screenshots. Reference games are optional second anchors.

## Start: set aim + round budget

Ask once (skip what the user already said):
1. **Round budget**: how many rounds? **Default: 3.** Say the trade-off when asking: every round brings the game closer to the game concept and the moodboard, but costs time and tokens. Offer the default plus larger options (e.g. 3 / 5 / 10, or batches like "3, then show me")
2. **Involvement**: hands-on (checkpoint after each batch; the user may step in but doesn't have to) or hands-off (run the whole budget, e.g. "100 rounds without me", report at the end). See SKILL.md → "Iterative by design"
3. **Scope**: which views/areas (e.g. "forest level + HUD")?

Then write the aim into `docs/vision-loop/AIM.md` and run:
> "Keep improving until in-game frames are indistinguishable in quality and mood from `art/target/*.png` and the moodboard (`moodboard/_digest/MOODBOARD.md`). Optional second anchor: <reference game>. Budget: **N rounds**. Don't lower the bar."

**Within the budget, work without stopping**: no "shall I continue?", no early exit because "it looks good now". Stop only when the budget is used up, the user interrupts, or a blind critic can no longer tell the frames from the targets. At the budget end (or a batch boundary): show the contact sheet next to the targets and the score trend, and ask for the next budget.

## The machinery

| Role | Who | Does |
|---|---|---|
| **Lead** | the main session | holds AIM.md + STATE.md, captures, validates shots, plans the fixes, verifies, commits, counts rounds |
| **Critic** | a fresh read-only subagent per round (never the lead, never a fixer) | blind A/B vs the reference set, scores, measured M-defects |
| **Fixers** | ≤3 subagents with disjoint file ownership | implement the M-items of their stream within the ms budget |

State lives in files, so a round survives context resets and new sessions:
- `docs/vision-loop/AIM.md`: the aim sentence, reference set, view set, round budget, batch size
- `docs/vision-loop/STATE.md`: current round k/N, the score table per round, open M-items, the next step
- `docs/vision-loop/round-NN.md`: the critic output + what changed

**Runner**: the lead loops through the rounds in one session and re-reads STATE.md at the start of each. For long budgets, Claude Code's `/loop` (self-paced) can re-trigger "continue the vision loop from STATE.md" until STATE.md says `done`.

**Keep the tooling lean** (harnesses can eat the budget): one small evidence script, one round note per round, and no framework. The game must stay playable at all times.

**Looks ≠ feel.** The loop judges frames. After every batch there is a **human playtest checkpoint** (hands-on mode): the user plays the build for a few minutes, and their notes feed the next rounds (feel, pacing, controls; see game-feel.md). Frame it as an offer to steer, and remind them it is an intermediate state, not the result. In hands-off mode the checkpoint moves to the end of the whole budget. Gameplay invariants (engineering.md) must pass before a round counts.

## Preconditions (build these before round 1)

1. **Capture hooks** in the game (see engineering.md): `window.__game` (ready flag, state, stats: fps, draw calls, triangles), camera `view(...)` presets, URL params `?seed= &autopilot=1 &skip=<scene> &hud=0`.
2. **A fixed view set**: 4–8 named camera positions/moments that match the target shots (e.g. overview, ground close-up, combat, night, UI screen). Same views every round, or the scores aren't comparable.
3. **Evidence script**: opens the game, waits for `ready`, visits every view, saves `docs/vision-loop/evidence/<round>/<view>.png` + `stats.json`, builds a contact sheet.

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
   - Reference set: `art/target/*.png` + moodboard images (+ optional real reference-game shots as a second anchor).
   - Score axes 0–10 with the reference = 10: lighting, sky/atmosphere, ground/terrain, buildings/props, vegetation, characters, FX/post, coherence, readability, tech cleanliness.
   - **Measured claims, not vibes**: region luma/σ, value spread walkable vs blockers, % blown-out pixels, hue-band share, props per screen, contrast of player vs ground.
   - Output: defect list **M1..Mn**, each with the evidence image, measured numbers, concrete fix (file + values), estimated ms cost, and regressions against the last round.
   - Critics send results via SendMessage to the lead (handbacks got lost).
4. **Plan the fixes** by impact per frame-time, grouped into **≤3 workstreams with disjoint file ownership** (e.g. A: light/sky/post, B: world/props, C: characters/UI). Shared contracts (uniform names, material singletons) are written into each brief.
5. **Parallel fixers** on one shared dev server (HMR); each brief says "YOU MAY ONLY EDIT: …", includes an ms budget, and "every change must compile on its own". Each fixer uses its own named browser session and closes it.
6. **Verify alone**: stop other browsers, measure fps on the real GPU, re-capture, confirm last round's M-items are fixed, and commit (one branch per round if the user reviews rounds).
7. **Write `docs/vision-loop/round-NN.md`** (scores, M-list, what changed) and update `HANDOFF.md` so another session can resume.

After round N: summary (score trend per axis, before/after sheet next to the targets, open M-items), then the playtest checkpoint and a new budget. Say where the game stands on the way to the vision and what the next rounds would improve, so the user sees it as a step, not a verdict.

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
| Stopping early / asking "shall I continue?" inside the budget | Run all N rounds; ask only at the budget end |
| Fixers editing the same file | Disjoint ownership table in every brief |
| Fixing polish before values/lighting | Values and lighting first; they change every other judgement |
| Low-key look that hides the player | Keep the readability floor (player/HUD luma contrast) from ART_BIBLE.md |
| Endless loop on visuals while the game isn't fun yet | Prove the core loop with greybox first; the vision loop starts after the first playable |
