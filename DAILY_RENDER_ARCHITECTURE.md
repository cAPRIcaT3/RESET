# RESET daily render architecture — v0.6

## Invariant

**One date has exactly three canonical RESET rows.**

`data/reset_journal.parquet` is authoritative. Normal scheduled/manual runs check it before loading Gemma. If the date already has three rows, generation is skipped.

## Render path

```text
Parquet journal
   ↓ export last 60 days
novelty history
   ↓
3 distinct time envelopes + world capsules + creative pressures
   ↓
Gemma 3 4B
   ↓
{ scene, sceneTime: HH:MM, voice }
   ↓ validation / duplicate rejection
Kokoro af_nicole / am_michael
   ↓
3 audio files + manifest
   ↓
Parquet upsert for date
   ↓
JSON journal/history views
   ↓
GitHub Pages artifact
```

## Timestamp ownership

Software selects a broad time envelope to keep the daily set visually varied. Gemma chooses the exact `HH:MM` inside that envelope. The exact minute is validated and passed directly to the dock renderer.

## Journal

The Parquet journal keeps text and generation metadata forever. Historical audio is deliberately not retained in Git; only the current Pages deployment needs audio.
