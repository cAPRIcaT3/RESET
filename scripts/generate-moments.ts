import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildGemmaMessages, RESET_PROMPT_VERSION } from '../src/narration/prompts.ts';
import { extractNarration, validateNarration } from '../src/narration/validation.ts';
import { narrationContextKey, validatePack } from '../src/narration/pack.ts';
import type { NarrationPack, PreparedMoment } from '../src/narration/pack.ts';
import { WEATHER_SPECTRUM_REVISION } from '../src/scene/weather-preview.ts';
import { speechChunks } from './speech-chunks.ts';
import { packContexts } from './pack-contexts.ts';
import { verifyPackFiles } from './verify-moments.ts';

const date = process.env.RESET_PACK_DATE || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const output = resolve(process.env.RESET_PACK_OUTPUT || 'public/generated');
// The reference cache uses Gemma 3; Gemma 4 needs its own initial download.
const model = process.env.RESET_MODEL_NAME || 'gemma4:e2b';
const endpoint = (process.env.RESET_MODEL_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const voices = (process.env.RESET_KOKORO_VOICES || 'af_nicole,am_michael').split(',').map(v => v.trim());
const speed = Number(process.env.RESET_KOKORO_SPEED || '.94');
if (!voices.length || voices.some(v => !/^[ab][fm]_[a-z]+$/.test(v)) || !Number.isFinite(speed) || speed < .5 || speed > 1.5) throw new Error('Invalid Kokoro voice configuration');
const smoke = process.env.RESET_DAILY_MODE === 'smoke';
const states = packContexts(date).slice(0, smoke ? 1 : undefined);
const family = `${date}-r${WEATHER_SPECTRUM_REVISION}-${RESET_PROMPT_VERSION.split('-').at(-1)}${smoke ? '-smoke' : ''}`;
const folder = join(output, family);
await mkdir(join(folder, 'audio'), { recursive: true });
const manifest = join(folder, 'manifest.json');
let previous: NarrationPack | undefined;
try { previous = validatePack(JSON.parse(await readFile(manifest, 'utf8'))); } catch { /* First run, or an incompatible previous pack. */ }
const entries: PreparedMoment[] = [];
let tts: Awaited<ReturnType<typeof import('kokoro-js')['KokoroTTS']['from_pretrained']>> | undefined;
const configId = createHash('sha256').update(JSON.stringify({ model, voices, speed, prompt: RESET_PROMPT_VERSION })).digest('hex').slice(0, 10);
for (const [index, state] of states.entries()) {
  const contextKey = narrationContextKey(state);
  const id = createHash('sha256').update(contextKey + configId + date).digest('hex').slice(0, 20);
  const saved = previous?.entries.find(entry => entry.id === id);
  if (saved) {
    try {
      await verifyPackFiles({ ...previous!, entries: [saved] }, output);
      entries.push(saved); console.log(`Reused ${index + 1}/${states.length}: ${id}`); continue;
    } catch { /* An incomplete audio file is regenerated, never published. */ }
  }
  let narration = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const messages = buildGemmaMessages(state);
    if (attempt) messages.push({ role: 'user', content: 'The last attempt did not meet the output contract. Return 65–130 words in 3–6 declarative sentences, as one JSON narration field. No questions or direct address.' });
    const response = await fetch(`${endpoint}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false, think: false, format: 'json', keep_alive: '2m',
        options: { temperature: .65, num_predict: 360, num_ctx: 4096, seed: parseInt(id.slice(0, 6), 16) + attempt } }),
      signal: AbortSignal.timeout(180000),
    });
    if (!response.ok) throw new Error(`Gemma returned HTTP ${response.status}`);
    const result = await response.json() as { message?: { content?: string } };
    try { narration = extractNarration({ output_text: result.message?.content }); validateNarration(narration); break; }
    catch { narration = ''; }
  }
  if (!narration) throw new Error(`Gemma failed the writing contract for ${id}; the previous published pack is retained.`);
  if (!tts) {
    const { env } = await import('@huggingface/transformers');
    env.cacheDir = resolve('node_modules/.cache');
    const { KokoroTTS } = await import('kokoro-js');
    tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
  }
  const voice = voices[index % voices.length]!;
  if (!(voice in tts.voices)) throw new Error(`Unknown Kokoro voice: ${voice}`);
  const parts: Float32Array[] = [];
  for (const chunk of speechChunks(narration)) {
    const segment = await tts.generate(chunk, { voice: voice as keyof typeof tts.voices, speed });
    parts.push(segment.audio);
    parts.push(new Float32Array(2160)); // 90 ms between natural phrase boundaries.
  }
  const samples = new Float32Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { samples.set(part, offset); offset += part.length; }
  const { RawAudio } = await import('@huggingface/transformers');
  const audio = new RawAudio(samples, 24000);
  const wavPath = join(folder, 'audio', `${id}.wav`);
  const mp3Path = join(folder, 'audio', `${id}.mp3`);
  await writeFile(wavPath, Buffer.from(audio.toWav()));
  const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-codec:a', 'libmp3lame', '-b:a', '96k', mp3Path], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('ffmpeg could not encode Kokoro audio; install ffmpeg first.');
  await unlink(wavPath);
  const bytes = await readFile(mp3Path);
  entries.push({ id, contextKey, narration, audio: { path: `${family}/audio/${id}.mp3`, sha256: createHash('sha256').update(bytes).digest('hex'), mime: 'audio/mpeg', voice } });
  const checkpoint: NarrationPack = { version: 1, promptVersion: RESET_PROMPT_VERSION, date, model, sceneRevision: WEATHER_SPECTRUM_REVISION, entries };
  await writeFile(`${manifest}.tmp`, JSON.stringify(checkpoint, null, 2));
  await rename(`${manifest}.tmp`, manifest);
  console.log(`Generated ${index + 1}/${states.length}: ${state.weather}, ${state.timeBand}, ${voice}`);
}
const pack: NarrationPack = { version: 1, promptVersion: RESET_PROMPT_VERSION, date, model, sceneRevision: WEATHER_SPECTRUM_REVISION, entries };
await verifyPackFiles(pack, output);
if (entries.length !== states.length) throw new Error('Incomplete pack');
await writeFile(`${output}/latest.json.tmp`, JSON.stringify(pack, null, 2));
await rename(`${output}/latest.json.tmp`, `${output}/latest.json`);
console.log(`READY: ${entries.length} Gemma observations with matching Kokoro recordings (${model}).`);
