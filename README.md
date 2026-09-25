# game-dev-pipeline: an agent skill for making games with AI assets

A Claude Code skill (it also works with other agents that read `SKILL.md` skills) for building video games with AI coding agents. It covers the whole path from **moodboard to a polished build**: lock the look as images first, produce assets through reproducible pipelines, then iterate the graphics against those images until they match.

It comes from four real game prototypes: a 3D browser kart racer, a 2D isometric tactics game, a 3D browser tower-defense, and a 2D pixel-art ARPG.

## Workflow

0. **Setup**: folders, local board, tools, API keys
1. **Moodboard**: drop anything (images, screenshots, videos, music, colours, notes) into `moodboard/`; the agent writes a digest
2. **Target screenshots + art bible**: fake in-game screenshots from an image model; they are the binding quality bar
3. **Game one-pager + story**: core loop, verbs, win/lose, scope; story bible, character files
4. **Engine choice**: three.js (3D browser), Phaser/PixiJS (2D browser), Godot (default otherwise), Unreal/Unity when justified
5. **Plan + build**: prove fun first (greybox), gameplay test contract, tuning panel, game feel
6. **Assets**: free libraries first, then kie.ai (images, Suno music), Meshy (3D, rigging, animation), ElevenLabs (voice, SFX), Blender Python scripts (headless)
7. **Vision loop**: iterate against *your* vision (moodboard + targets) for a fixed round budget (e.g. 5 or 10): blind critic, measured defects, parallel fixers, then a human playtest
8. **Ship**: web/itch/Steam deploy, release checklist, AI-content disclosure from provenance

## Contents

```
game-dev-pipeline/
  SKILL.md                  # entry point: phases, setup, red flags
  references/
    moodboard.md            # inspiration inbox, digest, board
    art-direction.md        # target screenshots, artboard, ART_BIBLE
    story.md                # GAME.md one-pager, story/ folder, character bibles
    engine-choice.md        # engine decision table + capture hooks
    asset-pipeline.md       # kie.ai, Meshy, ElevenLabs, Blender, libraries, provenance
    quality-loop.md         # vision loop: round budget, critic, fixers, STATE.md
    game-feel.md            # latency, hitstop, shake, tuning panels
    shipping.md             # deploy, stores, AI disclosure, release checklist
    engineering.md          # architecture, testing, performance, multi-agent rules
  board/board.mjs           # local zero-dependency board: images, video, audio, colours, editable story Markdown
```

## Install

```bash
git clone https://github.com/holger1411/game-dev-pipeline.git ~/game-dev-pipeline-repo
ln -s ~/game-dev-pipeline-repo/game-dev-pipeline ~/.claude/skills/game-dev-pipeline
```

**Requirements:** Node 18+, Python 3 with Pillow and numpy, ffmpeg, Blender, and Playwright.
**Optional paid services** (bring your own keys, never required; every step has a free path): kie.ai, Meshy, ElevenLabs.
**Optional skills:** [superpowers](https://github.com/obra/superpowers). The skill works without it; its iteration loop ("vision loop") is built in.

## The board

```bash
node game-dev-pipeline/board/board.mjs /path/to/your/game --open
```

The board shows `moodboard/`, `story/`, `art/` and the game's `assets/` (inspiration next to real assets) as a canvas you can arrange freely:
- images and video
- 3D models (glb/gltf), with orbit controls and playable animations
- audio players
- colour swatches
- Markdown that you can edit in place

Files you drop onto the board are copied into the project. New files show up live. The board serves only on 127.0.0.1.

## Notes

- Research notes: compared with other game-dev agent skills (2026-09); ideas adopted with credit to the approach, not the code.
- Image models change fast. The skill leaves the choice to you; so far, ChatGPT and Gemini image models have led.
- API endpoints and fields reflect the state in 2026. The skill tells the agent to check current docs before the first call.

## License

MIT, see [LICENSE](LICENSE).
