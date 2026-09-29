import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ARCHITECTURE_PREVIEW_ANIMATED, ARCHITECTURE_PREVIEW_DIRECTORY } from '../src/scene/architecture-preview.ts';

test('animated architecture preview contains two complete, verified native movies', context => {
  if (!ARCHITECTURE_PREVIEW_ANIMATED) return context.skip('Native animation export is not active yet');
  const validation = JSON.parse(readFileSync('blender/validation-v3.json', 'utf8'));
  for (const look of ['day', 'night']) {
    const stem = `public/${ARCHITECTURE_PREVIEW_DIRECTORY}/${look}`;
    const metadata = JSON.parse(readFileSync(`${stem}.complete.json`, 'utf8'));
    assert.equal(metadata.sourceSha256, validation.sourceSha256);
    assert.equal(metadata.frames, 384);
    assert.equal(metadata.fps, 12);
    assert.equal(metadata.durationSeconds, 32);
    assert.equal(metadata.airConditioner, true);
    assert.equal(metadata.book, 'open');
    assert.equal(metadata.rain, 0);
    assert.equal(metadata.bytes, statSync(`${stem}.mp4`).size);
    assert.equal(createHash('sha256').update(readFileSync(`${stem}.mp4`)).digest('hex'), metadata.sha256);
    assert.equal(createHash('sha256').update(readFileSync(`${stem}.webp`)).digest('hex'), metadata.posterSha256);
    assert.equal(Object.keys(metadata.frameHashes).length, 384);
    assert.ok(new Set(Object.values(metadata.frameHashes)).size > 350);
  }
});
