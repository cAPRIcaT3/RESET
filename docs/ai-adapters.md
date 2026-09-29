# Gemma + Kokoro on GitHub Actions

Kelna's Reset uses the same static publication pattern as
[cAPRIcaT3/RESET](https://github.com/cAPRIcaT3/RESET): models run on a GitHub
Actions runner, completed text/audio is published to Pages, and the browser
loads the finished files. There is no inference server, API key, or model
runtime in the browser. The Mac's Blender job is independent.

## Workflows and first run

1. Push the prepared app changes to `cAPRIcaT3/RESET`.
2. Keep **Settings → Pages → Source: GitHub Actions**.
3. Run **Kelna model and voice smoke test** first. Its artifact contains one
   real Gemma narration and a complete Kokoro recording for listening review.
4. Run **Generate Kelna moments and deploy**. It generates compatible scene
   contexts, verifies every recording, builds the app, and deploys Pages.

The existing 03:00 Asia/Kolkata schedule is retained. A normal code deployment
restores the newest compatible prepared pack; it doesn't regenerate models.
The initial Gemma 4 download is separate from RESET's existing Gemma 3 cache.

| Repository variable | Default | Purpose |
| --- | --- | --- |
| `RESET_MODEL_NAME` | `gemma4:e2b` | Exact Ollama model. Use `gemma3:4b` to keep the existing reference model/cache. |
| `RESET_KOKORO_VOICES` | `af_nicole,am_michael` | Alternating Kokoro voices, matching the reference's Nicole/Michael choice. |

Ollama weights are cached by model name and runner OS. Kokoro q8 uses the
reference cache key `kokoro-82m-q8-Linux-v1` and explicitly stores weights at
`node_modules/.cache/onnx-community`. Changing the model never silently reuses
another model's cache. GitHub's runner and cache quotas still apply.

## Generation contract

`src/narration/prompts.ts` is the single writing contract, now v5. It retains
65–130 words, 3–6 sentences, third-person observational prose, and the room
context from the earlier task. Current scene facts override the stable setting.
Examples no longer put rain on the indoor desk or attribute page motion to sound.
The model is not asked for clock digits, a vehicle's instantaneous position,
or unsupported actions, inner thoughts, sounds, or props.

`npm run moments:render` runs on the runner with Ollama and ffmpeg installed.
`RESET_PACK_DATE` accepts a real YYYY-MM-DD; otherwise it uses today's date in
Asia/Kolkata. It enumerates the slider's supported steps for rainy/cloudy scenes,
then deduplicates equal factual contexts. Thus the pack covers light transitions
and, once scene revision 8 is published, rare dawn/sunrise colors. It does not
make a new inference call for every clock position. There is one new observation
per distinct context per day; repeated check-ins in identical conditions can
reuse that observation. This deliberately replaces the reference's three-scene
limit, which cannot cover this app's weather/time combinations.

Each model response is validated before speech synthesis. Invalid responses get
up to three bounded attempts; failure prevents publication. Kokoro renders short
phrases so its phoneme limit cannot silently truncate a whole paragraph. The
phrases are joined into one recording with short pauses and encoded as MP3.
Audio checks cover SHA-256, size, decode/probe success, and duration. A checkpoint
manifest lets repeated local generation reuse verified entries. Only a complete
pack replaces `latest.json`; an unsuccessful run never deploys partial output.

The manifest records date, exact model, prompt version, scene revision, scene
condition key, narration, voice, and audio checksum. Finished pack artifacts are
retained for 30 days. This patch preserves the original repository's journal data,
but these new scene packs do not append to its old three-scenes-per-date journal.

## App behavior

`PreparedNarrationLibrary` matches the actual room/weather/time conditions, not
just a nearby timestamp. Matching text and audio are one unit. A new scene aborts
pending requests and stops old audio; pause/resume works while a recording loads.
The 30-second clock refresh retains narration while conditions remain equivalent.

Until a compatible pack is published, the app uses its local written observation
and explicitly indicates that a recording is unavailable. Listen can use the
browser's voice for this fallback. Scene studio identifies prepared Gemma/Kokoro,
live development Gemma, or local text. An old pack is usable when its scene and
prompt versions still match; its date does not cause a hard outage. A missing,
invalid, or mismatched pack never attaches unrelated audio to new text.

The optional `VITE_GEMMA_*` and `VITE_KOKORO_*` settings are development escape
hatches, not needed for Actions + Pages. Their URLs must point to your own proxy;
credentials must stay server-side. No production endpoint or secret is required.

## Verification and local preview

```sh
npm ci
npm run test:runtime
npm run build
npm run dev
```

`npm test` additionally checks local Blender source hashes when the source files
are available in this authoring workspace. `test:runtime` retains every movie,
poster, metadata, narration, and playback check, omitting only the hash comparison
against large `.blend` source files that are not shipped to Pages.

Download the `kelna-moments-YYYY-MM-DD` workflow artifact and extract its contents
into `public/generated/` to hear the real runner-generated recordings locally.
Run `npm run moments:verify` (requires ffprobe), then refresh the app.

Sources: [RESET's workflow](https://github.com/cAPRIcaT3/RESET/blob/main/.github/workflows/daily-render.yml),
[Ollama Gemma 4](https://ollama.com/library/gemma4),
[Kokoro.js](https://github.com/hexgrad/kokoro/tree/main/kokoro.js).
