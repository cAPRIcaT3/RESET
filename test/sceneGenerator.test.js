import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSceneText } from '../src/generation/sceneGenerator.js';
import { parseModelJson } from '../src/generation/openAiCompatibleSceneProvider.js';
import { resolveVoice, KOKORO_VOICES, canonicalVoiceId } from '../src/voice/voiceRouter.js';
import { normalizeSceneTime, parseClockTime } from '../src/variation/sceneTime.js';

test('scene validation accepts 40-90 word prose', () => {
  const scene = Array.from({ length: 45 }, (_, i) => `word${i}`).join(' ');
  assert.equal(validateSceneText(scene), scene);
});

test('scene validation rejects short prose', () => {
  assert.throws(() => validateSceneText('Too short to be a RESET scene.'), /40-90/);
});

test('model JSON parser accepts fenced JSON', () => {
  const parsed = parseModelJson('```json\n{"scene":"hello","sceneTime":"05:47","voice":"af_nicole"}\n```');
  assert.deepEqual(parsed, { scene: 'hello', requestedVoice: 'af_nicole', sceneTime: '05:47' });
});

test('voice router resolves US-Nicole and US-Michael aliases', () => {
  assert.equal(canonicalVoiceId('US-Nicole'), 'af_nicole');
  assert.equal(canonicalVoiceId('us-nicole'), 'af_nicole');
  assert.equal(canonicalVoiceId('af_nicole'), 'af_nicole');
  assert.equal(canonicalVoiceId('US-Michael'), 'am_michael');
  assert.equal(canonicalVoiceId('us-michael'), 'am_michael');
  assert.equal(canonicalVoiceId('am_michael'), 'am_michael');

  assert.equal(resolveVoice({ requestedVoice: 'US-Nicole', scene: 'test' }), 'af_nicole');
  assert.equal(resolveVoice({ requestedVoice: 'US-Michael', scene: 'test' }), 'am_michael');
});

test('voice router always resolves to a supported Kokoro voice', () => {
  for (const requestedVoice of [undefined, null, 'bad-voice', 'af_nicole', 'am_michael', 'US-Nicole', 'US-Michael']) {
    const voice = resolveVoice({ requestedVoice, scene: 'A machine shop closes for the evening.', random: () => 0.25 });
    assert.ok(KOKORO_VOICES.includes(voice));
  }
});

test('scene time uses exact clock minutes and semantic band', () => {
  assert.equal(parseClockTime('05:47'), 347);
  assert.deepEqual(normalizeSceneTime('05:47'), {
    sceneTime: '05:47',
    sceneTimeMinutes: 347,
    sceneTimeBand: 'dawn'
  });
});
