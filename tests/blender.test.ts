import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { daylightAt, normalizeHour, formatHour, blenderAsset, blenderLayers, lightingWeights } from '../src/scene/blender.ts';
import { generateScene } from '../src/scene/generate.ts';
import { BLENDER_PACK } from '../src/scene/blender-pack.ts';

const now = new Date(2026, 8, 20, 9).getTime();

test('lighting follows a continuous full day and wraps midnight without a jump', () => {
  for (let hour = -24; hour <= 48; hour += .05) {
    const value = daylightAt(hour);
    assert.ok(value >= 0 && value <= 1);
    assert.ok(Math.abs(daylightAt(hour + .001) - value) < .001);
  }
  assert.equal(daylightAt(0), daylightAt(24));
  assert.equal(daylightAt(12), 1);
  assert.equal(daylightAt(22), 0);
  assert.equal(daylightAt(6.5), .5);
  assert.equal(daylightAt(19), .5);
  assert.equal(normalizeHour(NaN), 12);
  assert.equal(formatHour(24), '00:00');
  assert.equal(formatHour(9.5), '09:30');
});

test('slider hour resolves matching time metadata and explicit time bands remain usable', () => {
  for (const [lightingHour, timeBand] of [[1, 'late_night'], [6, 'dawn'], [9, 'morning'], [14, 'afternoon'], [18, 'sunset'], [21, 'evening']] as const) {
    const scene = generateScene('slider', now, { version: 1 }, { lightingHour });
    assert.equal(scene.timeBand, timeBand);
    assert.equal(scene.lightingHour, lightingHour);
  }
  assert.equal(generateScene('band', now, { version: 1 }, { timeBand: 'evening' }).lightingHour, 21);
});

test('AC overrides are deterministic, respect off, and do not reroll the rest of the moment', () => {
  const generate = (airConditioner: boolean) => generateScene('ac-check', now, { version: 1 }, { airConditioner, kelnaActivity: 'reading' });
  const on = generate(true), off = generate(false);
  assert.equal(on.room.airConditioner, true);
  assert.equal(off.room.airConditioner, false);
  assert.equal(on.room.window, 'closed');
  assert.equal(on.id, off.id);
  assert.deepEqual(on.exterior, off.exterior);
  assert.equal(on.kelnaActivity, off.kelnaActivity);
  assert.deepEqual(generate(true), on);
  assert.equal(generateScene('away', now, { version: 1 }, { presence: 'away' }).room.airConditioner, false);
});

test('Blender validates fixed day/night geometry and independently controlled plant animation', () => {
  const report = JSON.parse(readFileSync(BLENDER_PACK.revision === 1 ? 'blender/validation.json' : `blender/validation-v${BLENDER_PACK.revision}.json`, 'utf8'));
  assert.equal(report.identical_day_night_geometry, true);
  assert.equal(report.air_conditioner_off_stops_leaves, true);
  assert.equal(report.air_conditioner_on_moves_leaves, true);
  assert.match(report.geometry_signature, /^[a-f0-9]{64}$/);
  const looks = BLENDER_PACK.lightingStates?.map(state => state.look) ?? ['day', 'night'] as const;
  for (const look of looks) for (const ac of [true, false]) {
    for (const book of (BLENDER_PACK.bookStates ? ['open', 'closed', 'absent'] : ['closed']) as Array<'open' | 'closed' | 'absent'>) {
      const asset = blenderAsset(look, ac, 'mp4', book);
      const metadata = JSON.parse(readFileSync(`public/${asset.replace('.mp4', '.complete.json')}`, 'utf8'));
      assert.equal(metadata.frames, 384);
      assert.equal(metadata.fps, 12);
      assert.equal(metadata.bytes, statSync(`public/${asset}`).size);
      assert.ok(statSync(`public/${blenderAsset(look, ac, 'webp', book)}`).size > 1000);
    }
  }
});

