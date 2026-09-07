import test from 'node:test';
import assert from 'node:assert/strict';
import { isNearDuplicate } from '../src/daily/novelty.js';
import { timeWithinEnvelope, SCENE_TIME_ENVELOPES } from '../src/variation/timeEnvelope.js';
import { selectFewShotMessages } from '../src/generation/fewShotExamples.js';

test('time envelope validates Gemma timestamp boundaries', () => {
  const dawn = SCENE_TIME_ENVELOPES.find(x => x.id === 'dawn');
  assert.equal(timeWithinEnvelope('04:30', dawn), true);
  assert.equal(timeWithinEnvelope('06:29', dawn), true);
  assert.equal(timeWithinEnvelope('06:30', dawn), false);
});

test('near-duplicate filter rejects paraphrase-shaped overlap but allows distinct scenes', () => {
  const prior = 'The warehouse door sticks halfway down while three workers compare mislabeled cartons against a phone photograph and rewrite every box with a marker before lunch.';
  const similar = 'The warehouse door sticks halfway down while three workers compare mislabeled cartons against a phone photograph and rewrite every box with a marker before dinner.';
  const distinct = 'At the lake pier, a mechanic ties a magnet to blue cord after three screws bounce from a crate into clear water. Two passengers hold the boat steady.';
  assert.equal(isNearDuplicate(similar, [prior]).duplicate, true);
  assert.equal(isNearDuplicate(distinct, [prior]).duplicate, false);
});

test('few-shot selector emits paired user/assistant examples without current capsule', () => {
  const messages = selectFewShotMessages({ random: () => 0.3, count: 3, excludeCapsuleId: 'bengaluru-pharmacy' });
  assert.equal(messages.length, 6);
  assert.equal(messages.filter(m => m.role === 'assistant').length, 3);
  for (const message of messages.filter(m => m.role === 'assistant')) {
    const parsed = JSON.parse(message.content);
    assert.match(parsed.sceneTime, /^\d{2}:\d{2}$/);
    assert.ok(['af_nicole', 'am_michael'].includes(parsed.voice));
  }
});
