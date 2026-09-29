import test from 'node:test';
import assert from 'node:assert/strict';
import { accessSync } from 'node:fs';
import { routePose, TRANSPORT_ROUTES, TRANSPORT_TIMING, transportTime, vehicleMotion, VEHICLE_SPRITES } from '../src/scene/transport.ts';
import { visualPresets } from '../src/scene/manifest.ts';

test('each crossing starts in view, travels forward, and fades out before looping', () => {
  for (const vehicle of ['ferry', 'train'] as const) {
    for (const profile of ['evening', 'daylight', 'mock'] as const) {
      const motion = vehicleMotion(vehicle, profile);
      const route = TRANSPORT_ROUTES[profile][vehicle];
      assert.ok(route.to[0] > route.from[0]);
      assert.equal(motion.duration, TRANSPORT_TIMING[vehicle].period);
      assert.equal(motion.frames[0]!.opacity, 0);
      assert.equal(motion.frames.at(-1)!.opacity, 0);
      assert.equal(motion.frames.at(-1)!.offset, 1);
      assert.ok(motion.frames.every((frame, index, frames) => index === 0 || Number(frame.offset) > Number(frames[index - 1]!.offset)));
      assert.ok(transportTime(vehicle, 0) > 0 && transportTime(vehicle, 0) < TRANSPORT_TIMING[vehicle].pass);
    }
  }
});

test('remounting or hiding a tab uses shared elapsed time instead of restarting a crossing', () => {
  for (const vehicle of ['train', 'ferry'] as const) {
    const initial = transportTime(vehicle, 0);
    const later = transportTime(vehicle, 12500);
    assert.equal(later - initial, 12500);
    assert.equal(transportTime(vehicle, -100), initial);
  }
});

test('normal trains return every five minutes; debug trains can cross continuously', () => {
  assert.equal(vehicleMotion('train', 'evening').duration, 300000);
  const debugMotion = vehicleMotion('train', 'evening', true);
  assert.equal(debugMotion.duration, TRANSPORT_TIMING.train.pass);
  assert.equal(debugMotion.frames.at(-1)!.offset, 1);
  assert.equal(debugMotion.frames.filter(frame => frame.offset === 1).length, 1);
});

test('routes use source-image coordinates and the integrated assets exist', () => {
  assert.equal(routePose({ from: [20, 40], to: [60, 50], width: 5 }, .5), 'translate(40%, 45%)');
  for (const sprite of Object.values(VEHICLE_SPRITES)) {
    assert.doesNotThrow(() => accessSync(`public/${sprite.url}`));
    const [x, y, width, height] = sprite.viewBox.split(' ').map(Number);
    assert.ok(x! >= 0 && y! >= 0 && x! + width! <= sprite.width && y! + height! <= sprite.height);
  }
  for (const preset of visualPresets) {
    assert.equal(preset.renderedEnvironment, true);
    assert.equal(preset.transportProfile, undefined);
    assert.doesNotThrow(() => accessSync(`public/${preset.posterUrl}`));
  }
});
