import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BLENDER_PACK } from '../src/scene/blender-pack.ts';

test('the active city pack contains eight complete native moving renders and validated light schedules', context => {
  if (BLENDER_PACK.revision < 4) return context.skip('City export is not active until all eight movies verify');
  const report=JSON.parse(readFileSync('blender/validation-v4.json','utf8'));
  assert.equal(report.city_lights_off_before_5pm,true);
  assert.equal(report.city_lights_have_staggered_starts,true);
  assert.equal(report.city_lights_brighten_gradually,true);
  assert.equal(report.streetlights_are_actual_scheduled_lights,true);
  assert.equal(report.roads_and_deep_skyline_are_modeled,true);
  for (const state of BLENDER_PACK.lightingStates!) for (const ac of ['on','off']) {
    const stem=`public/${BLENDER_PACK.directory}/${state.look}-${ac}`;
    const meta=JSON.parse(readFileSync(`${stem}.complete.json`,'utf8'));
    assert.equal(meta.sourceSha256,report.sourceSha256);
    assert.equal(meta.hour,state.hour);
    assert.equal(meta.airConditioner,ac==='on');
    assert.equal(meta.frames,384);
    assert.equal(meta.fps,12);
    assert.equal(meta.durationSeconds,32);
    assert.equal(meta.bytes,statSync(`${stem}.mp4`).size);
    assert.equal(meta.sha256,createHash('sha256').update(readFileSync(`${stem}.mp4`)).digest('hex'));
    assert.equal(meta.posterSha256,createHash('sha256').update(readFileSync(`${stem}.webp`)).digest('hex'));
    assert.ok(new Set(Object.values(meta.frameHashes)).size>350);
  }
});
