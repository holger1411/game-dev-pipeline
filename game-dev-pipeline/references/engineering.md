# Engineering: structure, testing, performance

**If the superpowers skills are installed, use them:** brainstorming → writing-plans → subagent-driven-development / executing-plans, test-driven-development for rules/sim code, systematic-debugging for bugs, verification-before-completion before claiming anything works. Specs and plans go to `docs/specs/` and `docs/plans/`. Without superpowers, follow the same order by hand: design doc → plan → tests → implementation → verification.

## Architecture that worked

- **Split simulation from rendering.** `src/sim` or `src/engine` holds rules, physics, AI, economy: deterministic, seeded RNG, no engine/DOM imports. Enforce with lint rules (ban `Math.random`, `Date.now`, `performance.now`, renderer imports, DOM globals in those folders). Rendering reads state + events.
- **One number, one source**: balancing values live only in `src/data`. A value in two places will drift.
- Fixed-tick game loop, render interpolates.
- **Director API** for story/quests (see story.md).
- Plugin/extras folders auto-loaded via `import.meta.glob` (sort the *keys*; sorting module entries throws).
- **Placeholders for everything**: a missing texture becomes a magenta placeholder, a missing GLB becomes a box, a missing portrait a procedural bust. The game never crashes on a missing asset.
- Audio: procedural WebAudio baseline (master → compressor → sfx/music buses; oscillators + noise for SFX; drones for music), replaced by files as they arrive. Nothing plays before a user gesture; audio calls never throw.

## Debug and test hooks (needed by the quality loop)

- `window.__game` (name it per project): `ready`, `state()`, `stats` (fps, draw calls, triangles, loaded asset list: an empty list is a wiring bug), cheats (`tp`, `god`, `killAll`), `view(x,z,dist,pitch,yaw)`.
- URL params: `?seed= &autopilot=1 &skip=<scene> &players= &debug=1 &hud=0 &quality=`.
- Single-asset viewer pages (e.g. `tools-pages/modelview.html?az=&el=&dist=`) for checking one model or sprite in isolation.
- Dev server: fixed `PORT` env with `strictPort`, so parallel worktrees/agents each get their own port. Use `127.0.0.1`, not `localhost` (another project answered on `::1`).

## Testing

| Layer | Tool | What |
|---|---|---|
| Rules/sim | Vitest (node env) / GUT for Godot | Deterministic seeds; tests look up positions from data, not hard-coded values |
| Asset contracts | Vitest | Provenance files exist (case-sensitive), palette/contrast thresholds (e.g. Oklab distance sprite vs real floor pixels), budgets |
| Browser smoke | Playwright, **1 worker**, real GPU (`--use-angle=metal --enable-gpu --ignore-gpu-blocklist`; SwiftShader ran at ~1 fps) | Boots, no console errors, no black frame (centre luma), draw-call budget |
| **Built game** | `vite build` + `vite preview` smoke | The dev server passed while the shipped build deadlocked (top-level await + chunk cycle) |
| Balance | Headless bot playtests | Bots with perfect micro beat humans: final tuning needs human playtests |
| Wiring | knip + tests | Rules that are built and tested but never called |

Tool scripts (Python/Blender) get `--self-test` and run inside the test suite. A guard that can't go red is not a guard (e.g. measuring a value capped at 100%).

## Performance (web)

- Budget per view: fps ≥ 60 on the target machine, draw calls (e.g. ~60 in single view, <200 in splitscreen), triangles; check `renderer.info`.
- Measure fps by counting rAF frames over 1.5–2 s; GPU time by forcing a sync (`gl.readPixels`) after N renders; isolate cost by toggling groups, shadows, post.
- Adaptive quality ladder: step down if the average stays below the target for ~0.75–4 s, with hysteresis.
- Post-processing: one hand-written pipeline beats stacked passes (each fullscreen pass ~0.4 ms on Apple GPUs); 3-level dual-Kawase bloom; merge DoF/AO/grade/vignette into one pass.
- Instancing with chunked LODs for vegetation (tested with ~53k trees + ~246k ferns).
- **Hordes / many units** (RTS, tower defense, survivors): one `InstancedMesh` per unit type; animate via vertex animation textures or baked per-frame poses instead of per-unit skinned meshes; flow-field pathing (one field per target, not A* per unit); simulation in typed arrays; LOD to billboards far away.
- Prewarm shaders/effects once at load (hidden FX cost 100–200 ms on first use).
- Global fog/weather via overridden `ShaderChunk`s + shared uniform arrays, so one update reaches every material.
- Black frame after resize/quality change = incomplete framebuffer: recreate render targets.
- Headless Chrome can't prove 60 fps: measure in a real browser.

## Multi-agent working rules

- File ownership table per round; every change compiles on its own.
- Each agent: own named browser session, closed afterwards; a QA agent plays a snapshot build on its own port (the dev server keeps hot-reloading).
- Agents interrupted by limits leave a WIP commit; `docs/HANDOFF.md` is updated after each batch (state, credits left, next steps).
- Use exact agent names in messages (respawned agents get suffixes); broadcast "stop editing, close browsers" before the lead commits.
- Security-review each commit that touches network/key handling.

## Engine gotchas collected

- **Phaser**: tween eases accept `'Sine.InOut'`, camera `pan`/`zoomTo` only `'Sine.easeInOut'` (else freeze); `textures.remove(key)` before recreating canvas textures on scene restart; light buffers need a real additive blend.
- **PixiJS**: under Node tests stub `DOMAdapter`; set `scaleMode:'nearest'` only on pixel-art sources (enforce with a test).
- **three.js**: `onBeforeCompile` patches for weathering/wetness; convert GLTF materials to the game's material system; Draco decoder must be copied to `public/`; splitscreen: keep horizontal FOV constant.
- **macOS**: `existsSync` is case-insensitive, Linux CI isn't.