test('native weather renders blend continuously without changing their layout', () => {
  const pack = { revision: 3, directory: 'scenes/blender-v3', bookStates: true, weatherStates: true };
  const state = generateScene('wet-glass', now, {version: 1}, {airConditioner: true, humidity: .75, weather: 'rain', lightingHour: 19});
  const layers = blenderLayers(state, pack);
  assert.equal(layers.length, 8);
  assert.ok(Math.abs(layers.reduce((sum, layer) => sum + layer.weight, 0) - 1) < 1e-12);
  layers.forEach((layer, index) => {
    let compositedWeight = layer.opacity;
    for (let above = index + 1; above < layers.length; above++) compositedWeight *= 1 - layers[above]!.opacity;
    assert.ok(Math.abs(compositedWeight - layer.weight) < 1e-12);
  });
  state.room.airConditioner = false;
  assert.ok(blenderLayers(state, pack).every(layer => !layer.weather.includes('humid')));
  state.lightingHour = 12;
  assert.ok(blenderLayers(state, pack).every(layer => layer.look === 'day'));
  assert.equal(blenderAsset('night', true, 'mp4', 'open', pack, 'rain-humid'), 'scenes/blender-v3/night-on-open-rain-humid.mp4');
});

test('book overrides preserve the moment and choose a complete render family', () => {
  const base = generateScene('book-prop', now, { version: 1 });
  for (const notebook of ['open', 'closed', 'absent'] as const) {
    const scene = generateScene('book-prop', now, { version: 1 }, { notebook });
    assert.equal(scene.room.notebook, notebook);
    assert.equal(scene.id, base.id);
    assert.equal(scene.room.mug, base.room.mug);
    assert.deepEqual(scene.exterior, base.exterior);
    assert.equal(blenderAsset('day', true, 'mp4', notebook, { revision: 2, directory: 'scenes/blender-v2', bookStates: true }), `scenes/blender-v2/day-on-${notebook}.mp4`);
  }
  // Prepared assets cannot become live until the entire new family is published.
  if (!BLENDER_PACK.bookStates) assert.equal(blenderAsset('night', false, 'mp4', 'open'), `${BLENDER_PACK.directory}/night-off.mp4`);
});

test('city lighting starts at 17:00 and moves through distinct native dusk stages continuously', () => {
  const pack = {revision: 4, directory: 'scenes/city-v4', bookStates: false, lightingStates: [
    {look: 'day' as const, hour: 17}, {look: 'early' as const, hour: 18},
    {look: 'blue' as const, hour: 19.5}, {look: 'night' as const, hour: 21},
  ]};
  assert.deepEqual(lightingWeights(16.99, pack), [{look: 'day', weight: 1}]);
  assert.deepEqual(lightingWeights(17, pack), [{look: 'day', weight: 1}]);
  assert.deepEqual(lightingWeights(17.5, pack), [{look: 'day', weight: .5}, {look: 'early', weight: .5}]);
  assert.deepEqual(lightingWeights(18.75, pack), [{look: 'early', weight: .5}, {look: 'blue', weight: .5}]);
  assert.deepEqual(lightingWeights(20.25, pack), [{look: 'blue', weight: .5}, {look: 'night', weight: .5}]);
  const weights = (hour: number) => Object.fromEntries(lightingWeights(hour, pack).map(item => [item.look, item.weight]));
  for (const boundary of [0,5,8,17,18,19.5,21,24]) {
    const before=weights(boundary-.0001), after=weights(boundary+.0001);
    for (const look of ['day','early','blue','night']) assert.ok(Math.abs((before[look]??0)-(after[look]??0))<.001);
  }
  for (let hour=0;hour<24;hour+=.07) {
    const values=lightingWeights(hour,pack);
    assert.ok(values.every(item=>item.weight>=0 && item.weight<=1));
    assert.ok(Math.abs(values.reduce((total,item)=>total+item.weight,0)-1)<1e-10);
  }
});
