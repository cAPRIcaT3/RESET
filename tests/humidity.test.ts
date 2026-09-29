import test from 'node:test';
import assert from 'node:assert/strict';
import { condensationAt, clampHumidity } from '../src/scene/humidity.ts';
import { generateScene } from '../src/scene/generate.ts';

test('condensation requires humid air and AC and increases smoothly', () => {
  assert.equal(condensationAt(.95, false), 0);
  assert.equal(condensationAt(.60, true), 0);
  assert.ok(Math.abs(condensationAt(.75, true) - .5) < 1e-10);
  assert.equal(condensationAt(1, true), 1);
  assert.equal(condensationAt(NaN, true), 0);
  assert.equal(clampHumidity(-1), 0);
  assert.equal(clampHumidity(3), 1);
});

test('humidity overrides do not reroll the room, city or rain', () => {
  const at = new Date(2026, 8, 20, 19).getTime();
  const make = (humidity: number, airConditioner = true) => generateScene('humid-window', at, {version: 1}, {humidity, airConditioner, weather: 'rain'});
  const dry = make(.4), wet = make(.9), acOff = make(.9, false);
  assert.equal(dry.room.condensation, 0);
  assert.equal(wet.room.condensation, 1);
  assert.equal(acOff.room.condensation, 0);
  assert.equal(dry.id, wet.id);
  assert.equal(dry.room.notebook, wet.room.notebook);
  assert.equal(dry.exterior.rainIntensity, wet.exterior.rainIntensity);
  assert.equal(wet.exterior.rainIntensity, acOff.exterior.rainIntensity);
});
