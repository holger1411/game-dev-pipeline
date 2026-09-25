# Art Direction: Target Screenshots, Moodboard, Artboard

Claude cannot aim at "make it look good". It can aim at an image. This phase produces the images that every later quality decision is measured against.

## Folder layout (create in the game repo)

```
art/
  target/        # 3–6 "fake in-game screenshots" = THE quality bar (binding)
  artboard/      # character/prop/UI sheets in the locked style, turnarounds, icons
  ART_BIBLE.md   # the written style rules (see template below)
  prompts.md     # every prompt that produced a kept image + model + date
moodboard/       # the inspiration inbox at repo root, see moodboard.md
```

Reference images from commercial games are for internal comparison only: keep them in the repo but gitignore them if the repo is public.

## Step 1: Generate target screenshots (before any code)

Use the strongest current image model (the user decides; so far ChatGPT/GPT Image and Gemini/Nano Banana lead, ChatGPT currently ahead): interactively in ChatGPT/Gemini, or via kie.ai API (see asset-pipeline.md → Image model choice). Ask for *in-game screenshots*, not concept paintings:

```
In-game screenshot of a [genre] video game, [camera: third-person over-shoulder /
isometric 30° / top-down], [scene: what is on screen], [HUD: minimal health bar
bottom-left, minimap top-right], rendered in real time in [engine-like look:
stylized PBR / low-poly flat-shaded / pixel art 1280x720], [lighting: low warm sun,
long shadows, blue-green fill, light haze], [palette: dark olive, rust, bone white],
[reference feel: like Manor Lords meets Hades]. 16:9, no text other than HUD, no watermark.
```

- Make 3–6 images covering the **main views** of the game (gameplay, menu, a busy moment, a quiet moment, night/weather if relevant).
- Iterate with the user until they say "yes, that's the game". These images are **binding**: camera, UI density, palette, lighting.
- Write the prompt that worked into `art/prompts.md`.
- Use Midjourney `--sref <url>` or the kept images as reference input for all later generations, so everything stays in one visual language.

## Step 2: Moodboard (always, and mandatory if no target screenshots)

Process the `moodboard/` inbox into `moodboard/_digest/MOODBOARD.md` (see moodboard.md). Ideally do this *before* step 1, so the target prompts are built from the digest.

If the user has neither target screenshots nor moodboard material, **pick 1–3 known games as the reference** ("Forza Horizon 4 lighting", "Manor Lords atmosphere", "Hades readability") and collect 10+ screenshots of them into `moodboard/ref-<game>/`. A subagent can web-search and `curl` them.

## Step 3: Artboard

Sheets in the locked style: hero character (front/3/4/side), 3–5 enemies, key props, UI elements, icon style. These become the inputs for image-to-3D (Meshy) or sprite pipelines.

Proven asset-prompt shape:
- one object, one three-quarter view
- flat neutral grey or **magenta** background (for chroma key), no shadow, no ground
- the palette's hex colours named in the prompt: post-processing can map colours but not invent them
- "no text, no turnaround, no frame, no watermark"

## Step 4: ART_BIBLE.md (write it, Claude reads it every round)

```markdown
# Art Bible: <Game>
Reference: art/target/*.png (binding), moodboard: <games>
Camera: <FOV/angle/height>. Internal resolution: <e.g. 1280x720, integer scaling>
Palette: <hex ramps, max N colours for pixel art>; value structure: <low-key/high-key>
Lighting: key:fill ≈ <5:1>, sun colour <#ffc585>, sky fill <#8fa9c8>, fog/haze colour = sky horizon
Materials: <PBR / flat / toon>; roughness range; no pure black, no pure white
Readability (non-negotiable): minimum luma contrast player/HUD vs background = <measured>, silhouettes, player/enemy contrast vs ground ≥ <measured>,
  colour never the only signal, HUD never washed out by bloom
Style don'ts: <e.g. no lime greens, no plastic specular, no mixed tree styles>
```

Measure numbers from the target images (average luma, dominant hues, contrast) and write them in, e.g. "meadow albedo ≈ RGB(86,100,50)".

## Common mistakes

| Mistake | Fix |
|---|---|
| Starting to code before a target look exists | The code converges to "programmer art", and later changes cost more |
| Concept paintings instead of in-game screenshots | Paintings have no HUD, no real camera, impossible lighting. Ask for *screenshots* |
| Deciding the style while gameplay is still unclear (2D tactics) | Legit exception: prototype with placeholders first, but lock the art bible before producing assets |
| Mixed styles from different generators | One style reference image (`--sref` / image input) for every generation, then post-process uniformly |
