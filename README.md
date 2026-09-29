# Kelna’s Reset

A quiet room overlooking a waterfront city, rendered in Blender, with
scene-matched Gemma narration and Kokoro recordings generated on GitHub Actions.

## Run locally

Node.js 24+ is required.

```sh
npm ci
npm run dev
npm run test:runtime
npm run build
```

The app runs at `http://127.0.0.1:5173`. `dist/` is the Pages site. Models run only
in the generation workflow, and the app consumes the finished text/audio pack.
Until the first pack is published it uses a local written observation and browser
speech, with the source identified in Scene studio.

## Publish narration and voice

See [the runner configuration and first-run instructions](docs/ai-adapters.md).
Run the **Kelna model and voice smoke test**, listen to its artifact, then run
**Generate Kelna moments and deploy**. The existing daily 03:00 India schedule is
retained. No API keys or live inference endpoints are required by the site.

## Scene status

The current published Blender family is selected in
`src/scene/weather-preview.ts`. The native cloud/water revision is being exported
separately; publication requires a complete verified set of twelve animations.
The slider crossfades synchronized Blender lighting clips. It does not run a
real-time 3D renderer. The current rendered props use AC on and an open book.

The editable Blender scene and export scripts stay in the authoring workspace;
Pages ships only runtime movies, posters, and validation metadata. Full source
hash checks run with `npm test` there. `npm run test:runtime` verifies deployed
media plus the app, narration, and playback contracts without the `.blend` files.

## Structure

- `src/scene/`: deterministic state, native animation selection, time/weather.
- `src/narration/`: shared prompts, validation, prepared-pack matching, fallback.
- `src/voice/`: recorded audio and optional live/browser providers.
- `scripts/generate-moments.ts`: runner generation with cached models.
- `.github/workflows/`: smoke, daily generation, and static deployment.

The original RESET journal data is retained in the target repository. New Kelna
packs use a different scene-based manifest and do not rewrite that journal.
