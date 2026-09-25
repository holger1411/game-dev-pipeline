# Asset Pipeline

## Image model choice

**The user picks the image model; it's their call and models improve constantly.** Experience so far: the **ChatGPT (GPT Image)** and **Google Gemini (Nano Banana)** families give the best results, ChatGPT currently ahead. That ranking changes, so ask the user which model to use (or suggest the current leader), record it in `art/ART_BIBLE.md`, and keep it for all assets of one kind so the style stays consistent. kie.ai offers most of these through one API, so switching is just a different `model` id. When a new model appears, compare it with a small A/B batch before switching mid-project.

## Decision table: where does each asset come from?

| Asset | First choice | Alternatives |
|---|---|---|
| Target screenshots, concept, artboard | ChatGPT image / kie.ai image models | Midjourney (`--sref` for style lock) |
| Tileable textures (ground, walls, facades) | **Free libraries** (ambientCG, Poly Haven), else kie.ai image + make tileable | Procedural Canvas2D/shader textures (two prototypes shipped with zero texture files) |
| Backgrounds, skyboxes, portraits, icons, UI art | **kie.ai image** (model of the user's choice, see above) | Poly Haven HDRIs for skies |
| 2D sprites (characters, monsters, items) | kie.ai image → chroma key → palette quantize | Image → Meshy 3D → Blender render to 8 directions |
| 3D props / buildings / vehicles | **Blender Python script** (bmesh, headless) | Kenney / Quaternius / Poly Pizza (CC0), Poly Haven models |
| 3D characters / creatures | kie.ai concept → **Meshy image-to-3D** → remesh → rig → animate | Quaternius/Kenney rigged packs, Mixamo animations |
| Improving an existing 3D model | **Meshy** remesh / retexture / rigging / animation | Blender scripts (decimate, UV, bake) |
| Music | **kie.ai Suno API** (instrumental) | Free libraries (OpenGameArt, Pixabay Music) |
| SFX | **Libraries first** (Kenney audio, freesound CC0, Sonniss GDC bundles), then **ElevenLabs sound-generation** | Synthesized WebAudio (engine sounds, UI blips) |
| Voice / narration / barks | **ElevenLabs TTS** | Text bubbles (cheap fallback) |
| Baseline audio from day 1 | Procedural WebAudio (oscillators + noise, drones) | Replaced by files later (one prototype shipped fully procedural audio) |
| Fonts | Google Fonts (check OFL) | |

**Libraries before generation.** Free, consistent, and license-clear assets beat generated ones for textures, SFX, and generic props. Generate what is unique to the game (hero, key art, music, voice).

Free libraries (check each license, prefer CC0):
- Textures/HDRIs/models: ambientCG, Poly Haven, Kenney.nl, Quaternius, Poly Pizza, Sketchfab (filter CC), OpenGameArt
- Audio: freesound.org (filter CC0), Kenney audio packs, Sonniss GDC bundles, OpenGameArt, Pixabay (music + SFX)
- Animations: Mixamo (free with Adobe account; FBX), Meshy animation library

## Generator script rules (apply to every API)

1. **API keys only from env** (optional fallback: macOS Keychain) (`KIE_API_KEY`, `MESHY_API_KEY`, `ELEVENLABS_API_KEY`) via `.env.local` (gitignored), with a `.env.example` listing the names. Never log or commit keys.
2. **Idempotent CLI**: skip files that exist; `--force` and `--only id1,id2` flags.
3. **Submit all, then poll together.** Generation is slow (images 20–50 s, Meshy 3–6 min, music 1–3 min): run batches in the background.
4. **Download result URLs immediately.** kie.ai and Meshy URLs expire (kie music: 14 days, kie image temp files: shorter, Meshy: signed URLs with `Expires`).
5. **Provenance record per asset**: `assets/source/<id>.json` with prompt, model, taskId, credits, date, post-processing steps, license. A test checks every referenced file exists (case-sensitive: read the directory, because macOS `existsSync` is case-insensitive).
6. **Never delete raw sources.** Generation is non-deterministic, so the raw file cannot be recreated. Keep `assets/source/` (committed or backed up); derived renders may be gitignored.
7. **Measure the output, don't trust it**: generators ignore requested aspect ratios (up to 2.3× off), paint checkerboards instead of transparency, and deliver magenta as a gradient (`#D42C84`, not `#FF00FF`). Check it with code.
8. **Contact sheet** for review: after a batch, tile all results into one image (PIL) and look at them together. Consistency problems only show side by side.
9. Credits: check the balance before and after a batch (kie `costCredits` may be `null`).

## kie.ai (images, music) — https://docs.kie.ai

Auth: `Authorization: Bearer $KIE_API_KEY`. Credits: `GET https://api.kie.ai/api/v1/chat/credit`.

### Images (request shape proven in several projects; the model id is interchangeable)
```
POST https://api.kie.ai/api/v1/jobs/createTask
{"model":"google/nano-banana","input":{"prompt":"...","output_format":"png","image_size":"1:1"}}
→ data.taskId

GET  https://api.kie.ai/api/v1/jobs/recordInfo?taskId=<id>      (poll every ~6 s)
→ data.state: "success" | "fail";  json.loads(data.resultJson)["resultUrls"][0];  on fail: data.failMsg
```
- ~4 credits, 20–50 s per image. Run ~8 jobs in parallel; generate only missing `art_raw/<id>.png`.
- **Consistent variants** (poses, open/closed states): `google/nano-banana-edit` with `image_urls: [<kie result URL of the earlier generation>]`. No upload needed while the URL is alive.
- Edit-model input shape: `{"prompt","aspect_ratio":"16:9","output_format":"png","image_urls":[...]}`. Field names differ per model (`image_size` vs `aspect_ratio`): check the model page.
- Key storage: env first; optionally the OS keychain (macOS `security find-generic-password -s <name> -w`, Windows Credential Manager, Linux `secret-tool`).
- Other market models (GPT Image 2, nano-banana pro/edit with reference images, Seedream, Flux Kontext, Recraft remove-background) use the same createTask/recordInfo pattern with a different `model` + `input`. Look up the exact model id and input fields on docs.kie.ai before use; don't guess.
- For image-to-image (style lock), input images must be **public URLs**: upload to a temp host or use a URL the API can fetch.
- Keep a shared **STYLE string** separate from per-subject descriptions; concatenate at request time .
- Background removal: generate on magenta → own chroma key (border flood-fill, 3 px fringe erosion, desaturate leftover magenta), or kie's Recraft remove-background.

### Music (Suno via kie)
```
POST https://api.kie.ai/api/v1/generate
{"customMode":true,"instrumental":true,"model":"V5","style":"dark ambient orchestral, low strings, 90 bpm, loopable",
 "title":"Night Siege","callBackUrl":"https://example.com/cb"}        # callBackUrl is required; any URL works if you poll
→ data.taskId

GET https://api.kie.ai/api/v1/generate/record-info?taskId=<id>        (poll every ~30 s)
→ data.status: PENDING | TEXT_SUCCESS | FIRST_SUCCESS | SUCCESS | *_FAILED | SENSITIVE_WORD_ERROR
→ data.response.sunoData[].audioUrl   (2 variations per request, files kept 14 days)
```
- `customMode:false` = only `prompt` (short idea); `customMode:true` + `instrumental:true` = `style` + `title`.
- Game music: always `instrumental:true`, name tempo/instruments/mood, "loopable", no vocals. Generate one track per game state (menu, explore, combat, victory, defeat).
- Post: ffmpeg trim + loudness normalize (`loudnorm=I=-16`) + encode to OGG/MP3 (~128–160 kbps). Find the loop point by ear or crossfade the tail.
- Runtime (web): stream long music via `HTMLAudioElement`, not a decoded AudioBuffer; music ~0.3–0.4 below SFX level; fades ~1 s.

## Meshy (3D generation and improvement) — https://docs.meshy.ai (llms-full.txt, openapi.yaml)

Auth: `Authorization: Bearer $MESHY_API_KEY`. Base `https://api.meshy.ai/openapi/`. Balance: `GET /openapi/v1/balance`. All tasks: POST → id, then `GET <endpoint>/<id>` until `status == "SUCCEEDED"` (or the `/stream` SSE endpoint).

| Task | Endpoint | Notes |
|---|---|---|
| Image → 3D | `POST v1/image-to-3d` | `image_url` as **data: URI** (fetching kie URLs gave 403). proven: `topology:"triangle", target_polycount:30000, should_texture:true, symmetry_mode:"auto"`; ~15 credits, 3–6 min. `model_type:"lowpoly"` for clean game meshes |
| Text → 3D | `POST v2/text-to-3d` | two steps: `mode:"preview"` (mesh) then `mode:"refine"` with `preview_task_id` (texture) |
| Remesh | `POST v1/remesh` | `input_task_id` or `model_url`; `topology: quad/triangle`, `target_polycount`, `origin_at:"bottom"`. Use before rigging (>300k faces rejected) |
| Retexture | `POST v1/retexture` | new style on an existing mesh, e.g. to match the art bible |
| Rigging | `POST v1/rigging` | humanoid textured GLB, `height_meters`; returns rigged GLB/FBX + basic walking/running |
| Animation | `POST v1/animations` | `rig_task_id` + `action_id` or `action_ids` (up to 10 → one file, one clip per action, good for state machines); list: `GET v1/animations` library |

**Non-humanoid rigs** (mechs, vehicles, turrets, quadrupeds): Meshy rigging is humanoid-only. Build them as a **hierarchy of rigid parts** (Blender script: separate objects for hull, turret, upper/lower leg, foot with pivots at the joints, exported as one GLB). Animate procedurally in the engine (leg IK, turret aim, recoil) or keyframe in the Blender script. For generated meshes: split the Meshy mesh into parts in Blender by vertex groups or bounding regions.

Pitfalls: Meshy exports add helper objects (e.g. an Icosphere marker): drop objects without material and <100 verts. Skinned-mesh bounds via `bound_box` can be off by 400×: measure through the depsgraph. Strip root motion for in-place game animations. Topology quality matters little at sprite size, but a lot for close-up 3D: remesh + check in Blender.

## ElevenLabs (voice + SFX) — https://elevenlabs.io/docs

Auth header: `xi-api-key: $ELEVENLABS_API_KEY`. Both calls are **synchronous** (bytes in response, no polling).

```
# Voice (TTS)
POST https://api.elevenlabs.io/v1/text-to-speech/<voice_id>?output_format=mp3_44100_128
{"text":"...","model_id":"eleven_multilingual_v2","voice_settings":{"stability":0.5,"similarity_boost":0.75}}
# list voices: GET /v1/voices ; pick one voice per character and record the voice_id in the provenance file

# Sound effects (proven in a kart racer)
POST https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_96
{"text":"short metallic item pickup chime, racing video game, no music","model_id":"eleven_text_to_sound_v2",
 "duration_seconds":0.8,"prompt_influence":0.6,"loop":false}
```
- Check the current model ids in the docs (e.g. newer `eleven_v3` for expressive voice).
- **Loops: request `output_format=pcm_22050` and wrap the bytes in a WAV header yourself.** MP3 has encoder silence at the start, which clicks when looping.
- End SFX prompts with genre context and exclusions ("…, racing video game, no engine, no music").
- Write `manifest.json` (file, loop, seconds, prompt) and a **per-sound gain table**; log peak/RMS to normalise.
- Some sounds generate badly (an engine loop "sounded like rattling cups"). Synthesize those instead (WebAudio oscillators + filters, pitch from RPM).
- Runtime: nothing plays before a user gesture (browser audio unlock); audio methods never throw; synth fallback while files load.

## Blender: Python scripts, headless (no Blender MCP)

Blender must be installed locally: macOS `/Applications/Blender.app/Contents/MacOS/Blender`, Windows `C:\Program Files\Blender Foundation\Blender <ver>\blender.exe`, Linux `blender` on PATH. Store the path in `BLENDER` env if it isn't on PATH. Claude writes `tools/blender/*.py` and runs them:

```bash
"${BLENDER:-blender}" --background --factory-startup --python tools/blender/build-kart.py -- --out public/assets/kart.glb
```
(Arguments after `--` are read in the script with `sys.argv[sys.argv.index("--")+1:]`.)

Why scripts, not the MCP: reproducible (committed, re-runnable in CI), diffable, no live-session state, can run in parallel, and builds can fail loudly on budgets.

Script checklist:
- Build from `bmesh` primitives / modifiers; name objects deterministically.
- Document the **axis convention** (glTF is +Y up; export with `export_yup=True`; decide what "forward" is).
- **Budgets that abort the build**: triangle count per model, file size per GLB (e.g. 3k tris kart, 1.5 MB per landmark).
- Export GLB with Draco (`export_draco_mesh_compression_enable=True`); copy the Draco decoder into the web app.
- **Verify after export**: re-parse the GLB, assert UVs present, Draco on, no embedded images if not intended; write a `manifest.json` (tris per node, bbox, special dimensions).
- Low draw calls: UV-palette trick. All faces map to cells of one small palette texture (painted at runtime for liveries) → 1–2 materials per model.
- Look up shader nodes by `type`, never by localized name; don't hardcode enum values across Blender versions.
- For sprite rendering: orthographic camera, 8 directions, 4× supersample, EEVEE, `film_transparent`, **view transform "Standard"** (AgX/Filmic desaturate and break palettes), camera + lights parented to one rotating empty, one global scale from a prepass over all directions/frames, animation motion check (fail if the silhouette barely changes).
- Every tool script gets a `--self-test` that runs in the test suite.

## Prompt manifest with locked style blocks

Keep all prompts in one manifest (`tools/manifest.mjs`: `id → [aspect, prompt]`), built from **constant style blocks per asset class**: SPRITE, TEX, GROUND, ICON, PORTRAIT, DECALS (sheet of ~30), PATCHES (3×3 sheet), SCENE (16:9 cutscene). Plus **canon strings** per character (`HERO`, `MENTOR`) reused verbatim.
- Sprites/icons/decals: solid `#FF00FF` background, no shadow, no ground plane. Portraits: dark solid background.
- The word **"tileable" makes the model paint small repeating wallpaper**. Ground prompts omit it; make it seamless in post.
- The file prefix selects the post-processing path (`t_` texture, `d_` decal sheet, `c` cutscene, `k_` skill icon, `i_` item icon, else sprite).
- Keep rejected versions in `art_raw/_old/`; `art_raw/` (raw, large) is backed up, not shipped.

## 2D post-processing (pixel art / sprites)

A proven `tools/process.py` (numpy/PIL/scipy), raw → `public/assets/`:
- **Sprites**: magenta key via border flood-fill (distance to border median + "magness"), also key enclosed pockets (between legs), erode fringe 3×, despill → trim → premultiplied BOX downscale to a **per-asset display height** → hard alpha → remove specks, darken outer rim to a 1 px outline → NEAREST ×2 (one art pixel = one world pixel for everything).
- **Grade tables encode the art direction**: flora muted (brightness/contrast/saturation ≈ 0.72/0.9/0.62), actors boosted (1.04/1.1/1.08); per-sprite hue shift/tint so enemies don't hide in flora.
- **Textures**: flatten baked lighting (divide by gaussian blur σ≈90), crop vignettes, make seamless (half-offset copy + noisy blob mask), BOX to 256, quantize (e.g. 96 colours, no dither).
- **Decal/patch sheets**: split connected components into an atlas.
- **Cutscenes**: strip baked letterbox bars, cover-crop, JPG q90.

General rules:
- Downscale with BOX/area filter, never NEAREST when shrinking; produce each target size from the source (never halve a halved image).
- Quantize to the art-bible palette in **Oklab** (nearest colour), per-category palette subsets.
- Hard alpha edge, optional 1 px outline, snap subject to the bottom ("feet on the ground").
- Iso tiles: measure the real rhombus, resample, apply an exact mathematical mask, self-test that tiles cover the plane without gaps.
- Precompute derived data (average colours, painted bounding boxes for hit areas) at build time into TS tables, never measure pixels at runtime.

## Runtime loading

- Placeholder first, real asset swapped in when loaded (procedural portrait → JPEG; box kart → GLB). The game never blocks on or crashes from a missing asset.
- three.js: GLTFLoader + DRACOLoader (+ KTX2Loader for compressed textures); convert imported materials into the game's material system so lighting stays consistent.
- Record the license next to every asset folder (`LICENSE.md` / provenance JSON).
