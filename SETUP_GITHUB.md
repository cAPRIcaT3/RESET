# GitHub setup

Repository: `cAPRIcaT3/RESET`

## 1. Pages

GitHub → **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The production workflow itself uploads and deploys the `public/` directory.

## 2. Optional place context

GitHub → **Settings → Secrets and variables → Actions → Variables**.

Add, if desired:

```text
RESET_USER_PLACE=Bengaluru, India
```

No secret is required for Ollama/Gemma because the runner hosts the model locally.

## 3. First run

Open:

`Actions → Render three daily RESETs → Run workflow`

Leave `pack_date` empty.

The first run will download/cache Gemma 3 4B and Kokoro, generate exactly three scenes, synthesize audio, create `data/reset_journal.parquet`, commit the journal, and deploy Pages.

## 4. Daily schedule

The workflow runs at **03:00 Asia/Kolkata** each day.

## 5. Hail a RESET

The live site links to the manual workflow page. A static Pages site cannot safely call the Actions write API directly without exposing credentials, so the final confirmation remains GitHub's authenticated **Run workflow** control.

If today's three already exist, a normal manual run exits without generating more.
