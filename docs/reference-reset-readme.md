# RESET

**Rendered Elsewhere, Spoken Each Time.**

RESET is a tiny pattern-break: one short scene, a living dock backdrop driven by the scene's exact time, and a pre-rendered Kokoro voice.

This repository is designed for **GitHub Pages + GitHub Actions**. The live page is static. Gemma and Kokoro work at 03:00 Asia/Kolkata, not when the user presses RESET.

## Production architecture

```text
03:00 Asia/Kolkata
        ↓
GitHub Actions runner
        ↓
Gemma 3 4B (Ollama)
        ↓
exactly 3 scenes
  scene + HH:MM + Nicole/Michael
        ↓
Kokoro-82M
        ↓
3 finished audio files + latest.json
        ↓
append canonical rows to data/reset_journal.parquet
        ↓
export a small JSON journal view
        ↓
GitHub Pages deployment

Browser
  ↓
static HTML/CSS/Canvas + today's 3 scenes/audio
```

The browser never runs Gemma or Kokoro in production.

## Three RESETs per day

The production workflow is hard-limited to **three generated scenes per date**. A normal manual rerun is a no-op if the Parquet journal already contains three scenes for that date.

The three scenes carry exact `sceneTime` values chosen by Gemma inside software-selected time envelopes. Those timestamps drive the dock lighting, fish visibility, water reflections, stars, sun/moon position, and the rest of the visual atmosphere.

## RESET journal

`data/reset_journal.parquet` is the durable journal and source of truth. Each row records:

- date and slot
- generated scene
- exact scene time / minute-of-day / semantic band
- Kokoro voice
- Gemma model name
- world-capsule id
- creative-pressure metadata
- generation trigger and GitHub run id

The workflow commits the Parquet file after each successful daily render.

Two JSON files are derived from it:

- `data/history.json` — compact recent history used for novelty pressure in future Gemma runs
- `public/generated/journal.json` — static browser view consumed by `journal.html`

The Journal link in the UI shows the complete committed scene record without requiring a server.

## Hail a RESET

The static site includes a **Hail a RESET** button. It opens the repository's `Render three daily RESETs` workflow, where the owner can press **Run workflow**.

A GitHub Pages site cannot securely invoke a write-capable Actions API by itself without exposing a credential or adding a backend. Linking to GitHub's authenticated workflow-dispatch UI preserves the static/security model.

## Fixtures as few-shot examples

The existing hand-written scenes remain in `src/generation/fixtureSceneProvider.js`. In Gemma mode, a rotating subset is used as few-shot examples of editorial range. The prompt explicitly tells Gemma not to copy their syntax, structure, subjects, endings, or imagery.

## Local development

```bash
npm install
npm start
```

Open `http://localhost:3000`.

Localhost retains the development API fallback. GitHub Pages does not.

Tests:

```bash
npm run check
npm test
```

## Workflows

- `.github/workflows/daily-render.yml` — scheduled and manual production render; fixed at 3 scenes
- `.github/workflows/render-smoke.yml` — one-scene model/TTS smoke test
- `.github/workflows/ci.yml` — syntax/tests

The production schedule is `03:00` with `timezone: Asia/Kolkata`.

## First deployment

1. In **Settings → Pages**, select **GitHub Actions** as the source.
2. Push this repository.
3. Open **Actions → Render three daily RESETs → Run workflow** once.
4. The workflow will render three scenes, journal them, and deploy the static site.
5. Future daily runs occur automatically at 03:00 Asia/Kolkata.

Optional repository variable:

```text
RESET_USER_PLACE=Bengaluru, India
```

This is weak creative context only; it does not determine the generated location.

## Runtime output

The Pages artifact contains only static files and the current day's audio pack:

```text
public/generated/latest.json
public/generated/YYYY-MM-DD/manifest.json
public/generated/YYYY-MM-DD/audio/*.mp3
public/generated/journal.json
```

Historical audio is not committed. Historical scenes and metadata live in Parquet.
