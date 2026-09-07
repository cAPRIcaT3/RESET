import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dockDrivers,
  lerpMinutes,
  solarAltitude,
  wrapMinutes
} from '../public/dockDrivers.js';

test('dock clock wraps cleanly', () => {
  assert.equal(wrapMinutes(-1), 1439);
  assert.equal(wrapMinutes(1440), 0);
  assert.equal(wrapMinutes(1500), 60);
});

test('solar driver is continuous at sunrise and sunset', () => {
  assert.ok(Math.abs(solarAltitude(390)) < 1e-10);
  assert.ok(Math.abs(solarAltitude(1140)) < 1e-10);
  assert.ok(solarAltitude(765) > 0.99);
  assert.ok(solarAltitude(45) < -0.95);
});

test('fish and reflections are physically coupled', () => {
  const noon = dockDrivers(765);
  const midnight = dockDrivers(45);

  assert.ok(noon.fishVisibility > 0.98);
  assert.ok(midnight.fishVisibility < 0.01);
  assert.ok(noon.reflectivity < midnight.reflectivity);
  assert.ok(midnight.reflectivity > 0.98);
});

test('lamps and stars rise as daylight disappears', () => {
  const noon = dockDrivers(765);
  const night = dockDrivers(45);

  assert.ok(noon.lamps < 0.01);
  assert.ok(night.lamps > 0.99);
  assert.ok(noon.stars < 0.01);
  assert.ok(night.stars > 0.99);
});

test('sun and moon crossfade rather than hard-swap at the horizon', () => {
  const justBefore = dockDrivers(389);
  const justAfter = dockDrivers(391);

  assert.ok(Math.abs(justBefore.sunVisibility - justAfter.sunVisibility) < 0.1);
  assert.ok(Math.abs(justBefore.moonVisibility - justAfter.moonVisibility) < 0.1);
});

test('time easing takes the short path across midnight', () => {
  const halfway = lerpMinutes(1420, 20, 0.5);
  assert.ok(halfway < 2 || halfway > 1438, `expected midnight, got ${halfway}`);
});
