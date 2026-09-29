import type { SceneOverrides, SceneState } from '../types/scene.ts';
import { generateScene } from './generate.ts';
import { describeScene } from '../narration/local.ts';
import { lightingWeights } from './blender.ts';
import type { BlenderPack } from './blender-pack.ts';
import { atmosphereLightingLayers, nativeRoomLightLevel, nativeCityLightLevel, skyOccurrence } from './atmosphere.ts';

/** Flipped by the publisher only after both complete native movies verify. */
export const WEATHER_PREVIEW_ENABLED = true;
/** Activated only after every lighting movie passes native export checks. */
export const WEATHER_SPECTRUM_ENABLED = true;
export const WEATHER_SPECTRUM_REVISION = 8;
export const WEATHER_PREVIEW_DIRECTORY = 'scenes/weather-preview';
export const WEATHER_SPECTRUM_DIRECTORY = 'scenes/weather-spectrum-v8';
export const WEATHER_LIGHTING_PACK: BlenderPack = {
  revision: WEATHER_SPECTRUM_REVISION, directory: WEATHER_SPECTRUM_DIRECTORY, bookStates: false,
  lightingStates: [{look: 'day', hour: 17}, {look: 'early', hour: 18.35}, {look: 'night', hour: 21}],
};
export type WeatherPreview = 'rain' | 'clear';
export const WEATHER_PREVIEW_SCENES = {
  rain: { label: 'Rain on the glass', hour: 18.35, humidity: .8, rain: .78, fog: .22, stem: 'rain' },
  clear: { label: 'Cloudy waterfront', hour: 17, humidity: .5, rain: 0, fog: 0, stem: 'clear' },
} as const;

/** Keep all lighting movies mounted so scrubbing never resets the motion. */
export function weatherLightingLayers(hour: number, preview: WeatherPreview, seed = 'default') {
  if (WEATHER_SPECTRUM_REVISION >= 8) return atmosphereLightingLayers(hour, preview, seed, WEATHER_SPECTRUM_DIRECTORY);
  const weights = lightingWeights(hour, WEATHER_LIGHTING_PACK);
  let accumulated = 0;
  return (['day', 'early', 'night'] as const).map(look => {
    const weight = weights.find(layer => layer.look === look)?.weight ?? 0;
    accumulated += weight;
    return {look, weight, opacity: weight > 0 ? weight/accumulated : 0,
      nativeClip: `${WEATHER_SPECTRUM_DIRECTORY}/${preview}-${look}`};
  });
}

/** The render family fixes props and weather; the full 24-hour clock is live. */
export function weatherPreviewState(seed: string, now: number, preview: WeatherPreview, overrides: SceneOverrides = {}, spectrum = WEATHER_SPECTRUM_ENABLED): SceneState {
  const look = WEATHER_PREVIEW_SCENES[preview];
  const state = generateScene(seed, now, {version: 1}, {
    weather: preview === 'rain' ? 'rain' : 'cloudy',
    ...(spectrum ? {lightingHour: overrides.lightingHour, timeBand: overrides.timeBand} : {lightingHour: look.hour}),
    humidity: look.humidity, airConditioner: true, notebook: 'open',
    kelnaActivity: 'resting', deskLamp: false, mainLight: false, musicPlaying: false,
  });
  state.room.window = 'closed';
  state.room.curtains = 'open';
  state.room.mug = 'present';
  state.room.chair = 'pulled_back';
  state.exterior.rainIntensity = look.rain;
  state.exterior.fogIntensity = look.fog;
  state.exterior.wetSurfaces = preview === 'rain';
  const layers = weatherLightingLayers(state.lightingHour, preview, seed);
  const lightLevel = layers.reduce((sum, layer) => sum + layer.weight * nativeCityLightLevel(layer.look), 0);
  state.room.mainLight = spectrum && layers.some(layer=>layer.weight*nativeRoomLightLevel(layer.look)>.001);
  state.exterior.cityLightLevel = spectrum ? lightLevel : .6;
  state.exterior.dockLights = !spectrum || lightLevel > .001;
  if (WEATHER_SPECTRUM_REVISION >= 8) {
    const sky=skyOccurrence(seed);
    state.exterior.skyColors={sunrise:sky.sunrise==='red'?'crimson':'amber',dawn:sky.violetDawn?'violet':'blue'};
  }
  state.details.room = [`${state.room.mainLight ? 'Warm yellow light falls across the wood and the open book.' : 'An open book rests beside the mug in the window light.'} The air conditioner stirs the leaves and occasionally lifts a page.`];
  state.details.city = [preview === 'rain'
    ? `Drops strike the glass, gather together, then find their way down. ${state.exterior.dockLights ? 'Across the water, the streetlights catch in the ripples.' : 'The cloudy sky reflects in the water below.'}`
    : 'The ferry crosses the water below a cluster of towers. Its wake spreads behind it toward the quiet dock.'];
  if (WEATHER_SPECTRUM_REVISION >= 8) {
    state.details.city = [preview === 'rain'
      ? 'Rain clouds drift above the towers while drops merge and slide down the glass. A few cars sit on the left quay.'
      : 'Clouds move above the towers. The ferry leaves a spreading wake beside the quiet quay, where a few cars are parked.'];
  }
  state.narration = describeScene(state);
  return state;
}
