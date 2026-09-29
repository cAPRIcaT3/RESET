import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { weatherPreviewState, WEATHER_SPECTRUM_REVISION } from '../src/scene/weather-preview.ts';
import { PreparedNarrationLibrary, narrationContextKey, validatePack } from '../src/narration/pack.ts';
import { RESET_PROMPT_VERSION } from '../src/narration/prompts.ts';
import { packContexts } from '../scripts/pack-contexts.ts';
import { speechChunks } from '../scripts/speech-chunks.ts';
import { verifyPackFiles } from '../scripts/verify-moments.ts';

const date = '2026-09-29';
const scene = (hour = 12) => weatherPreviewState('fixture', Date.parse(`${date}T12:00:00Z`), 'rain', {lightingHour: hour});
const text = 'The walnut desk sits beside the broad window, with an open book resting close to the ceramic mug in the quiet room. Air from the conditioner stirs a few leaves and lifts the edge of a loose page before it settles back against the wood. Beyond the closed glass, rain gathers into beads that join and slide toward the lower frame. Across the water, the buildings remain visible through the moving drops, with their outlines reflected in the broken surface below.';
const bytes = Buffer.alloc(2048, 1);
const entry = {id:'fixture',contextKey:narrationContextKey(scene()),narration:text,audio:{path:`${date}/audio/fixture.mp3`,sha256:createHash('sha256').update(bytes).digest('hex'),mime:'audio/mpeg' as const,voice:'af_nicole'}};
const pack = {version:1,promptVersion:RESET_PROMPT_VERSION,date,model:'test-only',sceneRevision:WEATHER_SPECTRUM_REVISION,entries:[entry]};

test('prepared packs reject incompatible prompts, malformed narration, and arbitrary audio URLs', () => {
  assert.equal(validatePack(pack).entries.length,1);
  assert.throws(()=>validatePack({...pack,promptVersion:'old'}));
  for (const path of ['https://example.com/a.mp3','../secret.mp3','2026-09-29/audio/../../secret.mp3','//example.com/a.wav']) {
    assert.throws(()=>validatePack({...pack,entries:[{...entry,audio:{...entry.audio,path}}]}));
  }
  assert.throws(()=>validatePack({...pack,entries:[entry,entry]}));
  assert.throws(()=>validatePack({...pack,entries:[{...entry,narration:'Wrong.'}]}));
});

test('runner contexts cover the full slider for both weather families, without crossing scene conditions', () => {
  const contexts = packContexts(date);
  const keys = new Set(contexts.map(narrationContextKey));
  assert.equal(keys.size,contexts.length);
  assert.ok(contexts.length <= 64, 'Keep runner work bounded');
  for (const weather of ['rain','clear'] as const) for(let step=0;step<=480;step++) for(const seed of ['visit-0','visit-4','another-visit']) {
    const state=weatherPreviewState(seed,Date.parse(`${date}T12:00:00Z`),weather,{lightingHour:step/20});
    assert.ok(keys.has(narrationContextKey(state)), `${weather} ${step/20} ${seed}`);
  }
  assert.notEqual(narrationContextKey(scene(12)),narrationContextKey(scene(22)));
  const changed=structuredClone(scene()); changed.room.airConditioner=false;
  assert.notEqual(narrationContextKey(changed),narrationContextKey(scene()));
  assert.throws(()=>packContexts('2026-02-30'));
});

test('prepared narration matches the scene and resolves audio under repository Pages paths',async context=>{
  context.mock.method(globalThis,'fetch',async()=>Response.json(pack));
  // A full URL avoids depending on a browser global in the library.
  const library=new PreparedNarrationLibrary('https://example.com/RESET/generated/latest.json',WEATHER_SPECTRUM_REVISION);
  const found=await library.find(scene());
  assert.equal(found?.narration,text);
  assert.equal(found?.audioUrl,`https://example.com/RESET/generated/${date}/audio/fixture.mp3`);
  assert.equal(await library.find(scene(22)),undefined);
  const incompatible=new PreparedNarrationLibrary('https://example.com/RESET/generated/latest.json',999);
  assert.equal(await incompatible.find(scene()),undefined);
  const abort=new AbortController();abort.abort();
  await assert.rejects(library.find(scene(),abort.signal),{name:'AbortError'});
});

test('published recordings must have exactly the bytes referenced by the manifest',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'kelna-pack-'));
  try {
    await mkdir(join(folder,date,'audio'),{recursive:true});
    await writeFile(join(folder,entry.audio.path),bytes);
    await verifyPackFiles(pack,folder,false);
    await writeFile(join(folder,entry.audio.path),Buffer.alloc(2048,2));
    await assert.rejects(verifyPackFiles(pack,folder,false),/checksum/);
  } finally {await rm(folder,{recursive:true,force:true});}
});

test('Kokoro phrase splitting preserves every word and avoids paragraph truncation',()=>{
  const chunks=speechChunks(text);
  assert.ok(chunks.length>=4);
  assert.ok(chunks.every(chunk=>chunk.length<=220));
  assert.equal(chunks.join(' '),text);
});
