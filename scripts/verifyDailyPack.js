import fs from 'fs/promises';
import path from 'path';
import { parseClockTime } from '../src/variation/sceneTime.js';
import { KOKORO_VOICES } from '../src/voice/voiceRouter.js';
import { isNearDuplicate } from '../src/daily/novelty.js';

const manifestPath = process.argv[2] || path.resolve('public', 'generated', 'latest.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
if (!Array.isArray(manifest.scenes) || !manifest.scenes.length) throw new Error('Manifest contains no scenes');

const seenIds = new Set();
for (const item of manifest.scenes) {
  if (seenIds.has(item.id)) throw new Error(`Duplicate id: ${item.id}`);
  seenIds.add(item.id);
  const words = String(item.scene || '').trim().split(/\s+/).filter(Boolean).length;
  if (words < 40 || words > 90) throw new Error(`${item.id}: invalid word count ${words}`);
  if (!KOKORO_VOICES.includes(item.voice)) throw new Error(`${item.id}: invalid voice ${item.voice}`);
  if (parseClockTime(item.sceneTime) == null) throw new Error(`${item.id}: invalid sceneTime ${item.sceneTime}`);
  if (!Number.isFinite(item.sceneTimeMinutes)) throw new Error(`${item.id}: missing sceneTimeMinutes`);
  const audioPath = path.resolve('public', item.audioUrl);
  const stat = await fs.stat(audioPath);
  if (stat.size < 1024) throw new Error(`${item.id}: audio too small`);
}

for (let i = 0; i < manifest.scenes.length; i += 1) {
  const prior = manifest.scenes.slice(0, i).map(x => x.scene);
  const result = isNearDuplicate(manifest.scenes[i].scene, prior);
  if (result.duplicate) throw new Error(`${manifest.scenes[i].id}: near duplicate (${result.reason})`);
}

console.log(`Daily pack valid: ${manifest.date} — ${manifest.scenes.length} scenes`);
