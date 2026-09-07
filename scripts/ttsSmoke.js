import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KokoroClient } from '../src/voice/kokoroClient.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', 'tmp');
await fs.mkdir(outDir, { recursive: true });

const client = new KokoroClient({ provider: 'local' });
console.log('Loading Kokoro local model…');
await client.warmup();
console.log('Kokoro ready. Generating two short voice checks…');

for (const [voice, label, text] of [
  ['af_nicole', 'nicole', 'RESET voice check. Nicole is ready to speak.'],
  ['am_michael', 'michael', 'RESET voice check. Michael is ready to speak.']
]) {
  const audio = await client.synthesize({ text, voice });
  const out = path.join(outDir, `${label}.wav`);
  await fs.writeFile(out, audio.buffer);
  console.log(`${label}: ${out} (${audio.buffer.length} bytes)`);
}
