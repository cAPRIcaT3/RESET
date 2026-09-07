import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/appFactory.js';

const browserTts = {
  isEnabled: () => false,
  mode: 'disabled',
  status: () => ({ mode: 'disabled', state: 'disabled', error: null })
};

const fakeKokoro = {
  isEnabled: () => true,
  mode: 'local',
  status: () => ({ mode: 'local', state: 'ready', error: null }),
  async synthesize({ text, voice }) {
    assert.ok(text);
    assert.ok(['af_nicole', 'am_michael'].includes(voice));
    return { buffer: Buffer.alloc(12000, 1), mimeType: 'audio/wav' };
  }
};

test('GET /api/reset returns a valid RESET payload', async t => {
  const app = createApp({
    random: createCyclingRandom(),
    now: () => new Date('2026-09-07T12:30:00Z'),
    coarsePlace: 'test',
    kokoroClient: browserTts
  });
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();

  const response = await fetch(`http://127.0.0.1:${port}/api/reset`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const payload = await response.json();

  assert.equal(typeof payload.scene, 'string');
  const words = payload.scene.trim().split(/\s+/).length;
  assert.ok(words >= 40 && words <= 90, `word count was ${words}`);
  assert.ok(['af_nicole', 'am_michael'].includes(payload.voice));
  assert.match(payload.sceneTime, /^\d{2}:\d{2}$/);
  assert.equal(typeof payload.sceneTimeMinutes, 'number');
  assert.equal(typeof payload.sceneTimeBand, 'string');
});

test('GET /api/health reports TTS state', async t => {
  const app = createApp({ kokoroClient: fakeKokoro });
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.sceneProvider, process.env.RESET_SCENE_PROVIDER || 'fixture');
  assert.equal(payload.ttsProvider, 'kokoro');
  assert.equal(payload.ttsMode, 'local');
  assert.equal(payload.ttsStatus.state, 'ready');
});

test('POST /api/tts returns 204 when browser fallback is configured', async t => {
  const app = createApp({ kokoroClient: browserTts });
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();

  const response = await fetch(`http://127.0.0.1:${port}/api/tts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'Hello', voice: 'af_nicole' })
  });
  assert.equal(response.status, 204);
});

test('POST /api/tts validates input with Kokoro enabled', async t => {
  const app = createApp({ kokoroClient: fakeKokoro });
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();

  const res1 = await fetch(`http://127.0.0.1:${port}/api/tts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: '', voice: 'US-Nicole' })
  });
  assert.equal(res1.status, 400);

  const res2 = await fetch(`http://127.0.0.1:${port}/api/tts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'Hello', voice: 'unsupported_voice' })
  });
  assert.equal(res2.status, 400);
});

test('POST /api/tts accepts Nicole and Michael aliases and returns audio', async t => {
  const app = createApp({ kokoroClient: fakeKokoro });
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();

  for (const voice of ['US-Nicole', 'US-Michael']) {
    const response = await fetch(`http://127.0.0.1:${port}/api/tts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'A short voice integration check.', voice })
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /audio\/wav/);
    assert.match(response.headers.get('x-reset-tts'), /^local:(?:af_nicole|am_michael)$/);
    const audio = await response.arrayBuffer();
    assert.equal(audio.byteLength, 12000);
  }
});

function createCyclingRandom() {
  let n = 0;
  const values = [0.02, 0.17, 0.33, 0.49, 0.65, 0.81, 0.93];
  return () => values[(n++) % values.length];
}
