# Shipping: build, deploy, stores, disclosure

## Web builds (three.js / Phaser / Pixi + Vite)

- `vite build` with `base: './'` (relative paths work on itch.io, GitHub Pages and subfolders). Run the smoke test against `vite preview` of the **built** game, not only the dev server.
- **Vercel / Netlify / GitHub Pages**: static `dist/`; set cache headers for hashed assets.
- **itch.io**: zip `dist/` with `index.html` at the root and upload it as HTML5; or use `butler push dist user/game:html5`. Set the viewport size, enable the fullscreen button and SharedArrayBuffer only if needed.
- Check that audio unlocks on the first click/tap, that it works in mobile browsers (touch controls, orientation) and that loading stays under ~20–30 MB.

## Godot

- Install export templates, then `godot --headless --export-release "Web" build/web/index.html` (or "Windows Desktop", "macOS", "Linux").
- Web: itch.io needs the "SharedArrayBuffer support" option if threads are on; or export single-threaded.

## Steam (basics)

Steamworks account + app fee, store page (capsule images, screenshots, trailer, description), builds via SteamPipe/`steamcmd`, review before launch. Plan the store assets early: they come from the same art pipeline.

## AI-content disclosure (required on Steam since January 2026)

Steam's content survey requires disclosing AI-generated content that ships in the game or appears in marketing. AI coding assistants are exempt; live-generated content needs guardrails. Fill the answers from the **provenance records** (`assets/source/*.json`: model, prompt, date per asset). A small script lists every asset with an AI model in its provenance record. Other stores and jams have their own rules: check them before submitting.

## Release checklist

- [ ] Built game smoke-tested (not the dev server); no console errors
- [ ] Performance budget met on the target device class
- [ ] Input: keyboard, gamepad, touch as intended; rebinding if planned
- [ ] Save/load works across a version bump (versioned save format)
- [ ] Options: volume sliders (music/SFX/voice), reduced shake/flash, subtitles if voiced
- [ ] Licenses and credits screen complete (from LICENSE files + provenance)
- [ ] AI disclosure answered from provenance
- [ ] Store/jam page assets: title, capsule, 5+ screenshots, GIF/trailer
