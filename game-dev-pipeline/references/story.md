# Story: story/ folder

Story lives in Markdown in `story/`. The user edits it directly or on the board (`board/board.mjs`), and Claude reads it before writing dialogue, quests, level beats, item texts, voice lines, or cutscene prompts.

## Files

```
story/
  STORY_BIBLE.md     # master canon: premise, world rules, timeline, tone, themes; the consistency reference
  pitch.md           # 1 page: fantasy, player verb, hook, reference games
  characters/<id>.md # one per NPC/hero (NPC bible): background, goal, what they know / don't know,
                     #   speech style (sentence length, slang, tics), relationships, portrait/voice ids
  chapters/NN-*.md   # beats per chapter/level: goal, obstacle, reveal, set pieces, required assets
  dialogue/*.md      # actual lines, keyed by id (so code and voice files reference ids, not text)
  barks.md           # short combat/idle lines per character (voice generation batch input)
```

Start with `pitch.md` + `STORY_BIBLE.md`. Create character files as characters appear; don't pre-write a novel.

## Rules (learned the hard way)

- **Dialogue must not sound AI-generated.** Every line is written *from* a character file (speech style, knowledge). Characters only say what they know. Cut filler, speeches, and "As you know…" exposition. After a writing pass, run a separate critic subagent that checks every line against the character file and STORY_BIBLE (one pass produced ~70 line fixes).
- **One canon string per character** (appearance, outfit, colours) reused verbatim in every image prompt (sprite, portrait, cutscene), so they look the same everywhere.
- **Every NPC gets a sprite + portrait** (+ voice id if voiced). Record the ids in the character file.
- **No invisible gates**: every block has a visible barrier and a character line explaining it. Anything that looks lootable is lootable.
- Key story beats get an interstitial image (kie.ai, SCENE style block, 16:9).
- Timers and objectives are visible on screen.

## Story ↔ code

- Keep narrative scripting separate from engine code: a small **Director API** (`enterInterior`, `openBarrier`, `spawnWave`, `say(charId, lineId)`, `hooks.onKill`) that the story/quest script calls. The story script then reads like the chapter file.
- Dialogue and UI text come from data files keyed by id. That makes localisation and voice generation (ElevenLabs, one voice id per character) a batch job.
- A test checks that every line id referenced in code exists and every voiced line has an audio file.
