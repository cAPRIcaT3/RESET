import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validatePack } from '../src/narration/pack.ts';
import type { NarrationPack } from '../src/narration/pack.ts';
import { packContexts } from './pack-contexts.ts';
import { narrationContextKey } from '../src/narration/pack.ts';

export async function verifyPackFiles(value: unknown, folder: string, probe = true): Promise<NarrationPack> {
  const pack = validatePack(value);
  for (const entry of pack.entries) {
    const path = resolve(folder, entry.audio.path);
    if ((await stat(path)).size < 1000) throw new Error(`Missing audio for ${entry.id}`);
    const hash = createHash('sha256').update(await readFile(path)).digest('hex');
    if (hash !== entry.audio.sha256) throw new Error(`Audio checksum mismatch for ${entry.id}`);
    if (probe) {
      const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path], { encoding: 'utf8' });
      const duration = Number(result.stdout);
      if (result.status !== 0 || !Number.isFinite(duration) || duration < 8 || duration > 180) throw new Error(`Invalid audio duration for ${entry.id}`);
    }
  }
  return pack;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const folder = resolve(process.env.RESET_PACK_OUTPUT || 'public/generated');
  const pack = await verifyPackFiles(JSON.parse(await readFile(`${folder}/latest.json`, 'utf8')), folder);
  if (process.env.RESET_DAILY_MODE !== 'smoke') {
    const keys = new Set(pack.entries.map(entry => entry.contextKey));
    for (const state of packContexts(pack.date)) if (!keys.has(narrationContextKey(state))) throw new Error('Missing scene condition in narration pack');
  }
  console.log(`Verified ${pack.entries.length} narrations and audio files.`);
}
