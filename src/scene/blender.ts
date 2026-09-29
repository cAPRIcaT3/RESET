import type { TimeBand, SceneState } from '../types/scene.ts';
import { BLENDER_PACK } from './blender-pack.ts';
import type { BlenderPack, BlenderLook } from './blender-pack.ts';

export const BLENDER_LOOP_SECONDS = 32;
export const BAND_HOURS: Record<TimeBand, number> = { dawn: 6, morning: 9, afternoon: 14, sunset: 18, evening: 21, late_night: 1 };

export function normalizeHour(hour: number): number {
  return Number.isFinite(hour) ? ((hour % 24) + 24) % 24 : 12;
}

/** Blend matching Blender frames; never change a camera, prop, or layout. */
export function daylightAt(hour: number): number {
  const value = normalizeHour(hour);
  const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
  return smooth((value - 5) / 3) * (1 - smooth((value - 17) / 4));
}

export type BlenderWeather = 'dry' | 'rain' | 'humid' | 'rain-humid';
export function blenderAsset(look: BlenderLook, airConditioner: boolean, format: 'webp' | 'mp4', book: 'open' | 'closed' | 'absent' = 'closed', pack: BlenderPack = BLENDER_PACK, weather: BlenderWeather = 'dry'): string {
  const variant = pack.bookStates ? `-${book}` : '';
  const atmosphere = pack.weatherStates ? `-${weather}` : '';
  return `${pack.directory}/${look}-${airConditioner ? 'on' : 'off'}${variant}${atmosphere}.${format}`;
}

/** Different native light circuits appear in successive dusk renders. */
export function lightingWeights(hour: number, pack: BlenderPack = BLENDER_PACK): Array<{ look: BlenderLook; weight: number }> {
  if (!pack.lightingStates) {
    const daylight = daylightAt(hour);
    return [{look: 'night', weight: 1-daylight}, {look: 'day', weight: daylight}];
  }
  const h = normalizeHour(hour);
  const states = pack.lightingStates;
  if (h <= 5 || h >= states[states.length-1]!.hour) return [{look: 'night', weight: 1}];
  if (h < 8) {
    const daylight = daylightAt(h);
    return [{look: 'night', weight: 1-daylight}, {look: 'day', weight: daylight}];
  }
  if (h <= states[0]!.hour) return [{look: states[0]!.look, weight: 1}];
  const upperIndex = states.findIndex(state => state.hour >= h);
  const lower = states[upperIndex-1]!, upper = states[upperIndex]!;
  const progress = (h-lower.hour)/(upper.hour-lower.hour);
  return [{look: lower.look, weight: 1-progress}, {look: upper.look, weight: progress}];
}

/** Alpha-composite complete native renders, retaining matching geometry and time. */
export function blenderLayers(state: SceneState, pack: BlenderPack = BLENDER_PACK) {
  const rain = pack.weatherStates ? Math.max(0, Math.min(1, state.exterior.rainIntensity)) : 0;
  const condensation = pack.weatherStates && state.room.airConditioner ? Math.max(0, Math.min(1, state.room.condensation)) : 0;
  const weatherWeights: Array<[BlenderWeather, number]> = [
    ['dry', (1-rain)*(1-condensation)], ['rain', rain*(1-condensation)],
    ['humid', (1-rain)*condensation], ['rain-humid', rain*condensation],
  ];
  const layers = lightingWeights(state.lightingHour, pack).flatMap(({look, weight: lightingWeight}) => weatherWeights.map(([weather, weight]) => ({
    look, weather, weight: weight * lightingWeight,
    book: pack.bookStates ? state.room.notebook : pack.fixedBook ?? 'closed' as const,
  }))).filter(layer => layer.weight > .0001);
  let accumulated = 0;
  return layers.map(layer => { accumulated += layer.weight; return { ...layer, opacity: layer.weight / accumulated }; });
}

export function formatHour(hour: number): string {
  const minutes = Math.round(normalizeHour(hour) * 60) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
