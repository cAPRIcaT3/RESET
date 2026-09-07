import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { SceneGenerator } from '../src/generation/sceneGenerator.js';
import { OpenAiCompatibleSceneProvider } from '../src/generation/openAiCompatibleSceneProvider.js';
import { RecentHistory } from '../src/variation/recentHistory.js';
import { createCreativePressure } from '../src/variation/creativePressure.js';
import { fixtureWorldCapsules } from '../src/world/worldCapsules.js';
import { shuffledTimeEnvelopes, timeWithinEnvelope } from '../src/variation/timeEnvelope.js';
import { KokoroClient } from '../src/voice/kokoroClient.js';
import { loadDailyHistory, historySceneTexts } from '../src/daily/historyStore.js';
import { isNearDuplicate } from '../src/daily/novelty.js';

const targetCount = process.env.RESET_DAILY_MODE === 'smoke' ? 1 : 3;
const maxAttempts = Number(process.env.RESET_DAILY_MAX_ATTEMPTS || 36);
const date = process.env.RESET_PACK_DATE || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const outputRoot = path.resolve('public', 'generated');
const packDir = path.join(outputRoot, date);
const audioDir = path.join(packDir, 'audio');
const historyPath = path.resolve('data', 'history.json');

const random = Math.random;
const historyFile = await loadDailyHistory(historyPath);
const priorTexts = historySceneTexts(historyFile);
const liveHistory = new RecentHistory(80);
for (const day of historyFile.days.slice(-7)) {
  for (const item of day.scenes || []) liveHistory.add(item);
}

const provider = new OpenAiCompatibleSceneProvider({ random });
if (!provider.isConfigured()) {
  throw new Error('RESET_MODEL_URL is required. For GitHub Actions use http://127.0.0.1:11434 with Ollama.');
}
const generator = new SceneGenerator({ provider, history: liveHistory, random });
const kokoro = new KokoroClient({ provider: 'local' });

await fs.rm(packDir, { recursive: true, force: true });
await fs.mkdir(audioDir, { recursive: true });
console.log(`RESET daily compiler: ${date}`);
console.log(`Target scenes: ${targetCount}; max attempts: ${maxAttempts}`);
console.log(`Model: ${process.env.RESET_MODEL_NAME || 'gemma3:4b'}`);
console.log('Warming Kokoro…');
await kokoro.warmup();
console.log('Kokoro ready.');

let envelopeDeck = shuffledTimeEnvelopes(random);
let envelopeIndex = 0;
const accepted = [];
const todayTexts = [];
const worldUsage = new Map();
const voiceUsage = new Map();

for (let attempt = 1; attempt <= maxAttempts && accepted.length < targetCount; attempt += 1) {
  if (envelopeIndex >= envelopeDeck.length) {
    envelopeDeck = shuffledTimeEnvelopes(random);
    envelopeIndex = 0;
  }
  const envelope = envelopeDeck[envelopeIndex++];
  const worldCapsule = chooseLeastUsedWorld(worldUsage, random);
  const creativePressure = createCreativePressure(random);
  const recentAvoidances = liveHistory.antiRepetitionSummary();

  try {
    const result = await generator.generate({
      worldCapsule,
      creativePressure,
      sceneTimeEnvelope: envelope,
      userContext: {
        localTime: process.env.RESET_USER_LOCAL_TIME || '03:00',
        coarsePlace: process.env.RESET_USER_PLACE || 'unknown'
      },
      recentAvoidances,
      voiceBalanceHint: `So far today: af_nicole ${voiceUsage.get('af_nicole') || 0}, am_michael ${voiceUsage.get('am_michael') || 0}. If both voices fit equally well, prefer the less-used voice. Do not force a poor fit.`
    });

    if (!timeWithinEnvelope(result.sceneTime, envelope)) {
      throw new Error(`sceneTime ${result.sceneTime} fell outside ${envelope.start}-${envelope.end}`);
    }

    const duplicate = isNearDuplicate(result.scene, [...priorTexts.slice(-600), ...todayTexts]);
    if (duplicate.duplicate) throw new Error(`novelty rejected (${duplicate.reason})`);

    const id = `${date}-${String(accepted.length + 1).padStart(3, '0')}`;
    const audio = await kokoro.synthesize({ text: result.scene, voice: result.voice });
    const wavPath = path.join(audioDir, `${id}.wav`);
    await fs.writeFile(wavPath, audio.buffer);
    const audioResult = await maybeConvertToMp3(wavPath, path.join(audioDir, `${id}.mp3`));
    const audioUrl = `generated/${date}/audio/${path.basename(audioResult.path)}`;

    const item = {
      id,
      scene: result.scene,
      sceneTime: result.sceneTime,
      sceneTimeMinutes: result.sceneTimeMinutes,
      sceneTimeBand: result.sceneTimeBand,
      voice: result.voice,
      audioUrl,
      worldCapsuleId: worldCapsule.id,
      creativePressure,
      timeEnvelope: envelope.id
    };
    accepted.push(item);
    todayTexts.push(result.scene);
    liveHistory.add(item);
    worldUsage.set(worldCapsule.id, (worldUsage.get(worldCapsule.id) || 0) + 1);
    voiceUsage.set(result.voice, (voiceUsage.get(result.voice) || 0) + 1);
    console.log(`[${accepted.length}/${targetCount}] ${id} ${result.sceneTime} ${result.voice} ${worldCapsule.id}`);
  } catch (error) {
    console.warn(`[attempt ${attempt}] rejected: ${error.message}`);
  }
}

if (accepted.length < targetCount) {
  throw new Error(`Only ${accepted.length}/${targetCount} scenes survived validation. Increase RESET_DAILY_MAX_ATTEMPTS or inspect model output.`);
}

const manifest = {
  version: 2,
  date,
  generatedAt: new Date().toISOString(),
  model: process.env.RESET_MODEL_NAME || 'gemma3:4b',
  count: accepted.length,
  scenes: accepted
};
await fs.writeFile(path.join(packDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await fs.writeFile(path.join(outputRoot, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Wrote ${path.relative(process.cwd(), path.join(packDir, 'manifest.json'))}`);
console.log(`Voice split: ${JSON.stringify(Object.fromEntries(voiceUsage))}`);

function chooseLeastUsedWorld(usage, rng) {
  const minimum = Math.min(...fixtureWorldCapsules.map(capsule => usage.get(capsule.id) || 0));
  const candidates = fixtureWorldCapsules.filter(capsule => (usage.get(capsule.id) || 0) === minimum);
  return candidates[Math.floor(rng() * candidates.length)];
}

async function maybeConvertToMp3(wavPath, mp3Path) {
  if ((process.env.RESET_AUDIO_FORMAT || 'mp3').toLowerCase() !== 'mp3') return { path: wavPath, format: 'wav' };
  try {
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-b:a', '64k', mp3Path]);
    await fs.rm(wavPath, { force: true });
    return { path: mp3Path, format: 'mp3' };
  } catch (error) {
    console.warn(`ffmpeg unavailable; retaining WAV (${error.message})`);
    return { path: wavPath, format: 'wav' };
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}
