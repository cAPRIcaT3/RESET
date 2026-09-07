# RESET v0.5 — Daily Render Architecture

**RESET = Rendered Elsewhere, Spoken Each Time.**

This version keeps the animated dock UI from v0.4, but changes the expensive AI path from *live inference* to a **daily pre-render compiler**.

At ~02:37 Asia/Kolkata each day, GitHub Actions can:

1. restore/pull **Gemma 3 4B** through Ollama;
2. generate a diversified deck of RESET scenes;
3. use the existing fixture scenes as rotating few-shot examples;
4. have Gemma return an exact `sceneTime` (`HH:MM`) and one of the two Kokoro voice IDs;
5. validate timestamps, prose length, and novelty;
6. synthesize every accepted scene with **Kokoro-82M** (`af_nicole` / `am_michael`);
7. compress audio to 64 kbps MP3 when ffmpeg is available;
8. build `public/generated/latest.json` plus the finished audio deck;
9. deploy the static site to GitHub Pages;
10. commit only the compact 30-day novelty history — **not model weights and not daily audio**.

The result is that the browser wakes up to finished scenes and finished audio. Gemma and Kokoro do not need to run on the user's machine during normal use.

## Runtime architecture

```text
02:37 daily GitHub Action
        |
        +--> world capsule + creative pressure + time envelope
        |
        +--> rotating few-shot fixture examples
        |
        v
    Gemma 3 4B
        |
        +--> scene (40-90 words)
        +--> exact sceneTime HH:MM
        +--> af_nicole | am_michael
        |
        v
 validation + 30-day novelty checks
        |
        v
    Kokoro-82M
        |
        v
  finished MP3/WAV
        |
        v
 public/generated/latest.json
        |
        v
    GitHub Pages

Morning / normal use:
RESET click -> today's manifest -> scene + exact dock time + pre-rendered audio
```

## Important design detail: time

The daily compiler gives Gemma a **broad time envelope** such as dawn, afternoon, dusk, or deep night. Gemma chooses the exact timestamp inside that envelope and returns it as `sceneTime` in `HH:MM` format.

This gives the model enough authorship to align prose with the visual atmosphere while software keeps the daily deck distributed across the full 24-hour visual toolkit.

The dock receives `sceneTimeMinutes` directly. The frontend never tries to infer time from prose.

## Few-shot behavior

The original fixture scenes are now the editorial examples for Gemma. Each model call gets a random subset (default: four), excluding the fixture that directly matches the current world capsule where possible.

The system prompt explicitly tells Gemma that the examples demonstrate **quality and range only** and must not be copied structurally. This matters with a 4B model: feeding all fixtures on every call would encourage a house formula.

Configure the count with:

```text
RESET_FEW_SHOT_COUNT=4
```

## Daily pack format

`public/generated/latest.json` looks conceptually like:

```json
{
  "version": 1,
  "date": "2026-09-08",
  "generatedAt": "...",
  "model": "gemma3:4b",
  "count": 24,
  "scenes": [
    {
      "id": "2026-09-08-001",
      "scene": "...",
      "sceneTime": "05:18",
      "sceneTimeMinutes": 318,
      "sceneTimeBand": "dawn",
      "voice": "af_nicole",
      "audioUrl": "generated/2026-09-08/audio/2026-09-08-001.mp3",
      "worldCapsuleId": "...",
      "creativePressure": ["..."],
      "timeEnvelope": "dawn"
    }
  ]
}
```

The browser tracks which scene IDs it has already used for that day's pack and avoids repeats until the deck is exhausted.

## GitHub setup

### 1. Create/push the repository

Put this source tree on the repository's default branch (normally `main`).

### 2. Enable GitHub Pages via Actions

In the repository settings, configure **Pages** to deploy from GitHub Actions.

The included workflow is:

```text
.github/workflows/daily-render.yml
```

It has both `schedule` and `workflow_dispatch`, so run it manually once before waiting for the scheduled job.

### 3. Optional repository variable

Create this Actions **Repository variable** if you want the user's coarse location to weakly influence the creative brief:

```text
RESET_USER_PLACE=Bengaluru, India
```

Do not put a precise address here. Leaving it unset is valid.

### 4. No Gemma or Kokoro secrets are required by default

The workflow uses:

