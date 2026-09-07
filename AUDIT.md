# RESET Phase-1 Audit

## Executive summary

The uploaded build was not a functioning implementation of its own plan. The largest visible problem was a CSS/state mismatch that kept generated scene text transparent. Several architectural claims in the README were also not backed by files in the repository, and the temporary speech mapping incorrectly interpreted Kokoro voice IDs as browser language codes.

This revision fixes the broken vertical slice and adds clean seams for a small local scene model (Gemma 3 4B by default) and Kokoro without downloading either model.

## Findings and fixes

### Critical

1. **Generated scene text never became visible.**
   - JS added `scene-visible` directly to `.scene-wrapper`.
   - CSS expected `.scene-visible .scene-wrapper`, i.e. a descendant of another element.
   - Result: opacity remained `0`.
   - **Fixed:** replaced the fragile class pairing with an explicit application state machine (`data-state="resting|loading|scene|error"`).

2. **Temporary voice mapping was wrong.**
   - `af_nicole` was mapped to voices whose language started with `af` (Afrikaans).
   - `am_michael` was mapped to voices whose language started with `am` (Amharic).
   - Those prefixes are Kokoro voice IDs, not BCP-47 language tags.
   - **Fixed:** Kokoro IDs remain domain IDs. Browser fallback chooses English / en-US voices using best-effort name heuristics only. A real Kokoro path now exists separately.

3. **The repository claimed to be a PWA but lacked the files required to be one.**
   - README listed `manifest.webmanifest`, `service-worker.js`, `speechGenerator.js`, and `cache.js`; they did not exist.
   - `index.html` linked a missing manifest.
   - README claimed offline behavior that had not been implemented.
   - **Fixed:** real manifest, service worker, install icon, and application-shell caching added. API calls remain network-only so stale scenes are never served as if newly generated.

### High

4. **Placeholder scenes violated the 40–90 word contract.**
   - Most were roughly one short sentence.
   - Server validation only checked field presence.
   - **Fixed:** all fixture scenes are 40–90 words, and server-side generation validation enforces the length contract and rejects common meta/instructional failures.

5. **No runtime boundary existed for the intended small model.**
   - Replacing the fixture with Gemma would have required restructuring the generation code.
   - **Fixed:** `SceneGenerator` + `OpenAiCompatibleSceneProvider` now support Gemma 3 4B (or another small local instruct model) through a configurable OpenAI-compatible local endpoint.

6. **No Kokoro integration seam existed.**
   - Browser speech was embedded directly in UI logic.
   - **Fixed:** the server exposes `/api/tts`; `KokoroClient` can call a local OpenAI-compatible Kokoro `/v1/audio/speech` endpoint when configured. Browser speech is now explicitly a fallback.

7. **Voice selection had no defensible architecture.**
   - Voice values were statically attached to placeholders with no future routing strategy.
   - **Fixed:** the small scene model may choose exactly `af_nicole` or `am_michael`; the server validates the choice. If missing/invalid, `voiceRouter` makes a weak cadence/texture-based choice and counterbalances recent voice usage so one voice does not accidentally dominate.

8. **Theme logic was a set of coarse presets rather than a scene-time system.**
   - Only broad labels such as `dawn` or `night` existed.
   - Each theme was basically a two-stop single-hue linear gradient with jitter.
   - **Fixed:** the API now carries exact scene time (`HH:MM` + minutes). The browser interpolates continuously through a 24-hour color curve and adds deterministic per-scene variation to gradient angle and glow position.

### Medium

9. **No world/variation boundaries existed despite the planned architecture.**
   - **Fixed:** added `WorldCapsuleStore`, a future `WorldBrowseTool` boundary, fixture WorldCapsules, creative pressures, and recent-history plumbing.

10. **No tests existed.**
    - **Fixed:** Node built-in unit/integration tests cover scene validation, model JSON parsing, voice validation/routing, scene-time normalization, `/api/reset`, and health behavior.

11. **Fetch/generation failures were invisible to the user.**
    - The original code only logged to the console and left a blank scene.
    - **Fixed:** explicit loading/error UI state, non-blocking status copy, and recovery behavior added.

12. **The visual composition was essentially a prototype control over a gradient.**
    - **Fixed:** rebuilt as an atmospheric full-screen composition with layered gradients, scene-led serif typography, subtle grain/glow, accessible RESET control, reduced-motion support, responsive sizing, and no card/chat UI.

13. **The original archive bundled `node_modules`.**
    - This is unnecessary source weight and especially undesirable on a disk-constrained machine.
    - **Fixed for delivery:** the revised ZIP excludes `node_modules`; run `npm install` locally.

## Small-model groundwork

The model is deliberately not bundled. Configure a local OpenAI-compatible model endpoint:

```bash
RESET_SCENE_PROVIDER=openai_compat
RESET_MODEL_URL=http://127.0.0.1:PORT
RESET_MODEL_NAME=gemma-3-4b-it
npm start
```

The model receives a compact scene brief rather than the whole RESET specification. It writes the prose and may choose Nicole/Michael; software owns world selection, creative pressure, scene time, validation, history, and eventual novelty logic.

## Kokoro groundwork

Kokoro is likewise not bundled. When a compatible local server is available:

```bash
RESET_TTS_PROVIDER=kokoro
RESET_KOKORO_URL=http://127.0.0.1:PORT
npm start
```

Only these domain voice IDs are accepted:

- `af_nicole`
- `am_michael`

If Kokoro is not configured, Phase 1 falls back to browser English speech synthesis.

## Verification performed

- `npm test`: 7/7 passing
- `npm run check`: passing
- live HTTP smoke test against `/api/health` and `/api/reset`: passing
- repeated 30-request fixture smoke test: 0 HTTP failures
- all fixture scenes satisfy the 40–90 word contract

## Intentionally still deferred

These are not hidden defects; they are later-phase work:

- actual browser-backed WorldBrowseTool implementation
- persistent WorldCapsule/history store
- semantic near-duplicate detection / embeddings
- 500–1000 scene variability harness
- true coarse geolocation / reverse-geocoding provider (timezone is currently used as a privacy-safe placeholder context)
- Gemma weights/runtime installation
- Kokoro weights/runtime installation
- production deployment/security hardening
