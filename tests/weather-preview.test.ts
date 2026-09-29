import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { WEATHER_PREVIEW_ENABLED, WEATHER_PREVIEW_DIRECTORY, WEATHER_PREVIEW_SCENES, WEATHER_SPECTRUM_ENABLED, WEATHER_SPECTRUM_REVISION, WEATHER_SPECTRUM_DIRECTORY, weatherPreviewState, weatherLightingLayers } from '../src/scene/weather-preview.ts';
import { ATMOSPHERE_CAPTURE_HOURS, skyOccurrence } from '../src/scene/atmosphere.ts';

test('weather preview state describes its fixed native render across visits', () => {
  for (const preview of ['rain','clear'] as const) for (const seed of ['morning','night','away']) {
    const state=weatherPreviewState(seed,Date.parse('2026-09-26T03:00:00Z'),preview,{},false);
    const look=WEATHER_PREVIEW_SCENES[preview];
    assert.equal(state.lightingHour,look.hour);
    assert.equal(state.exterior.humidity,look.humidity);
    assert.equal(state.exterior.rainIntensity,look.rain);
    assert.equal(state.exterior.fogIntensity,look.fog);
    assert.equal(state.room.airConditioner,true);
    assert.equal(state.room.notebook,'open');
    assert.equal(state.room.window,'closed');
    assert.equal(state.room.mug,'present');
    assert.equal(state.room.musicPlaying,false);
    assert.ok(preview==='rain' ? state.room.condensation>0 : state.room.condensation===0);
  }
});

test('rain and cloudy previews honor the entire time slider and keep matching props', () => {
  for (const preview of ['rain','clear'] as const) for (let hour=0;hour<=24;hour+=.25) {
    const state=weatherPreviewState('slider',Date.parse('2026-09-27T12:00:00Z'),preview,{lightingHour:hour},true);
    assert.equal(state.lightingHour,hour);
    assert.equal(state.room.airConditioner,true);
    assert.equal(state.room.notebook,'open');
    assert.equal(state.exterior.rainIntensity,preview==='rain'?.78:0);
    const layers=weatherLightingLayers(hour,preview,'slider');
    assert.equal(layers.length,WEATHER_SPECTRUM_REVISION>=8 ? skyOccurrence('slider').violetDawn?5:4 : 3,'All selected movies stay mounted when scrubbing');
    assert.ok(Math.abs(layers.reduce((sum,l)=>sum+l.weight,0)-1)<1e-10);
    assert.ok(layers.every(l=>l.opacity>=0 && l.opacity<=1));
    const effective = layers.map((layer,i)=>layer.opacity*layers.slice(i+1).reduce((transmission,next)=>transmission*(1-next.opacity),1));
    effective.forEach((weight,i)=>assert.ok(Math.abs(weight-layers[i]!.weight)<1e-10));
    if (hour>=8 && hour<=17) {
      assert.equal(state.room.mainLight,false);
      assert.equal(state.exterior.dockLights,false);
      assert.equal(layers.find(l=>l.look==='day')!.weight,1);
    }
    if (hour>=21 || hour<=5) assert.equal(state.room.mainLight,true);
  }
  assert.deepEqual(weatherLightingLayers(0,'rain'),weatherLightingLayers(24,'rain'));
  for (const hour of [5,8,17,18.35,21,24]) {
    const a=weatherLightingLayers(hour-.0001,'rain'), b=weatherLightingLayers(hour+.0001,'rain');
    a.forEach((layer,i)=>assert.ok(Math.abs(layer.weight-b[i]!.weight)<.001,`No visible lighting jump at ${hour}`));
  }
});

test('time presets and automatic local time remain effective in the weather scenes', () => {
  const now=new Date(2026,8,27,11,25).getTime();
  const automatic=weatherPreviewState('clock',now,'rain',{},true);
  assert.ok(Math.abs(automatic.lightingHour-(11+25/60))<1e-10);
  const night=weatherPreviewState('clock',now,'rain',{timeBand:'evening'},true);
  assert.equal(night.lightingHour,21);
  assert.equal(night.timeBand,'evening');
  assert.match(night.details.room[0]!,/Warm yellow/);
  const morning=weatherPreviewState('clock',now,'rain',{lightingHour:9},true);
  assert.equal(morning.timeBand,'morning');
  assert.doesNotMatch(morning.details.city[0]!,/streetlights/);
});

