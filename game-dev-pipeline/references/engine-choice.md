# Engine Choice

Decide this before any code, together with the user. Write the decision and why into the project's CLAUDE.md.

| Situation | Engine | Why |
|---|---|---|
| 3D in the browser, shareable via URL, jam/prototype/web deploy (Vercel) | **three.js** (+ Vite, TypeScript) | No install, instant iteration via HMR, Playwright can screenshot/measure it, full shader control |
| 2D in the browser, action/ARPG with scenes, tweens, cameras | **Phaser 4** (+ Vite, TypeScript) | Proven (on v3): `pixelArt:true`, `roundPixels`, scenes, tweens, WebGL lights. Phaser ships official agent skills in its repo (`phaserjs/phaser/skills`); check v3→v4 API differences |
| 2D in the browser, custom rendering (isometric tactics, UI-heavy) | **PixiJS v8** (+ Vite, TypeScript) | Proven: fast sprites, nearest-neighbour scaling, testable under Node with a stubbed `DOMAdapter` |
| Native desktop/mobile/console, 2D or stylized 3D, **default for non-browser** | **Godot 4** | Open source (MIT), no royalties, lightweight, GDScript is easy for Claude to write, scenes are text (`.tscn`) so Claude can edit them, headless CLI for tests/exports |
| Photoreal/AAA-looking 3D, large open worlds, high-end console targets | **Unreal Engine 5** | Nanite/Lumen give the highest visual ceiling, but binary assets (`.uasset`) and Blueprints are hard for Claude to edit, so plan for C++ and scripted pipelines |
| Mobile-first commercial, big asset store dependency, team already knows it | **Unity** | Largest ecosystem, but licensing history and binary scene files; pick only with a concrete reason |

Rules of thumb:
- **Browser + 3D → three.js. Browser + 2D → Phaser (or Pixi). Otherwise → Godot**, unless the target quality needs Unreal or the user has a Unity reason.
- Prefer engines whose scene/config files are **text**: Claude can read and diff them. That is a big productivity factor.
- Everything below (moodboard, asset pipeline, quality loop) is engine-independent. Only the capture/probe mechanics differ.

Optional official helpers (use when installed; the skill doesn't depend on them): the Unity agent plugin (Unity-Technologies) and Epic's Unreal Engine skills plugin (both in Claude's plugin marketplace), godot-mcp for Godot, and Phaser's in-repo skills.

## Engine-specific capture hooks (needed for the quality loop)

| Engine | How Claude gets screenshots + stats |
|---|---|
| three.js / Pixi | Expose `window.__game = { ready, state(), stats, view(x,z,dist,pitch,yaw) }`; drive via Playwright (`playwright-cli` or scripts); URL params `?seed= &autopilot=1 &debug=1` |
| Godot | Tests: `godot --path . --headless` (GdUnit4). Frames with no extra code: `godot --path . --windowed --resolution 1280x720 --write-movie shots/frame.png --fixed-fps 30 --quit-after 60 res://scenes/x.tscn` (writes numbered PNGs) |
| Unreal | `HighResShot` console command / Automation tests with screenshot comparison, launched via command line with `-ExecCmds` |
| Unity | `ScreenCapture.CaptureScreenshot` in a PlayMode test or `-executeMethod` batch mode |
