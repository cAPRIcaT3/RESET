import type { SceneState, VisualPreset } from '../types/scene.ts';

// Every preset comes from one Blender model and fixed camera. The live viewport
// also blends matching frames continuously through src/scene/blender.ts.
export const visualPresets: VisualPreset[] = [
  { id: 'blender-dawn', weather: 'fog', timeBand: 'dawn', posterUrl: 'scenes/blender/day-off.webp', renderedEnvironment: true },
  { id: 'blender-morning', weather: 'cloudy', timeBand: 'morning', posterUrl: 'scenes/blender/day-off.webp', renderedEnvironment: true },
  { id: 'blender-afternoon', weather: 'sunshine', timeBand: 'afternoon', posterUrl: 'scenes/blender/day-off.webp', renderedEnvironment: true },
  { id: 'blender-sunset', weather: 'windy', timeBand: 'sunset', posterUrl: 'scenes/blender/day-off.webp', renderedEnvironment: true },
  { id: 'blender-evening', weather: 'rain', timeBand: 'evening', posterUrl: 'scenes/blender/night-off.webp', renderedEnvironment: true },
  { id: 'blender-night', weather: 'drizzle', timeBand: 'late_night', posterUrl: 'scenes/blender/night-off.webp', renderedEnvironment: true },
];

const bandOrder = ['dawn', 'morning', 'afternoon', 'sunset', 'evening', 'late_night'];
export function resolveVisualPreset(state: Pick<SceneState, 'weather' | 'timeBand'>, presets = visualPresets): VisualPreset | undefined {
  const score = (preset: VisualPreset) => {
    const distance = Math.abs(bandOrder.indexOf(state.timeBand) - bandOrder.indexOf(preset.timeBand));
    return (preset.weather === state.weather ? 3 : 0) + (preset.timeBand === state.timeBand ? 10 : 0) - Math.min(distance, 6 - distance);
  };
  return presets.reduce<VisualPreset | undefined>((best, preset) => !best || score(preset) > score(best) ? preset : best, undefined);
}

export function assetUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${import.meta.env.BASE_URL ?? './'}${path.replace(/^\//, '')}`;
}
