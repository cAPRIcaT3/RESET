import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITIES, TIME_BANDS, WEATHERS } from '../src/types/scene.ts';
import { generateScene } from '../src/scene/generate.ts';
import { ACTIVITY_RULES, timeBandAt } from '../src/scene/config.ts';
import { loadMemory, MEMORY_KEY, rememberScene } from '../src/continuity/storage.ts';
import { describeScene } from '../src/narration/local.ts';
import { resolveVisualPreset } from '../src/scene/manifest.ts';
import { trainAt, TRAIN_INTERVAL_MS, TRAIN_PASS_MS } from '../src/scene/train.ts';

const now = new Date(2026, 8, 19, 20, 0).getTime();

test('same seed, timestamp, and memory reproduce the complete scene', () => {
  assert.deepEqual(generateScene('quiet-window', now), generateScene('quiet-window', now));
  assert.notDeepEqual(generateScene('quiet-window', now), generateScene('another-window', now));
});

test('all weather, time and activity combinations preserve plausibility and 65–130 words', () => {
  for (const weather of WEATHERS) for (const timeBand of TIME_BANDS) for (const kelnaActivity of ACTIVITIES) {
    const scene = generateScene(`${weather}-${timeBand}-${kelnaActivity}`, now, { version: 1 }, { weather, timeBand, kelnaActivity });
    assert.equal(scene.presence, ACTIVITY_RULES[kelnaActivity].presence);
    if (weather === 'rain') assert.equal(scene.room.window, 'closed');
    if (weather === 'sunshine') assert.equal(scene.exterior.rainIntensity, 0);
    if (weather === 'fog') assert.equal(scene.exterior.trainVisible, false);
    if (kelnaActivity === 'studying' || kelnaActivity === 'journaling') assert.equal(scene.room.notebook, 'open');
    if (timeBand === 'afternoon') assert.ok(scene.exterior.cityLightLevel < .2);
    if (timeBand === 'evening') assert.ok(scene.exterior.cityLightLevel > .7);
    const words = describeScene(scene).split(/\s+/).length;
    assert.ok(words >= 65 && words <= 130, `${weather}/${timeBand}/${kelnaActivity}: ${words} words`);
  }
});

test('forced presence resolves an incompatible activity and lighting controls remain explicit', () => {
  const scene = generateScene('forced', now, { version: 1 }, { kelnaActivity: 'studying', presence: 'away', deskLamp: false, mainLight: true, musicPlaying: true, trainVisible: true });
  assert.equal(scene.presence, 'away');
  assert.ok(['away', 'out_with_friends'].includes(scene.kelnaActivity));
  assert.equal(scene.room.deskLamp, false);
  assert.equal(scene.room.mainLight, true);
  assert.equal(scene.room.musicPlaying, true);
  assert.equal(scene.exterior.trainVisible, true);
});

test('continuity increases returning-home probability and retains credible traces', () => {
  let returning = 0;
  let baseline = 0;
  let retainedNotes = 0;
  let wetDocks = 0;
  for (let index = 0; index < 400; index++) {
    const seed = `continuity-${index}`;
    const memory = { version: 1 as const, lastActivity: 'out_with_friends' as const, lastWeather: 'rain' as const, lastVisit: now - 3600000, notebookLeftOpen: true, mugLeftOut: true, musicWasPlaying: true };
    const scene = generateScene(seed, now, memory, { weather: 'cloudy' });
    if (scene.kelnaActivity === 'just_returned') returning++;
    if (generateScene(seed, now, { version: 1 }, { weather: 'cloudy' }).kelnaActivity === 'just_returned') baseline++;
    if (scene.room.notebook === 'open') retainedNotes++;
    if (scene.exterior.wetSurfaces) wetDocks++;
  }
  assert.ok(returning > baseline + 70);
  assert.ok(retainedNotes > 250);
  assert.ok(wetDocks > 250);
});

test('old and future memory do not carry props or weather forward', () => {
  for (const lastVisit of [now - 3 * 86400000, now + 86400000]) {
    const state = generateScene('expired', now, { version: 1, lastVisit, lastWeather: 'rain' }, { weather: 'cloudy' });
    assert.equal(state.exterior.wetSurfaces, false);
  }
});

test('storage round-trips compact memory and survives bad or unavailable storage', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const scene = generateScene('storage', now);
  rememberScene(scene, storage);
  const memory = loadMemory(storage);
  assert.equal(memory.lastActivity, scene.kelnaActivity);
  assert.equal(memory.lastVisit, now);
  assert.ok(memory.recentDetails!.length <= 6);
  values.set(MEMORY_KEY, '{not json');
  assert.deepEqual(loadMemory(storage), { version: 1 });
  values.set(MEMORY_KEY, JSON.stringify({ version: 1, lastActivity: 'impossible', recentDetails: [42, null, 'valid'] }));
  assert.equal(loadMemory(storage).lastActivity, undefined);
  assert.deepEqual(loadMemory(storage).recentDetails, ['valid']);
  const denied = { getItem: () => { throw new Error('Denied'); }, setItem: () => { throw new Error('Quota exceeded'); } };
  assert.deepEqual(loadMemory(denied), { version: 1 });
  assert.doesNotThrow(() => rememberScene(scene, denied));
});

test('the resolver chooses exact matches, prioritizes time, and supports empty manifests', () => {
  assert.equal(resolveVisualPreset({ weather: 'rain', timeBand: 'evening' })?.id, 'blender-evening');
  assert.equal(resolveVisualPreset({ weather: 'rain', timeBand: 'morning' })?.id, 'blender-morning');
  assert.equal(resolveVisualPreset({ weather: 'fog', timeBand: 'dawn' }, []), undefined);
});

test('train phase repeats every five minutes and fog hides it', () => {
  assert.equal(trainAt(TRAIN_INTERVAL_MS, 0).trainVisible, true);
  assert.equal(trainAt(TRAIN_INTERVAL_MS + TRAIN_PASS_MS, 0).trainVisible, false);
  assert.equal(trainAt(TRAIN_INTERVAL_MS, .85).trainVisible, false);
  assert.equal(trainAt(TRAIN_INTERVAL_MS + TRAIN_PASS_MS / 2, 0).trainProgress, .5);
});

test('time bands follow the visitor’s local clock', () => {
  const expectations = [[5, 'dawn'], [9, 'morning'], [14, 'afternoon'], [18, 'sunset'], [21, 'evening'], [1, 'late_night']] as const;
  for (const [hour, expected] of expectations) assert.equal(timeBandAt(new Date(2026, 8, 19, hour).getTime()), expected);
});
