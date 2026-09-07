# RESET v0.3 — Audio audit and fix

## What was actually wrong

The uploaded build had multiple independent ways to produce a silent scene.

1. **A stale server was very likely still serving the old build.** The earlier terminal output said `TTS provider: browser fallback`, while the uploaded `KokoroClient` now defaults to local Kokoro when no override is set. The later `EADDRINUSE` confirms that another process was already bound to port 3000. This means a newer `npm start` could fail while Chrome continued talking to the older process.

2. **The service worker was cache-first with a fixed `reset-shell-v2` cache.** That can pin an older `app.js` during development even after source files are changed.

3. **Kokoro playback used `new Audio(...).play()` only after asynchronous scene + TTS requests.** Chrome's transient user-activation permission can expire by then, making playback vulnerable to autoplay blocking.

4. **Browser SpeechSynthesis failed silently.** There were no `onstart`/`onerror` diagnostics, and the utterance object was not kept as application state.

5. **Local Kokoro had no startup warmup or readiness signal.** The first press could therefore look dead while the ONNX model was still loading.

6. **The server tests exercised the real local TTS model.** That makes ordinary tests depend on model files and native ONNX runtime rather than testing the API contract deterministically.

## Changes in v0.3

- Added `public/audioEngine.js`.
- Web Audio is primed on `pointerdown` while Chrome still has a user gesture.
- Kokoro WAV/MP3 is decoded and played through the unlocked Web Audio context.
- Browser speech remains a fallback, but now keeps a strong utterance reference, handles start/end/error, and resumes if Chrome pauses it.
- UI shows `Finding its voice…` while TTS is being prepared rather than silently waiting.
- Service worker cache bumped to `reset-shell-v3-audio` and changed to network-first for app assets.
- Service-worker registration uses `updateViaCache: 'none'`.
- Local Kokoro warms in the background on server startup.
- `/api/health` reports Kokoro mode and state.
- `/api/tts` returns a debug `x-reset-tts` response header and remains `no-store`.
- `server.js` prints its PID and gives a useful Windows message for `EADDRINUSE`.
- Added `npm run tts:smoke`, which directly creates `tmp/nicole.wav` and `tmp/michael.wav` without involving Chrome.
- Server tests now use an injected fake Kokoro client instead of loading the real ONNX model.

## First run after applying this revision

In Windows CMD, make sure the old server is not still using port 3000:

```bat
netstat -ano | findstr :3000
```

If a stale RESET Node process is listening there:

```bat
taskkill /PID <PID> /F
```

Then:

```bat
npm install
npm run tts:smoke
npm start
```

A healthy startup should eventually show:

```text
TTS provider: kokoro (local) [US-Nicole, US-Michael]
Kokoro: warming local model in the background…
Kokoro: ready.
```

Open `http://localhost:3000/api/health` and confirm the TTS state becomes `ready`.

Because the prior build installed a service worker, do one **Ctrl+Shift+R** after starting v0.3 so the current page definitely picks up the new application shell.

If `npm run tts:smoke` creates audible WAV files but the browser remains silent, the model/runtime is proven healthy and the remaining fault is browser playback. v0.3's unlocked Web Audio path is specifically intended to eliminate that class of failure.