test('every active weather lighting stage is a complete validated native animation', context => {
  if (!WEATHER_SPECTRUM_ENABLED) return context.skip('The full spectrum is not published until all six animations verify');
  const base=`public/${WEATHER_SPECTRUM_DIRECTORY}`;
  const manifest=JSON.parse(readFileSync(`${base}/manifest.json`,'utf8'));
  const sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
  const report=manifest.nativeValidation;
  if (process.env.RESET_RUNTIME_ONLY !== '1') assert.equal(report.sourceSha256,sha(report.source));
  assert.equal(report.revision,WEATHER_SPECTRUM_REVISION);
  if (WEATHER_SPECTRUM_REVISION>=7) for (const check of ['water_has_clear_dielectric_reflections','water_uses_two_irregular_ripple_scales','water_ripple_texture_moves_and_closes_loop','water_render_preserves_reflection_detail']) assert.equal(report[check],true);
  assert.ok(report.checksPassed>=36);
  for (const check of ['impact_splash_is_brief_before_drainage','merging_bead_transfers_volume_then_drains','splash_and_merge_animation_closes_loop','warm_room_light_is_stronger_and_scheduled','warm_light_reflects_and_refracts_in_drops']) assert.equal(report[check],true);
  assert.equal(Object.keys(manifest.clips).length,WEATHER_SPECTRUM_REVISION>=8?12:6);
  if(WEATHER_SPECTRUM_REVISION>=8) for(const check of ['clouds_are_scripted_volumes_without_sky_photographs','rain_has_heavier_lower_cloud_banks','rare_sky_palettes_change_native_radiance','sunrise_and_sunset_use_warm_physical_light','left_quay_has_six_detailed_parked_cars']) assert.equal(report[check],true);
  const captures=WEATHER_SPECTRUM_REVISION>=8?ATMOSPHERE_CAPTURE_HOURS:{day:9,early:18.35,night:21};
  for (const weather of ['rain','clear'] as const) for (const [look,hour] of Object.entries(captures)) {
    const stem=`${weather}-${look}`, meta=manifest.clips[stem];
    assert.equal(meta.sourceSha256,report.sourceSha256);
    if (WEATHER_SPECTRUM_REVISION>=7) {
      assert.ok(meta.width>=1280 && meta.height>=854 && meta.height%2===0 && meta.samples>=16);
      assert.equal(meta.glossyBlur,0);
    }
    assert.equal(meta.hour,hour);
    if(WEATHER_SPECTRUM_REVISION>=8) {
      assert.ok(meta.samples>=32);
      assert.equal(meta.sunrise_palette,Number(look==='red'));
      assert.equal(meta.dawn_palette,Number(look==='violet'));
    }
    assert.equal(meta.frames,384);
    assert.equal(meta.fps,12);
    assert.equal(meta.durationSeconds,32);
    assert.equal(meta.rain,weather==='rain'?.78:0);
    assert.equal(meta.humidity,weather==='rain'?.8:.5);
    assert.equal(meta.bytes,statSync(`${base}/${stem}.mp4`).size);
    assert.equal(meta.sha256,sha(`${base}/${stem}.mp4`));
    assert.equal(meta.posterSha256,sha(`${base}/${stem}.webp`));
    assert.equal(Object.keys(meta.frameHashes).length,384);
    assert.ok(new Set(Object.values(meta.frameHashes)).size>350);
  }
});

test('published weather scenes are complete native movies matching the app state', context => {
  if (!WEATHER_PREVIEW_ENABLED) return context.skip('Weather preview is gated until native movies verify');
  const base=`public/${WEATHER_PREVIEW_DIRECTORY}`;
  const manifest=JSON.parse(readFileSync(`${base}/manifest.json`,'utf8'));
  const sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
  for (const preview of ['rain','clear'] as const) {
    const {metadata:meta,nativeValidation:report}=manifest[preview];
    const look=WEATHER_PREVIEW_SCENES[preview];
    assert.equal(meta.sourceSha256,report.sourceSha256);
    if (process.env.RESET_RUNTIME_ONLY !== '1') assert.equal(meta.sourceSha256,sha(meta.source));
    assert.equal(meta.frames,384);
    assert.equal(meta.fps,12);
    assert.equal(meta.durationSeconds,32);
    assert.equal(meta.hour,look.hour);
    assert.equal(meta.rain,look.rain);
    assert.equal(meta.humidity,look.humidity);
    assert.equal(meta.airConditioner,true);
    assert.equal(meta.book,'open');
    assert.equal(meta.bytes,statSync(`${base}/${preview}.mp4`).size);
    assert.equal(meta.sha256,sha(`${base}/${preview}.mp4`));
    assert.equal(meta.posterSha256,sha(`${base}/${preview}.webp`));
    assert.equal(Object.keys(meta.frameHashes).length,384);
    assert.ok(new Set(Object.values(meta.frameHashes)).size>350);
    assert.equal(report.streetlights_are_actual_scheduled_lights,true);
    if (preview==='rain') {
      assert.equal(report.glass_drops_drain_independently,true);
      assert.equal(report.glass_rain_closes_loop,true);
      assert.equal(report.condensation_requires_humidity_and_ac,true);
      assert.equal(report.rain_off_clears_glass_impacts_and_trails,true);
    }
  }
});