- Ollama + `gemma3:4b`
- local `kokoro-js`
- GitHub Actions caches for model payloads

No model weights are committed to Git.

If the runner model setup is changed later, use the existing provider boundaries rather than changing the app.

## Workflows

### `daily-render.yml`

Scheduled daily render + GitHub Pages deployment. Default target is 24 finished scenes.

Manual inputs let you override:

- scene count
- pack date

### `render-smoke.yml`

Manual one-scene model/audio smoke test. It uploads the generated pack as a short-lived Actions artifact instead of deploying it.

Use this first to prove the runner can load Gemma and Kokoro.

### `ci.yml`

Runs syntax checks and tests on pushes and pull requests.

## Commands

### Development app with fixtures

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

If `public/generated/latest.json` does not exist, RESET falls back to the live `/api/reset` fixture/model route.

### Run tests

```bash
npm run check
npm test
```

### Compile a daily pack locally

First expose Gemma through an OpenAI-compatible endpoint. The included Actions workflow uses Ollama:

```bash
ollama serve
ollama pull gemma3:4b
```

Then in another terminal:

```bash
RESET_MODEL_URL=http://127.0.0.1:11434 \
RESET_MODEL_NAME=gemma3:4b \
RESET_DAILY_COUNT=4 \
npm run daily:render
```

On Windows CMD, set environment variables separately before running the command.

## Novelty

`data/history.json` retains compact metadata for the most recent 30 days by default.

The compiler rejects:

- exact duplicate prose;
- repeated seven-word openings;
- high trigram-overlap near duplicates;
- malformed timestamps;
- timestamps outside the requested visual time envelope;
- invalid voice IDs;
- scenes outside 40-90 words;
- obvious RESET/meta/self-help output.

The same day's accepted scenes are compared against each other as well as recent history.

This is intentionally only a first novelty layer. Future evaluation should add structural fingerprints and the planned 500/1000-scene variability audit.

## Audio

The compiler synthesizes with Kokoro locally. It asks for only:

```text
af_nicole
am_michael
```

When `RESET_AUDIO_FORMAT=mp3`, the compiler uses ffmpeg to convert generated WAV to 64 kbps MP3. If ffmpeg is unavailable it keeps the WAV instead.

The daily GitHub workflow installs ffmpeg.

The browser receives an `audioUrl` and plays that finished file through the already-hardened Web Audio path. If the daily pack is absent during local development, the previous live Kokoro/browser fallback still exists.

## Model and cache boundaries

Model weights do **not** belong in the repository.

The GitHub workflow caches:

```text
~/.ollama/models
node_modules/.cache/onnx-community
```

The repo contains only code, prompt logic, fixture examples, and compact novelty history.

## World browsing status

The daily compiler currently uses the existing `WorldCapsule` pool. The single `WorldBrowseTool` abstraction remains in the repository, but automatic public-web replenishment is deliberately not coupled to the GitHub workflow yet because no search provider/API was chosen.

That is the next clean extension: generate/replenish WorldCapsules separately, then let the daily compiler consume the cache. It should not be mixed into the time-critical morning render path.

## GitHub Pages / PWA compatibility

v0.5 changes static asset and service-worker paths to be **scope-relative**, so the app can work under a GitHub Pages project path such as:

```text
https://USER.github.io/REPOSITORY/
```

The service worker uses:

- network-first behavior for `generated/latest.json` so a new day's deck replaces yesterday's;
- cache-first behavior for generated audio after first playback;
- network-first shell assets with offline fallback.

## Current limitations

- The scheduled render is only as reliable as GitHub Actions queueing. The workflow is intentionally scheduled at `02:37`, away from the top of the hour.
- The first runner execution must download/cache Gemma and Kokoro, so it is much slower than later runs.
- Automatic browsing-driven WorldCapsule replenishment is not yet enabled.
- Gemma is still a small model. The compiler compensates using time envelopes, few-shot rotation, retries, validation, and novelty rejection rather than assuming every generation is good.

## Recommended first Actions sequence

1. Push this repo.
2. Enable Pages -> GitHub Actions.
3. Run **RESET CI**.
4. Run **Model render smoke test** and inspect the one generated audio file.
5. Run **Render daily RESET deck** manually with `count=4`.
6. Open the deployed Pages URL and test all four scenes.
7. Increase the default back to 24 after the end-to-end path is proven.
