# Moodboard: the inspiration inbox

The user throws **anything** into one folder, without sorting or explaining. Claude turns it into a digest that it (and every subagent) reads before visual, audio, or style decisions.

## Folder

```
moodboard/                 # INBOX: user drops anything here, any structure, any names
  (images, screenshots, .mp4/.mov/.webm, .mp3/.wav/.ogg/.flac, colors.txt, .ase/.gpl palettes,
   links.txt with YouTube/Spotify/ArtStation/Pinterest URLs, notes.md, PDFs, font files)
  _digest/                 # Claude-owned, regenerated; never edit by hand
    MOODBOARD.md           # the digest: what the game should feel/look/sound like
    palette.json           # merged colour palette (hex + role + source)
    sheet-*.png            # contact sheets (images + video frames)
    frames/<video>/*.jpg   # extracted keyframes
    audio.md               # per-track analysis + derived music/SFX prompts
    index.json             # file → hash → processed-at (so re-runs only process new files)
```

Create `moodboard/` in the first session and tell the user: "Drop anything here (pictures, screenshots, videos, music, colours, links, notes) and say *update moodboard*."

## Processing (run on "update moodboard", at project start, and before every quality round)

Only process files whose hash is not in `_digest/index.json`. For each type:

| Type | What Claude does |
|---|---|
| **Images / screenshots** (png, jpg, webp, heic, gif) | Look at each (Read tool). Note: subject, camera/angle, lighting (key direction, colour temperature, contrast ratio), palette, materials, UI/HUD density, mood words. Extract 5–8 dominant colours (PIL `quantize` / k-means), convert HEIC with `sips -s format png` |
| **Videos** (mp4, mov, webm, mkv) | `ffprobe` duration → extract keyframes: `ffmpeg -i in.mp4 -vf "select='gt(scene,0.3)',scale=640:-1" -vsync vfr -frames:v 12 _digest/frames/<name>/%02d.jpg` (fallback: `fps=1/<duration/12>`). Then treat the frames like images. Also note motion: camera movement, animation speed, FX, pacing, cuts. Extract the audio track (`ffmpeg -vn`) and analyse it like music |
| **YouTube / web video links** (in links.txt or notes) | Use a video-analysis tool if available (e.g. yt-analysis `summarize_video` / `extract_screenshots`); else `yt-dlp` if installed, then as above |
| **Music / audio** (mp3, wav, ogg, flac, m4a) | `ffprobe` tags + duration; loudness `ffmpeg -i x -af ebur128 -f null -`; tempo/key with `librosa` if installed (`beat_track`, chroma). Claude cannot listen, so combine metadata + analysis + filename + user notes into a description: genre, tempo (BPM), instruments, energy, loopability. Derive a **ready-to-use Suno style prompt** (`instrumental:true`) per track into `audio.md`. For SFX references, derive ElevenLabs sound prompts |
| **Colours** (colors.txt with hex/rgb/names, .ase, .gpl, .aco, swatch images) | Parse into `palette.json` with a role guess (background, key light, accent, danger, UI). Swatch images: sample the colour patches |
| **Notes / text / PDFs** | Treat as the user's explicit intent: quote them in MOODBOARD.md, they outrank Claude's interpretation |
| **Fonts** | List as UI font candidates (check the license) |
| **Links** (ArtStation, Pinterest, Spotify…) | Fetch what is fetchable (images, titles); list the rest as "unverified reference" |

Then build contact sheets (PIL: all images + 1–2 frames per video, 4–6 columns, filename labels) and **look at the sheets as a whole**: the overall impression matters more than single files.

## MOODBOARD.md (the output contract)

```markdown
# Moodboard digest (updated <date>, <n> items)
## One-line vibe
<e.g. "Low-key rural 70s horror at dusk: warm sodium light against cold blue fog, gritty, quiet, then violent">
## Visual pillars (3–5, each with the files that show it)
- Low sun, long shadows, key:fill ≈ 5:1 — ref_03.jpg, clip_farm/04.jpg
## Palette  (see palette.json)
| Role | Hex | Source |
## Lighting & atmosphere
## Materials & surfaces
## Characters & silhouettes
## UI / HUD
## Motion & FX (from videos)
## Audio direction (from music/videos) + ready Suno/ElevenLabs prompts
## Explicit user notes (verbatim)
## Contradictions / open questions   ← ask the user about these, don't silently pick
## Anti-references (what it must NOT look like)
```

## How the digest is used

- **Target screenshot generation** (art-direction.md): feed the pillars + palette into the prompt; attach the 2–3 strongest images as reference input.
- **ART_BIBLE.md** takes its numbers from `palette.json` and the lighting notes.
- **Music/SFX generation** starts from the prompts in `audio.md`.
- **Quality loop**: the critic gets `MOODBOARD.md` + `sheet-*.png` + `art/target/` as the reference set.
- When the moodboard changes after the art bible is locked, list what changed and ask the user whether the bible should follow. Don't drift silently.

## Viewing and editing: the bundled game board

The skill ships `board/board.mjs`, a zero-dependency local board (Node 18+). Start it in the game repo (in the background) and give the user the link:

```bash
node <skill-dir>/board/board.mjs . --port 4777 --open
```

- Infinite canvas with lanes: **Story** (`story/*.md`), **Target shots** (`art/target/`), **Colours** (`colors*.txt`, `.gpl`, `.hex`, `palette.json`), **Images**, **Videos**, **Audio** (players), **Notes**, **Other**.
- Drag cards by the header, resize at the corner, pan by dragging the background, zoom with pinch or cmd/ctrl + wheel, filter by name/type, double-click an image to enlarge it.
- **Markdown is editable**: Edit/Save (Cmd+S) writes straight into the file. "+ Story" creates `story/<name>.md`, "+ Note" creates `moodboard/<name>.md`, "+ Colour" appends to `moodboard/colors.txt`.
- Drop files from the desktop onto the board: they are copied into `moodboard/` (`.md` goes to `story/`).
- It polls the disk every 3 s, so assets Claude generates appear live. The layout is stored in `moodboard/_board/layout.json` (commit it if the arrangement matters).
- Serves only `moodboard/`, `story/`, `art/`, bound to 127.0.0.1.

Claude reads the files, not the layout. If the user groups things on the board, ask them to mirror important groups as subfolders or notes.

Alternatives if the user prefers an existing tool (none plays audio or edits Markdown): BeeRef (open source, PureRef-like), PureRef (free), tldraw/Excalidraw (open-source whiteboards), Penpot (open-source Figma).
