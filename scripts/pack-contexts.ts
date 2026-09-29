import { weatherPreviewState } from '../src/scene/weather-preview.ts';
import { narrationContextKey } from '../src/narration/pack.ts';
import type { SceneState } from '../src/types/scene.ts';

/** Cover each lighting boundary and both rare dawn palettes of the native room. */
export function packContexts(date: string): SceneState[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('PACK_DATE must be a valid YYYY-MM-DD');
  const contexts = new Map<string, SceneState>();
  for (const weather of ['rain', 'clear'] as const) {
    for (let step = 0; step <= 480; step++) {
      const lightingHour = step / 20;
      for (const seed of ['visit-0', 'visit-4']) {
        const state = weatherPreviewState(seed, Date.parse(`${date}T12:00:00+05:30`), weather, { lightingHour });
        const key = narrationContextKey(state);
        if (!contexts.has(key)) contexts.set(key, state);
      }
    }
  }
  return [...contexts.values()];
}
