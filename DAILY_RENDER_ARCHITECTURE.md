# Daily render architecture notes

The runtime goal is zero model latency for the user.

The GitHub runner is a compiler, not a server. Gemma and Kokoro exist only during the scheduled build. The deployed PWA consumes immutable finished scene/audio entries from a daily manifest.

## Why the model returns exact timestamps

The dock is continuous rather than preset-based, so every accepted scene needs exact visual time metadata. A broad software-selected envelope prevents Gemma from collapsing toward dusk/night while still letting Gemma choose the precise minute that matches its prose.

## Why audio is pre-rendered

Kokoro synthesis no longer sits on the click path. The user's first gesture only needs to unlock Web Audio; the actual audio bytes are already static assets and can be cached by the service worker.

## Why daily audio is deployed, not committed

Audio is large and changes daily. Committing it would permanently inflate Git history. GitHub Pages deployment artifacts can carry today's media without turning the source repository into an audio archive. Only `data/history.json` is committed each day.

## Why fixture scenes remain

They now serve three roles:

1. development fallback;
2. editorial few-shot examples for Gemma;
3. regression references for style/quality.

They should not grow into a template library.
