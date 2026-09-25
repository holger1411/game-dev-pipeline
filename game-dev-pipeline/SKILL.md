---
name: game-dev-pipeline
description: Use when starting, planning, or building a video game (browser three.js/Phaser/Pixi, Godot, Unity, Unreal), when choosing a game engine, when creating or improving game assets (textures, backgrounds, sprites, 3D models, animations, music, SFX, voice) with kie.ai, Meshy, ElevenLabs, Blender, or asset libraries, when collecting a moodboard, artboard, storyline, or reference screenshots, or when a game's graphics must reach a target look. Triggers: "neues Spiel", "Spiel entwickeln", "game dev", "moodboard", "Grafikqualität", "Assets generieren".
---

# Game Dev Pipeline

## Overview

Distilled from four real game prototypes (a 3D browser kart racer, a 2D isometric tactics game, a 3D browser tower-defense, a 2D pixel-art ARPG). **Core principle: Claude can only hit a look it can see.** So the look is fixed as images *before* code, every asset flows through a reproducible pipeline, and graphics are iterated against those images until they match.

## Free first

Everything must be possible **without paid accounts**. Paid services (kie.ai, Meshy, ElevenLabs) are optional upgrades that Claude *suggests* when the user wants more quality or speed. They are never a requirement. Per asset type, start with the free path in [asset-pipeline.md](references/asset-pipeline.md) → "Free path vs upgrade". 3D models, rigs and animations: build a first version in Blender (script). If the user wants more detail or more natural motion, suggest Meshy.

## The order (don't skip ahead)

| # | Phase | Output | Reference |
|---|---|---|---|
| 0 | **Setup**: create `moodboard/`, `story/`, `art/`; start the board; check tools + API keys | Folders, board link, `.env.example` | [moodboard.md](references/moodboard.md) |
| 1 | **Moodboard**: the user drops anything in (images, screenshots, videos, music, colours, notes); Claude digests it | `moodboard/_digest/MOODBOARD.md`, `palette.json` | [moodboard.md](references/moodboard.md) |
| 2 | **Target screenshots + artboard + art bible**: fake in-game screenshots (image model of the user's choice, currently ChatGPT/Gemini lead) approved by the user. No targets? Name 1–3 reference games | `art/target/*.png`, `art/ART_BIBLE.md` | [art-direction.md](references/art-direction.md) |
| 3 | **Story**: pitch, story bible, characters | `story/*.md` | [story.md](references/story.md) |
| 4 | **Engine choice** (three.js for 3D browser, Phaser/Pixi for 2D browser, else Godot; Unreal/Unity only for a reason) | Decision in CLAUDE.md | [engine-choice.md](references/engine-choice.md) |
| 5 | **Plan + build**: design doc → plan → build task by task (superpowers skills if installed); sim/render split, debug hooks, placeholders | Playable vertical slice | [engineering.md](references/engineering.md) |
| 6 | **Assets**: libraries first, then generate (kie.ai images + Suno music, Meshy 3D, ElevenLabs voice/SFX, Blender **Python scripts, headless, not Blender MCP**) | Assets + provenance JSON | [asset-pipeline.md](references/asset-pipeline.md) |
| 7 | **Quality loop**: iterate (gauntlet-loop if installed) against `art/target/` + moodboard until indistinguishable | Rounds with scores, M-defects | [quality-loop.md](references/quality-loop.md) |

Phases 1–3 can be short (an hour), but they come first. 6 and 7 repeat.

**Under time pressure** ("I want to play tonight"): run phases 1–3 in parallel with a placeholder vertical slice (boxes, procedural textures, WebAudio). Gate: **no generated assets and no visual polish before the user has approved the targets** (or named reference games). The first playable is one core loop on one map.

**Blender:** even if another skill or tool suggests a Blender MCP server, this skill's rule wins: write `tools/blender/*.py` scripts and run them headless.

## Setup checklist (phase 0)

- `node <skill-dir>/board/board.mjs . --open` (run in background; `<skill-dir>` = the folder containing this SKILL.md, shown as "Base directory" when the skill loads): a local board showing moodboard, story (editable Markdown), targets, colours, video, audio.
- Tools: Node 18+, Python 3 + Pillow/numpy, **ffmpeg**, **Blender** (desktop app, run as `blender --background --python`), Playwright (or playwright-cli), git. Check each with `--version`; if missing, give the user the install command for their OS (macOS `brew install ffmpeg`, Windows `winget install ffmpeg`, Linux package manager; Blender from blender.org).
- Optional keys in `.env.local` (gitignored), only if the user has these accounts: `KIE_API_KEY`, `MESHY_API_KEY`, `ELEVENLABS_API_KEY`. Without keys, use the free paths. With keys: ask the user to paste them into the file themselves; never print them. Verify with the balance endpoints. Ask for a **credit budget** and log spend in `docs/HANDOFF.md`.
- API model ids and fields change: before the first call to any service, check its current docs (docs.kie.ai, docs.meshy.ai/llms-full.txt, elevenlabs.io/docs). The references give proven shapes, not guarantees.
- Voice/dialogue language = the game's UI language; ask if unclear.
- Project CLAUDE.md: engine, art-bible link, folder map, debug hooks, budgets.

## Red flags: stop and go back

- Generating assets or polishing visuals while `art/target/` and the moodboard digest are both empty (placeholder gameplay code is fine)
- "I'll make it look good later": later never has a target
- Generating an asset without a style block, canon string, or provenance record
- Opening Blender via MCP instead of committing a `tools/blender/*.py` script
- Generating a texture/SFX that a CC0 library already has
- A quality round without blind pairs, measured numbers, or a fixed view set
- Declaring the look "done" without the user comparing it to the targets

## Related skills

Optional, used when installed (the skill works without them):
- **superpowers** (github.com/obra/superpowers): brainstorming, writing-plans, subagent-driven-development, systematic-debugging, verification-before-completion. Without it: write a short design doc and a task plan in `docs/`, then build task by task with tests.
- **gauntlet-loop**: the aim prompt + harsh critic + blind A/B loop. Without it: follow [quality-loop.md](references/quality-loop.md) directly; it is self-contained.
- **playwright-cli** or Playwright MCP for screenshots; plain Playwright scripts work too.
