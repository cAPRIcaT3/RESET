import { PreparedNarrationLibrary } from './pack.ts';
import { createNarrationProvider } from './providers.ts';
import type { SceneState } from '../types/scene.ts';
import { WEATHER_SPECTRUM_REVISION } from '../scene/weather-preview.ts';

export type MomentSource = 'prepared' | 'gemma' | 'local';
export interface MomentNarration { text: string; source: MomentSource; audioUrl?: string }

export function createMomentProvider() {
  const library = new PreparedNarrationLibrary(`${import.meta.env.BASE_URL}generated/latest.json`, WEATHER_SPECTRUM_REVISION);
  return {
    async generate(state: SceneState, signal?: AbortSignal): Promise<MomentNarration> {
      try {
        const prepared = await library.find(state, signal);
        if (prepared) return { text: prepared.narration, audioUrl: prepared.audioUrl, source: 'prepared' };
      } catch { signal?.throwIfAborted(); }
      let source: MomentSource = 'local';
      const provider = createNarrationProvider(value => { source = value; });
      const text = await provider.generate(state, signal);
      signal?.throwIfAborted();
      return { text, source };
    },
  };
}
