import { readFile, unlink } from 'node:fs/promises';
import { validatePack } from '../src/narration/pack.ts';
import { WEATHER_SPECTRUM_REVISION } from '../src/scene/weather-preview.ts';
const path = 'public/generated/latest.json';
try {
  const pack = validatePack(JSON.parse(await readFile(path, 'utf8')));
  if (pack.sceneRevision !== WEATHER_SPECTRUM_REVISION) throw new Error('Scene revision changed');
  console.log(`Retained prepared moments from ${pack.date}.`);
} catch {
  await unlink(path).catch(() => {});
  console.log('No compatible pack yet. The app will use written observations until the generation workflow runs.');
}
